// =============================================================================
// POST /api/psych/assessments/[id]/responses
//
// Writes raw answers through the caller-scoped Supabase client so
// psych_responses RLS remains the sole authority for athlete ownership and the
// pending-assessment state. Once every validated item is present, the server
// applies the registered scoring key and completes the assessment.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { calculatePsychScores } from '@/lib/psych/scoring';

export const runtime = 'nodejs';

type IncomingResponse = {
  item_code?: unknown;
  raw_value?: unknown;
};

type RequestBody = {
  responses?: unknown;
};

/**
 * Uses the bearer token sent by mobile clients when present. Browser callers
 * use the server client's cookie-backed session. Neither branch uses the
 * service-role client, so the INSERT is evaluated by psych_responses RLS.
 */
async function createRequestScopedClient(req: NextRequest) {
  const authorization = req.headers.get('authorization');

  if (authorization) {
    if (!authorization.startsWith('Bearer ')) return null;
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
      {
        global: {
          headers: { Authorization: authorization },
        },
      }
    );
  }
  return createSupabaseServerClient();
}

function parseResponses(value: unknown):
  | { responses: Array<{ item_code: string; raw_value: string }> }
  | { error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: 'responses must be a non-empty array.' };
  }

  const seenItemCodes = new Set<string>();
  const responses: Array<{ item_code: string; raw_value: string }> = [];

  for (const response of value as IncomingResponse[]) {
    if (!response || typeof response.item_code !== 'string' || !response.item_code.trim()) {
      return { error: 'Every response requires a non-empty item_code.' };
    }

    if (
      typeof response.raw_value !== 'string' &&
      typeof response.raw_value !== 'number'
    ) {
      return { error: 'Every response requires a string or numeric raw_value.' };
    }

    const itemCode = response.item_code.trim();
    if (seenItemCodes.has(itemCode)) {
      return { error: `Duplicate item_code: ${itemCode}.` };
    }

    seenItemCodes.add(itemCode);
    responses.push({ item_code: itemCode, raw_value: String(response.raw_value) });
  }

  return { responses };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: assessmentId } = await params;
  const supabase = await createRequestScopedClient(req);
  if (!supabase) {
    return NextResponse.json({ error: 'Invalid Authorization header.' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseResponses(body.responses);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { data: testAssessment } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, is_test_run, psych_instruments!inner(id, code, item_count)')
    .eq('id', assessmentId)
    .eq('athlete_id', profile.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (testAssessment?.is_test_run) {
    const testInstrument = Array.isArray(testAssessment.psych_instruments)
      ? testAssessment.psych_instruments[0]
      : testAssessment.psych_instruments;
    const { data: testItems } = testInstrument
      ? await supabaseAdmin
        .from('psych_instrument_items')
        .select('item_code, subscale_code, is_reverse_scored, response_options')
        .eq('instrument_id', testInstrument.id)
        .order('item_order')
      : { data: null };
    if (!testInstrument || !testItems || parsed.responses.length !== testInstrument.item_count) {
      return NextResponse.json({ error: 'El cuestionario de prueba no está disponible.' }, { status: 409 });
    }
    try {
      const scores = calculatePsychScores(testInstrument.code, testItems, parsed.responses);
      return NextResponse.json({
        ok: true,
        assessmentId,
        complete: true,
        isTestRun: true,
        scores,
        message: 'Prueba completada. Las respuestas y resultados no fueron guardados.',
      });
    } catch {
      return NextResponse.json({ error: 'No fue posible calcular la prueba.' }, { status: 400 });
    }
  }

  // ── FASE 1: scoped client + RLS-authorized raw-response insert ──────────
  //
  // Insert one row at a time. PostgREST requires SELECT permission for an
  // ON CONFLICT/ignore-duplicates upsert, but athletes intentionally cannot
  // read raw responses. Plain inserts keep return=minimal and let duplicate
  // item codes be handled without overwriting an existing response.
  const attemptedCount = parsed.responses.length;
  let insertedCount = 0;
  let duplicateCount = 0;

  for (const response of parsed.responses) {
    const { error: insertError } = await supabase
      .from('psych_responses')
      .insert({
        assessment_id: assessmentId,
        ...response,
      });

    if (!insertError) {
      insertedCount += 1;
      continue;
    }
    if (insertError.code === '23505') {
      duplicateCount += 1;
      continue;
    }
    if (insertError.code === '42501') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(
      {
        error: insertError.message,
        attemptedCount,
        insertedCount,
        duplicateCount,
      },
      { status: 500 }
    );
  }

  // Partial and redundant retries preserve existing response values. The
  // service-role read below runs only after the RLS-scoped write succeeded;
  // it establishes completeness, not athlete authorization.
  const { data: assessment, error: assessmentError } = await supabaseAdmin
    .from('psych_assessments')
    .select('instrument_id')
    .eq('id', assessmentId)
    .maybeSingle();

  if (assessmentError || !assessment) {
    return NextResponse.json(
      { error: 'Assessment not found after response insertion.' },
      { status: 404 }
    );
  }

  const [
    { data: instrument, error: instrumentError },
    { count: registeredItemCount, error: countError },
  ] = await Promise.all([
    supabaseAdmin
      .from('psych_instruments')
      .select('id, code, item_count')
      .eq('id', assessment.instrument_id)
      .maybeSingle(),
    // UNIQUE (assessment_id, item_code) makes this exact row count equal to
    // COUNT(DISTINCT item_code) for the assessment.
    supabaseAdmin
      .from('psych_responses')
      .select('id', { count: 'exact', head: true })
      .eq('assessment_id', assessmentId),
  ]);

  if (instrumentError || !instrument || countError || registeredItemCount === null) {
    return NextResponse.json(
      { error: 'Unable to determine assessment completion.' },
      { status: 500 }
    );
  }

  if (registeredItemCount !== instrument.item_count) {
    return NextResponse.json({
      ok: true,
      assessmentId,
      complete: false,
      message: insertedCount === 0
        ? 'All submitted responses were already recorded.'
        : undefined,
      attemptedCount,
      insertedCount,
      duplicateCount,
      registeredItemCount,
      expectedItemCount: instrument.item_count,
    });
  }

  const [{ data: items }, { data: savedResponses }] = await Promise.all([
    supabaseAdmin
      .from('psych_instrument_items')
      .select('item_code, subscale_code, is_reverse_scored, response_options')
      .eq('instrument_id', instrument.id)
      .order('item_order'),
    supabaseAdmin
      .from('psych_responses')
      .select('item_code, raw_value')
      .eq('assessment_id', assessmentId),
  ]);

  if (!items || !savedResponses || items.length !== instrument.item_count) {
    return NextResponse.json({ error: 'Unable to load the scoring key.' }, { status: 500 });
  }

  let scores;
  try {
    scores = calculatePsychScores(instrument.code, items, savedResponses);
  } catch {
    return NextResponse.json({ error: 'Unable to calculate the assessment scores.' }, { status: 500 });
  }

  if (scores.length > 0) {
    const { error: scoreError } = await supabaseAdmin
      .from('psych_scores')
      .upsert(
        scores.map((score) => ({
          assessment_id: assessmentId,
          subscale_code: score.subscaleCode,
          raw_score: score.rawScore,
          band: score.band,
        })),
        { onConflict: 'assessment_id,subscale_code' }
      );
    if (scoreError) return NextResponse.json({ error: scoreError.message }, { status: 500 });
  }

  const { error: completionError } = await supabaseAdmin
    .from('psych_assessments')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', assessmentId)
    .eq('status', 'pending');
  if (completionError) return NextResponse.json({ error: completionError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    assessmentId,
    complete: true,
    attemptedCount,
    insertedCount,
    duplicateCount,
    registeredItemCount,
    expectedItemCount: instrument.item_count,
    message: instrument.code === 'BASC-3-PRS-C'
      ? 'Tus respuestas fueron registradas para revisión profesional.'
      : 'Tus respuestas fueron registradas y el cuestionario fue completado.',
  });
}

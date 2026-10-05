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
import { validatePsychSubmission } from '@/lib/psych/submission';

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
  const { data: assessment, error: assessmentError } = await supabaseAdmin
    .from('psych_assessments')
    .select('id, is_test_run, athlete_id, instrument_id, scheduled_by, scheduled_for, psych_instruments!inner(id, code, name, item_count, is_active, is_test_only, license_status)')
    .eq('id', assessmentId)
    .eq('athlete_id', profile.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (assessmentError || !assessment) {
    return NextResponse.json({ error: 'Assessment not found or no longer available.' }, { status: 404 });
  }
  if (assessment.scheduled_for && new Date(assessment.scheduled_for) > new Date()) {
    return NextResponse.json({ error: 'Esta evaluación aún no está disponible.' }, { status: 409 });
  }

  const instrument = Array.isArray(assessment.psych_instruments)
    ? assessment.psych_instruments[0]
    : assessment.psych_instruments;
  if (!instrument) return NextResponse.json({ error: 'Instrument not found.' }, { status: 404 });

  const { data: items } = await supabaseAdmin
      .from('psych_instrument_items')
      .select('item_code, subscale_code, is_reverse_scored, response_options')
      .eq('instrument_id', instrument.id)
      .order('item_order');

  if (!items || items.length !== instrument.item_count) {
    return NextResponse.json({ error: 'Unable to load the scoring key.' }, { status: 500 });
  }
  const validation = validatePsychSubmission(items, parsed.responses);
  if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 });

  let scores;
  try {
    scores = calculatePsychScores(instrument.code, items, parsed.responses);
  } catch {
    return NextResponse.json({ error: 'Unable to calculate the assessment scores.' }, { status: 500 });
  }
  if (assessment.is_test_run) {
    return NextResponse.json({
      ok: true,
      assessmentId,
      complete: true,
      isTestRun: true,
      scores,
      message: 'Prueba completada. Las respuestas y resultados no fueron guardados.',
    });
  }
  if (
    !instrument.is_active ||
    instrument.is_test_only ||
    !['licensed', 'not_required'].includes(instrument.license_status)
  ) {
    return NextResponse.json({ error: 'No questionnaire is available for this assessment.' }, { status: 404 });
  }

  const { data: existingResponses, error: existingResponsesError } = await supabaseAdmin
    .from('psych_responses')
    .select('item_code, raw_value')
    .eq('assessment_id', assessmentId);
  if (existingResponsesError) return NextResponse.json({ error: existingResponsesError.message }, { status: 500 });

  let insertedCount = 0;
  if (existingResponses?.length) {
    const existingByCode = new Map(existingResponses.map((response) => [response.item_code, response.raw_value]));
    const matchesSubmission = existingResponses.length === parsed.responses.length &&
      parsed.responses.every((response) => existingByCode.get(response.item_code) === response.raw_value);
    if (!matchesSubmission) {
      return NextResponse.json({ error: 'Esta evaluación ya contiene respuestas que no pueden reemplazarse.' }, { status: 409 });
    }
  } else {
    const { error: insertError } = await supabase
      .from('psych_responses')
      .insert(parsed.responses.map((response) => ({ assessment_id: assessmentId, ...response })));
    if (insertError) {
      return NextResponse.json(
        { error: insertError.code === '42501' ? 'Forbidden' : insertError.message },
        { status: insertError.code === '42501' ? 403 : 500 }
      );
    }
    insertedCount = parsed.responses.length;
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

  if (assessment.scheduled_by) {
    const [{ data: scheduler }, { data: athleteProfile }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('email, first_name')
        .eq('id', assessment.scheduled_by)
        .maybeSingle(),
      supabaseAdmin
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', assessment.athlete_id)
        .maybeSingle(),
    ]);
    if (scheduler?.email) {
      const athleteName = athleteProfile
        ? `${athleteProfile.first_name} ${athleteProfile.last_name}`.trim()
        : 'El atleta';
      const assessmentUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.aodeporte.com'}/dashboard/mental-health/assessments/${assessmentId}`;
      await supabaseAdmin
        .from('email_jobs')
        .upsert(
          {
            recipient_profile_id: assessment.scheduled_by,
            recipient_email: scheduler.email,
            subject: `Evaluación completada: ${athleteName}`,
            html_body: `<p>Hola ${scheduler.first_name},</p><p><strong>${athleteName}</strong> completó la evaluación <strong>${instrument.name}</strong>.</p><p><a href="${assessmentUrl}">Revisar evaluación</a></p>`,
            plain_body: `${athleteName} completó la evaluación ${instrument.name}. Revisar: ${assessmentUrl}`,
            idempotency_key: `psych-assessment:${assessmentId}:completion-email`,
            scheduled_at: new Date().toISOString(),
          },
          { onConflict: 'idempotency_key', ignoreDuplicates: true }
        );
    }
  }

  return NextResponse.json({
    ok: true,
    assessmentId,
    complete: true,
    insertedCount,
    expectedItemCount: instrument.item_count,
    message: instrument.code === 'BASC-3-PRS-C'
      ? 'Tus respuestas fueron registradas para revisión profesional.'
      : 'Tus respuestas fueron registradas y el cuestionario fue completado.',
  });
}

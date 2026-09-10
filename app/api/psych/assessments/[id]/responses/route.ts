// =============================================================================
// POST /api/psych/assessments/[id]/responses
//
// Phase 1 writes raw answers through the caller-scoped Supabase client so
// psych_responses RLS remains the sole authority for athlete ownership and the
// pending-assessment state. Scoring is deliberately deferred until instrument
// scoring keys and formulas have been clinically validated.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

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
      .select('item_count')
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

  // ── FASE 1 / FASE 2 BOUNDARY ────────────────────────────────────────────
  //
  // No code below this boundary may run when the scoped INSERT was rejected.
  // A clinically validated scorer must own the only subsequent use of
  // supabaseAdmin: read instrument.code, insert psych_scores, mark the
  // assessment completed, and create psych_alerts from athlete history.
  //
  // The scorer is intentionally not implemented yet because the instrument
  // item keys, inverse items, and clinical formulas have not been specified.
  // Keep the assessment pending rather than persisting invented scores.
  return NextResponse.json(
    {
      error: 'Psychological scoring is not implemented yet.',
      code: 'PSYCH_SCORING_NOT_IMPLEMENTED',
      assessmentId,
      complete: true,
      attemptedCount,
      insertedCount,
      duplicateCount,
      registeredItemCount,
      expectedItemCount: instrument.item_count,
    },
    { status: 501 }
  );
}

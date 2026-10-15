import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Results an athlete may read: approved and published assessments, with the
 * summary written for them and any per-subscale interpretation the clinician
 * wrote. Never the confidential clinical note, answers, raw scores or bands.
 */
export type AthletePublishedResult = {
  id: string;
  instrumentCode: string;
  instrumentName: string;
  completedAt: string | null;
  publishedAt: string | null;
  summary: string;
  interpretations: Array<{ subscaleCode: string; text: string }>;
};

export const ATHLETE_RESULT_COLUMNS =
  'id, completed_at, published_at, athlete_summary, psych_instruments!inner(code, name, is_test_only)';
export const ATHLETE_INTERPRETATION_COLUMNS = 'assessment_id, subscale_code, interpretation_text';

type ResultRow = {
  id: string;
  completed_at: string | null;
  published_at: string | null;
  athlete_summary: string | null;
  psych_instruments: { code: string; name: string } | { code: string; name: string }[] | null;
};

type InterpretationRow = {
  assessment_id: string;
  subscale_code: string;
  interpretation_text: string | null;
};

export async function getAthletePublishedResults(athleteProfileId: string): Promise<AthletePublishedResult[]> {
  const { data, error } = await supabaseAdmin
    .from('psych_assessments')
    .select(ATHLETE_RESULT_COLUMNS)
    .eq('athlete_id', athleteProfileId)
    .eq('status', 'approved')
    .eq('published_to_athlete', true)
    .not('athlete_summary', 'is', null)
    .eq('psych_instruments.is_test_only', false)
    .order('published_at', { ascending: false });
  if (error) throw new Error(`psych_assessments query failed: ${error.message}`);
  const rows = (data ?? []) as ResultRow[];
  if (rows.length === 0) return [];

  const { data: interpretationRows, error: interpretationError } = await supabaseAdmin
    .from('psych_scores')
    .select(ATHLETE_INTERPRETATION_COLUMNS)
    .in('assessment_id', rows.map((row) => row.id))
    .not('interpretation_text', 'is', null)
    .order('subscale_code');
  if (interpretationError) throw new Error(`psych_scores query failed: ${interpretationError.message}`);

  const interpretationsByAssessment = new Map<string, AthletePublishedResult['interpretations']>();
  for (const row of (interpretationRows ?? []) as InterpretationRow[]) {
    const text = row.interpretation_text?.trim();
    if (!text) continue;
    const list = interpretationsByAssessment.get(row.assessment_id) ?? [];
    list.push({ subscaleCode: row.subscale_code, text });
    interpretationsByAssessment.set(row.assessment_id, list);
  }

  return rows.flatMap((row) => {
    const instrument = Array.isArray(row.psych_instruments) ? row.psych_instruments[0] : row.psych_instruments;
    const summary = row.athlete_summary?.trim();
    if (!instrument || !summary) return [];
    return [{
      id: row.id,
      instrumentCode: instrument.code,
      instrumentName: instrument.name,
      completedAt: row.completed_at,
      publishedAt: row.published_at,
      summary,
      interpretations: interpretationsByAssessment.get(row.id) ?? [],
    }];
  });
}

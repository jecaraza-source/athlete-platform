/**
 * The clinical review has two texts: a confidential note (clinical_summary)
 * and a summary for the athlete (athlete_summary). Only the latter may ever
 * reach the athlete, and it is what approval and publication require.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseChain, hasCall, type RecordedQuery, type QueryResult } from './supabase-chain';

const { state } = vi.hoisted(() => ({
  state: {
    admin: null as ReturnType<typeof import('./supabase-chain').createSupabaseChain> | null,
    user: null as unknown,
  },
}));

vi.mock('next-intl/server', async () => (await import('./next-intl-mock')).nextIntlServerMock);
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (table: string) => state.admin!.from(table) },
}));
vi.mock('@/lib/rbac/server', () => ({
  getCurrentUser: async () => state.user,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { approvePsychAssessment, savePsychClinicalReview } from '@/app/[locale]/(app)/dashboard/mental-health/actions';
import { PATCH as publish } from '@/app/api/psych/assessments/[id]/publish/route';
import { ATHLETE_RESULT_COLUMNS, ATHLETE_INTERPRETATION_COLUMNS, getAthletePublishedResults } from '@/lib/psych/athlete-results';

const CLINICIAN = {
  profile: { id: 'profile-psych-1' },
  roles: [{ code: 'mental_health_admin' }],
  permissions: new Set(['psych.write_interpretation', 'psych.publish_to_athlete']),
};

function updatesTo(table: string) {
  return state.admin!.queries
    .filter((query) => query.table === table)
    .flatMap((query) => query.calls.filter((call) => call.method === 'update').map((call) => call.args[0]));
}

beforeEach(() => {
  state.user = CLINICIAN;
});

describe('savePsychClinicalReview', () => {
  it('stores the confidential note and the athlete summary separately', async () => {
    state.admin = createSupabaseChain(() => ({ data: null }));

    const result = await savePsychClinicalReview({
      assessmentId: 'assessment-1',
      clinicalSummary: '  Nota interna  ',
      athleteSummary: 'Resumen para ti',
    });

    expect(result).toEqual({});
    expect(updatesTo('psych_assessments')).toEqual([expect.objectContaining({
      clinical_summary: 'Nota interna',
      athlete_summary: 'Resumen para ti',
      reviewed_by: 'profile-psych-1',
    })]);
  });

  it('rejects saving when both texts are empty', async () => {
    state.admin = createSupabaseChain(() => ({ data: null }));
    const result = await savePsychClinicalReview({ assessmentId: 'assessment-1', clinicalSummary: ' ', athleteSummary: '' });
    expect(result.error).toBeTruthy();
    expect(updatesTo('psych_assessments')).toEqual([]);
  });
});

describe('approval and publication', () => {
  function assessmentWith(fields: Record<string, unknown>) {
    return (query: RecordedQuery): QueryResult => query.table === 'psych_assessments'
      ? { data: { id: 'assessment-1', psych_instruments: { is_test_only: false, scoring_mode: 'manual_review' }, ...fields } }
      : { data: [] };
  }

  it('requires the athlete summary to approve, even with a confidential note', async () => {
    state.admin = createSupabaseChain(assessmentWith({ clinical_summary: 'Solo nota interna', athlete_summary: null }));
    const result = await approvePsychAssessment({ assessmentId: 'assessment-1' });
    expect(result.error).toBe('psych.errors.summaryBeforeApprove');
    expect(updatesTo('psych_assessments')).toEqual([]);
  });

  it('approves once the athlete summary exists', async () => {
    state.admin = createSupabaseChain(assessmentWith({ clinical_summary: null, athlete_summary: 'Resumen' }));
    expect(await approvePsychAssessment({ assessmentId: 'assessment-1' })).toEqual({});
    expect(updatesTo('psych_assessments')).toEqual([expect.objectContaining({ status: 'approved' })]);
  });

  it('refuses to publish without an athlete summary', async () => {
    state.admin = createSupabaseChain(assessmentWith({
      status: 'approved', approved_by: 'p', approved_at: '2026-10-14T00:00:00Z',
      clinical_summary: 'Solo nota interna', athlete_summary: null,
    }));
    const response = await publish(new Request('http://localhost') as never, { params: Promise.resolve({ id: 'assessment-1' }) });
    expect(response.status).toBe(409);
    expect(updatesTo('psych_assessments')).toEqual([]);
  });
});

describe('athlete published results', () => {
  it('never selects the confidential note, answers, raw scores or bands', () => {
    for (const columns of [ATHLETE_RESULT_COLUMNS, ATHLETE_INTERPRETATION_COLUMNS]) {
      expect(columns).not.toMatch(/clinical_summary|raw_score|raw_value|band/);
    }
  });

  it('returns only approved, published results with their athlete summary and interpretations', async () => {
    state.admin = createSupabaseChain((query) => {
      if (query.table === 'psych_assessments') {
        return { data: [{
          id: 'assessment-1',
          completed_at: '2026-10-10T15:00:00Z',
          published_at: '2026-10-12T15:00:00Z',
          athlete_summary: 'Vas muy bien.',
          psych_instruments: { code: 'SCAT', name: 'SCAT' },
        }] };
      }
      return { data: [
        { assessment_id: 'assessment-1', subscale_code: 'trait_competitive_anxiety', interpretation_text: 'Practica respiración.' },
        { assessment_id: 'assessment-1', subscale_code: 'other', interpretation_text: '  ' },
      ] };
    });

    const results = await getAthletePublishedResults('profile-athlete-1');

    const assessmentsQuery = state.admin.queries.find((query) => query.table === 'psych_assessments')!;
    expect(hasCall(assessmentsQuery, 'eq', 'status', 'approved')).toBe(true);
    expect(hasCall(assessmentsQuery, 'eq', 'published_to_athlete', true)).toBe(true);
    expect(hasCall(assessmentsQuery, 'eq', 'athlete_id', 'profile-athlete-1')).toBe(true);
    expect(results).toEqual([expect.objectContaining({
      instrumentCode: 'SCAT',
      summary: 'Vas muy bien.',
      interpretations: [{ subscaleCode: 'trait_competitive_anxiety', text: 'Practica respiración.' }],
    })]);
  });

  it('feeds the mobile history from the athlete summary, not the confidential note', () => {
    const sql = readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261015000001_psych_athlete_summary.sql'), 'utf8');
    const body = sql.slice(sql.indexOf('AS $$'));
    expect(body).toMatch(/assessment\.athlete_summary\n/);
    expect(body).not.toMatch(/assessment\.clinical_summary/);
  });
});

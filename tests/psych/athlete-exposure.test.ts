/**
 * Athletes must not receive scores, bands, or the scoring key before clinical
 * review. Covers the questionnaire route, the responses route (including test
 * runs), and the web questionnaire component.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseChain, hasCall, type RecordedQuery, type QueryResult } from './supabase-chain';

const { state } = vi.hoisted(() => ({
  state: {
    admin: null as ReturnType<typeof import('./supabase-chain').createSupabaseChain> | null,
    user: null as ReturnType<typeof import('./supabase-chain').createSupabaseChain> | null,
  },
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (table: string) => state.admin!.from(table) },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'auth-athlete-1' } }, error: null }) },
    from: (table: string) => state.user!.from(table),
  }),
}));

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { GET as getQuestionnaire } from '@/app/api/psych/assessments/[id]/questionnaire/route';
import { POST as postResponses } from '@/app/api/psych/assessments/[id]/responses/route';
import { ATHLETE_ITEM_COLUMNS } from '@/lib/psych/questionnaire';

const OPTIONS = [{ value: '1', label: 'Casi nunca' }, { value: '2', label: 'A veces' }, { value: '3', label: 'A menudo' }];
const SCAT_ITEMS = Array.from({ length: 10 }, (_, index) => ({
  item_code: `SCAT-${index + 1}`,
  item_order: index + 1,
  prompt_text: `Reactivo ${index + 1}`,
  response_options: OPTIONS,
  subscale_code: 'trait_competitive_anxiety',
  is_reverse_scored: false,
}));
const SCAT_INSTRUMENT = {
  id: 'instrument-scat',
  code: 'SCAT',
  name: 'SCAT',
  item_count: SCAT_ITEMS.length,
  is_active: true,
  is_test_only: false,
  license_status: 'licensed',
  scoring_mode: 'automated',
};
// Every answer at the maximum yields the "ansiedad competitiva alta" band.
const HIGH_ANXIETY_RESPONSES = SCAT_ITEMS.map((item) => ({ item_code: item.item_code, raw_value: '3' }));

function adminResolver(isTestRun: boolean) {
  return (query: RecordedQuery): QueryResult => {
    switch (query.table) {
      case 'profiles':
        return { data: { id: 'profile-athlete-1', email: 'coach@example.com', first_name: 'Ana', last_name: 'López' } };
      case 'psych_assessments':
        return {
          data: {
            id: 'assessment-1',
            is_test_run: isTestRun,
            athlete_id: 'profile-athlete-1',
            instrument_id: SCAT_INSTRUMENT.id,
            scheduled_by: null,
            scheduled_for: null,
            psych_instruments: SCAT_INSTRUMENT,
          },
        };
      case 'psych_instrument_items':
        return { data: SCAT_ITEMS };
      case 'psych_responses':
        return { data: [] };
      default:
        return { data: null };
    }
  };
}

function postRequest(body: unknown) {
  return new Request('http://localhost/api/psych/assessments/assessment-1/responses', {
    method: 'POST',
    headers: { authorization: 'Bearer athlete-token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: 'assessment-1' }) };

function expectNoScoringData(body: unknown) {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain('"scores"');
  expect(serialized).not.toContain('ansiedad competitiva');
  expect(serialized).not.toContain('subscale_code');
  expect(serialized).not.toContain('is_reverse_scored');
}

describe('athlete-facing psych data', () => {
  beforeEach(() => {
    state.user = createSupabaseChain(() => ({ data: null, error: null }));
  });

  it('limits item columns sent to athletes to the prompt and options', () => {
    expect(ATHLETE_ITEM_COLUMNS).not.toMatch(/subscale_code|is_reverse_scored/);
  });

  it('serves the questionnaire without the scoring key', async () => {
    state.admin = createSupabaseChain((query) => {
      if (query.table === 'psych_instrument_items') {
        // Return only the columns that were actually requested.
        const columns = String(query.calls.find((call) => call.method === 'select')?.args[0]).split(', ');
        return { data: SCAT_ITEMS.map((item) => Object.fromEntries(columns.map((column) => [column, item[column as keyof typeof item]]))) };
      }
      return adminResolver(false)(query);
    });

    const response = await getQuestionnaire(
      new Request('http://localhost', { headers: { authorization: 'Bearer athlete-token' } }) as never,
      params,
    );

    expect(response.status).toBe(200);
    const itemsQuery = state.admin.queries.find((query) => query.table === 'psych_instrument_items')!;
    expect(hasCall(itemsQuery, 'select', ATHLETE_ITEM_COLUMNS)).toBe(true);
    expectNoScoringData(await response.json());
  });

  it('does not return scores when an athlete completes a real assessment', async () => {
    state.admin = createSupabaseChain(adminResolver(false));

    const response = await postResponses(postRequest({ responses: HIGH_ANXIETY_RESPONSES }) as never, params);

    expect(response.status).toBe(200);
    expectNoScoringData(await response.json());
    // Scores are still persisted for the clinical team.
    expect(state.admin.queries.some((query) => query.table === 'psych_scores' && query.calls.some((call) => call.method === 'upsert'))).toBe(true);
  });

  it('does not return scores for test runs either', async () => {
    state.admin = createSupabaseChain(adminResolver(true));

    const response = await postResponses(postRequest({ responses: HIGH_ANXIETY_RESPONSES }) as never, params);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.isTestRun).toBe(true);
    expectNoScoringData(body);
  });

  it('lists answered tests for the athlete without scores, bands or summaries', () => {
    const source = readFileSync(path.resolve(__dirname, '../../lib/psych/athlete-overview.ts'), 'utf8');
    expect(source).toContain("select('id, completed_at, psych_instruments!inner(name, is_test_only)')");
    expect(source).not.toMatch(/psych_scores|clinical_summary|raw_score|raw_value|band/);
  });

  it('keeps the web questionnaire free of client-side scoring', () => {
    const source = readFileSync(path.resolve(__dirname, '../../components/psych/PsychQuestionnaire.tsx'), 'utf8');
    expect(source).not.toMatch(/lib\/psych\/scoring|calculatePsychScores|subscale_code|is_reverse_scored/);
  });
});

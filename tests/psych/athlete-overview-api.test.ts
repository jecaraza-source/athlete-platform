/**
 * GET /api/psych/me serves the mobile app the athlete's own pending tests
 * (with the completion window), answered tests and published results. It must
 * require a bearer token and never return answers, scores, bands or the
 * confidential clinical note.
 */

import { describe, expect, it, vi } from 'vitest';
import { createSupabaseChain, hasCall, type RecordedQuery } from './supabase-chain';

const { state } = vi.hoisted(() => ({
  state: { admin: null as ReturnType<typeof import('./supabase-chain').createSupabaseChain> | null },
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (table: string) => state.admin!.from(table) },
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'auth-athlete-1' } }, error: null }) },
  }),
}));

import { GET } from '@/app/api/psych/me/route';

function resolve(query: RecordedQuery) {
  if (query.table === 'profiles') return { data: { id: 'profile-athlete-1' } };
  if (query.table === 'psych_scores') {
    return { data: [{ assessment_id: 'published-1', subscale_code: 'trait_competitive_anxiety', interpretation_text: 'Practica respiración.' }] };
  }
  const select = String(query.calls.find((call) => call.method === 'select')?.args[0]);
  if (hasCall(query, 'eq', 'status', 'pending')) {
    return { data: [{ id: 'pending-1', created_at: '2026-10-14T15:00:00.000Z', scheduled_for: null, psych_instruments: { name: 'ABQ' } }] };
  }
  if (select.includes('athlete_summary')) {
    return { data: [{ id: 'published-1', completed_at: '2026-10-10T15:00:00Z', published_at: '2026-10-12T15:00:00Z', athlete_summary: 'Vas muy bien.', psych_instruments: { code: 'SCAT', name: 'SCAT' } }] };
  }
  return { data: [{ id: 'answered-1', completed_at: '2026-10-09T15:00:00Z', psych_instruments: { name: 'SMTQ' } }] };
}

const request = (headers: Record<string, string> = {}) => new Request('http://localhost/api/psych/me', { headers }) as never;

describe('GET /api/psych/me', () => {
  it('requires a bearer token', async () => {
    state.admin = createSupabaseChain(resolve);
    expect((await GET(request())).status).toBe(401);
  });

  it("returns only the signed-in athlete's pending, answered and published tests", async () => {
    state.admin = createSupabaseChain(resolve);

    const response = await GET(request({ authorization: 'Bearer athlete-token' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.completionWindowDays).toBe(5);
    expect(body.pending).toEqual([expect.objectContaining({ id: 'pending-1', instrumentName: 'ABQ', dueAt: '2026-10-19T15:00:00.000Z' })]);
    expect(body.answered).toEqual([{ id: 'answered-1', instrumentName: 'SMTQ', completedAt: '2026-10-09T15:00:00Z' }]);
    expect(body.results).toEqual([expect.objectContaining({ instrumentCode: 'SCAT', summary: 'Vas muy bien.' })]);

    for (const query of state.admin.queries.filter((q) => q.table === 'psych_assessments')) {
      expect(hasCall(query, 'eq', 'athlete_id', 'profile-athlete-1')).toBe(true);
    }
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/clinical_summary|raw_score|raw_value|"band"/);
    const selects = state.admin.queries.flatMap((q) => q.calls.filter((c) => c.method === 'select').map((c) => String(c.args[0])));
    for (const select of selects) expect(select).not.toMatch(/clinical_summary|raw_score|raw_value|band/);
  });
});

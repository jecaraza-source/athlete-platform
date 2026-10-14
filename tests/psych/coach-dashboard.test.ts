/**
 * The coach psychological dashboard must list clinically approved assessments.
 * The legacy 'completed' status is no longer produced, so filtering on it left
 * the dashboard permanently empty and bypassed the approval gate's intent.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseChain, hasCall, type RecordedQuery } from './supabase-chain';

const { state } = vi.hoisted(() => ({
  state: { admin: null as ReturnType<typeof import('./supabase-chain').createSupabaseChain> | null },
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (table: string) => state.admin!.from(table) },
}));

vi.mock('@/lib/rbac/server', () => ({
  requireAuthenticated: async () => ({
    profile: { id: 'profile-coach-1' },
    roles: [{ code: 'coach' }],
    permissions: new Set(['psych.read_interpreted']),
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
}));

import CoachPsychDashboardPage from '@/app/[locale]/(app)/dashboard/coach/psych/page';

function resolve(query: RecordedQuery) {
  switch (query.table) {
    case 'psych_coach_athlete_assignments':
      return { data: [{ athlete_profile_id: 'profile-athlete-1' }] };
    case 'profiles':
      return { data: [{ id: 'profile-athlete-1', first_name: 'Ana', last_name: 'López' }] };
    case 'psych_assessments':
      return {
        data: [{
          id: 'assessment-1',
          athlete_id: 'profile-athlete-1',
          completed_at: '2026-10-10T15:00:00.000Z',
          psych_instruments: { name: 'SCAT' },
        }],
      };
    default:
      return { data: [] };
  }
}

describe('coach psychological dashboard', () => {
  it('reads only approved assessments for the roster', async () => {
    state.admin = createSupabaseChain(resolve);

    await CoachPsychDashboardPage();

    const assessmentsQuery = state.admin.queries.find((query) => query.table === 'psych_assessments')!;
    expect(hasCall(assessmentsQuery, 'eq', 'status', 'approved')).toBe(true);
    expect(hasCall(assessmentsQuery, 'eq', 'status', 'completed')).toBe(false);
    // Scores are then fetched for the approved assessment found.
    const scoresQuery = state.admin.queries.find((query) => query.table === 'psych_scores')!;
    expect(hasCall(scoresQuery, 'in', 'assessment_id', ['assessment-1'])).toBe(true);
  });

  it('restricts direct coach reads and item reads at the RLS layer', () => {
    const sql = readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20261014000001_restrict_psych_item_and_coach_reads.sql'),
      'utf8',
    );
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Authenticated users can read psych instrument items"/);
    expect(sql).not.toMatch(/USING \(true\)/);
    const coachPolicies = sql.split('CREATE POLICY').filter((policy) => policy.trimStart().startsWith('"Coaches can read roster'));
    expect(coachPolicies).toHaveLength(2);
    for (const policy of coachPolicies) expect(policy).toMatch(/status = 'approved'/);
  });
});

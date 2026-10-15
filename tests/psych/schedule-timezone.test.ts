/**
 * Scheduling dates come from a datetime-local input, which has no offset.
 * They must be read as Mexico City time even though Vercel runs in UTC;
 * otherwise assessments open six hours early.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMXLocalDateTime } from '@/lib/timezone';
import { createSupabaseChain, type RecordedQuery } from './supabase-chain';

const { state } = vi.hoisted(() => ({
  state: { admin: null as ReturnType<typeof import('./supabase-chain').createSupabaseChain> | null },
}));

vi.mock('next-intl/server', async () => (await import('./next-intl-mock')).nextIntlServerMock);

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (table: string) => state.admin!.from(table) },
}));

vi.mock('@/lib/rbac/server', () => ({
  getCurrentUser: async () => ({
    profile: { id: 'profile-psych-1' },
    roles: [{ code: 'mental_health_admin' }],
    permissions: new Set(['psych.schedule_assessments']),
  }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { schedulePsychAssessment } from '@/app/[locale]/(app)/dashboard/mental-health/actions';

describe('parseMXLocalDateTime', () => {
  it('reads naive values as Mexico City wall-clock time (UTC-6)', () => {
    expect(parseMXLocalDateTime('2026-10-15T09:00')?.toISOString()).toBe('2026-10-15T15:00:00.000Z');
    expect(parseMXLocalDateTime('2026-01-05T23:30:15')?.toISOString()).toBe('2026-01-06T05:30:15.000Z');
  });

  it('applies the historical daylight-saving offset (UTC-5) before 2023', () => {
    expect(parseMXLocalDateTime('2022-07-01T09:00')?.toISOString()).toBe('2022-07-01T14:00:00.000Z');
  });

  it('rejects malformed, impossible, and skipped wall-clock values', () => {
    expect(parseMXLocalDateTime('')).toBeNull();
    expect(parseMXLocalDateTime('mañana')).toBeNull();
    expect(parseMXLocalDateTime('2026-10-15T09:00:00Z')).toBeNull();
    expect(parseMXLocalDateTime('2026-02-30T10:00')).toBeNull();
    expect(parseMXLocalDateTime('2026-10-15T24:30')).toBeNull();
    // 02:30 did not exist on the 2020 spring-forward day.
    expect(parseMXLocalDateTime('2020-04-05T02:30')).toBeNull();
  });
});

describe('schedulePsychAssessment', () => {
  let insertedRows: unknown[];

  beforeEach(() => {
    insertedRows = [];
    state.admin = createSupabaseChain((query: RecordedQuery) => {
      const insert = query.calls.find((call) => call.method === 'insert');
      if (insert && query.table === 'psych_assessments') insertedRows.push(insert.args[0]);
      switch (query.table) {
        case 'profiles':
          return { data: { id: 'profile-athlete-1', first_name: 'Ana', email: 'ana@example.com' } };
        case 'psych_instruments':
          return { data: { id: 'instrument-1', name: 'SCAT', item_count: 10 } };
        case 'psych_instrument_items':
          return { count: 10 };
        case 'psych_assessments':
          return { data: { id: 'assessment-1' } };
        default:
          return { data: [] };
      }
    });
  });

  it('stores the scheduled time converted from Mexico City to UTC', async () => {
    const result = await schedulePsychAssessment({
      athleteId: 'profile-athlete-1',
      instrumentId: 'instrument-1',
      scheduledFor: '2026-10-15T09:00',
    });

    expect(result).toEqual({});
    expect(insertedRows).toEqual([expect.objectContaining({ scheduled_for: '2026-10-15T15:00:00.000Z' })]);
  });

  it('rejects an invalid date without creating an assessment', async () => {
    const result = await schedulePsychAssessment({
      athleteId: 'profile-athlete-1',
      instrumentId: 'instrument-1',
      scheduledFor: '2026-02-30T10:00',
    });

    expect(result.error).toBeTruthy();
    expect(insertedRows).toEqual([]);
  });
});

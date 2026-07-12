/**
 * Unit tests for services/plans.ts
 *
 * Covers: getPublishedPlansForAthlete (with athleteId, without athleteId,
 *         edge cases) and getPlanFileUrl.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeChain } from '../helpers';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from:    vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

import {
  getPublishedPlansForAthlete,
  getPlanFileUrl,
} from '@/services/plans';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ATHLETE_ID = 'ath-001';

const PLAN_A = {
  id: 'plan-001',
  type: 'medical',
  title: 'Plan médico 2025',
  description: 'Evaluación inicial',
  file_path: 'plans/plan-001.pdf',
  file_name: 'plan-001.pdf',
  is_published: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const PLAN_B = {
  ...PLAN_A,
  id: 'plan-002',
  type: 'nutrition',
  title: 'Plan nutricional 2025',
  file_path: 'plans/plan-002.pdf',
  file_name: 'plan-002.pdf',
};

beforeEach(() => vi.clearAllMocks());

// ===========================================================================
// getPublishedPlansForAthlete — with athleteId
// ===========================================================================

describe('getPublishedPlansForAthlete (with athleteId)', () => {
  it('returns published plans via the junction table', async () => {
    vi.mocked(supabase.from)
      // athlete_plans: returns plan IDs
      .mockReturnValueOnce(
        makeChain({ data: [{ plan_id: 'plan-001' }, { plan_id: 'plan-002' }], error: null }) as never
      )
      // plans: returns plan rows filtered by those IDs
      .mockReturnValueOnce(
        makeChain({ data: [PLAN_A, PLAN_B], error: null }) as never
      );

    const result = await getPublishedPlansForAthlete(ATHLETE_ID);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('medical');
    expect(result[1].type).toBe('nutrition');
  });

  it('returns an empty array when the athlete has no plan assignments', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      makeChain({ data: [], error: null }) as never
    );

    const result = await getPublishedPlansForAthlete(ATHLETE_ID);

    expect(result).toEqual([]);
    // Should not query `plans` table when there are no plan IDs
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when the plans query fails', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        makeChain({ data: [{ plan_id: 'plan-001' }], error: null }) as never
      )
      .mockReturnValueOnce(
        makeChain({ data: null, error: { message: 'plans table missing' } }) as never
      );

    const result = await getPublishedPlansForAthlete(ATHLETE_ID);

    expect(result).toEqual([]);
  });

  it('falls back to RLS-only path when athlete_plans query fails', async () => {
    vi.mocked(supabase.from)
      // athlete_plans error → triggers fallback
      .mockReturnValueOnce(
        makeChain({ data: null, error: { message: 'connection refused' } }) as never
      )
      // plans fallback query
      .mockReturnValueOnce(
        makeChain({ data: [PLAN_A], error: null }) as never
      );

    const result = await getPublishedPlansForAthlete(ATHLETE_ID);

    expect(result).toHaveLength(1);
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(2);
  });
});

// ===========================================================================
// getPublishedPlansForAthlete — without athleteId (RLS fallback)
// ===========================================================================

describe('getPublishedPlansForAthlete (no athleteId — RLS fallback)', () => {
  it('queries plans directly and returns published ones', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [PLAN_A], error: null }) as never
    );

    const result = await getPublishedPlansForAthlete(null);

    expect(result).toHaveLength(1);
    expect(supabase.from).toHaveBeenCalledWith('plans');
  });

  it('returns an empty array when no published plans exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [], error: null }) as never
    );
    expect(await getPublishedPlansForAthlete(undefined)).toEqual([]);
  });

  it('returns an empty array on plans table error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'plans schema cache' } }) as never
    );
    expect(await getPublishedPlansForAthlete()).toEqual([]);
  });
});

// ===========================================================================
// getPlanFileUrl
// ===========================================================================

describe('getPlanFileUrl', () => {
  const FILE_PATH = 'plans/plan-001.pdf';

  function mockStorageBucket(result: { data: { signedUrl: string } | null; error: null | { message: string } }) {
    const bucketMock = {
      createSignedUrl: vi.fn().mockResolvedValue(result),
    };
    vi.mocked(supabase.storage.from).mockReturnValue(bucketMock as never);
  }

  it('returns a signed URL on success', async () => {
    mockStorageBucket({ data: { signedUrl: 'https://storage.example.com/signed/plan-001.pdf' }, error: null });

    const url = await getPlanFileUrl(FILE_PATH);

    expect(url).toBe('https://storage.example.com/signed/plan-001.pdf');
    expect(supabase.storage.from).toHaveBeenCalledWith('plans');
    const bucket = vi.mocked(supabase.storage.from).mock.results[0].value;
    expect(bucket.createSignedUrl).toHaveBeenCalledWith(FILE_PATH, 3600);
  });

  it('returns null on storage error', async () => {
    mockStorageBucket({ data: null, error: { message: 'not found' } });

    const url = await getPlanFileUrl(FILE_PATH);

    expect(url).toBeNull();
  });

  it('returns null when signedUrl is undefined', async () => {
    vi.mocked(supabase.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as never);

    expect(await getPlanFileUrl(FILE_PATH)).toBeNull();
  });
});

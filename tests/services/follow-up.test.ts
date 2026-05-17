/**
 * Unit tests for services/follow-up.ts
 *
 * Covers: listMedicalCases, listNutritionPlans, listPhysioCases,
 *         listPsychologyCases.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeChain } from '../helpers';

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import {
  listMedicalCases,
  listNutritionPlans,
  listPhysioCases,
  listPsychologyCases,
} from '@/services/follow-up';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ATHLETE_ID = 'ath-001';

const MEDICAL_CASE = {
  id: 'mc-001',
  status: 'open',
  opened_at: '2025-03-01T10:00:00Z',
  condition: 'Rodilla derecha',
  notes: 'Revisión pendiente.',
};

const NUTRITION_PLAN = {
  id: 'np-001',
  title: 'Plan de hidratación',
  start_date: '2025-04-01',
  end_date: null,
  status: 'active',
};

const PHYSIO_CASE = {
  id: 'pc-001',
  status: 'in_progress',
  opened_at: '2025-02-15T09:00:00Z',
  injuries: [{ injury_type: 'esguince' }],
};

const PSYCH_CASE = {
  id: 'psy-001',
  status: 'closed',
  opened_at: '2025-01-20T08:00:00Z',
  summary: 'Evaluación completada.',
};

beforeEach(() => vi.clearAllMocks());

// ===========================================================================
// listMedicalCases
// ===========================================================================

describe('listMedicalCases', () => {
  it('returns medical cases for the athlete', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [MEDICAL_CASE], error: null }) as never
    );

    const result = await listMedicalCases(ATHLETE_ID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('mc-001');
    expect(result[0].condition).toBe('Rodilla derecha');
  });

  it('returns an empty array when no cases exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [], error: null }) as never
    );
    expect(await listMedicalCases(ATHLETE_ID)).toEqual([]);
  });

  it('returns an empty array on DB error (does not throw)', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'timeout' } }) as never
    );
    expect(await listMedicalCases(ATHLETE_ID)).toEqual([]);
  });

  it('applies eq filter and limit', async () => {
    const chain = makeChain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listMedicalCases(ATHLETE_ID, 3);

    expect(chain.eq).toHaveBeenCalledWith('athlete_id', ATHLETE_ID);
    expect(chain.limit).toHaveBeenCalledWith(3);
  });

  it('defaults to limit 5', async () => {
    const chain = makeChain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listMedicalCases(ATHLETE_ID);

    expect(chain.limit).toHaveBeenCalledWith(5);
  });
});

// ===========================================================================
// listNutritionPlans
// ===========================================================================

describe('listNutritionPlans', () => {
  it('returns nutrition plans for the athlete', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [NUTRITION_PLAN], error: null }) as never
    );

    const result = await listNutritionPlans(ATHLETE_ID);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Plan de hidratación');
    expect(result[0].status).toBe('active');
  });

  it('returns an empty array when no plans exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [], error: null }) as never
    );
    expect(await listNutritionPlans(ATHLETE_ID)).toEqual([]);
  });

  it('returns an empty array on DB error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'query failed' } }) as never
    );
    expect(await listNutritionPlans(ATHLETE_ID)).toEqual([]);
  });

  it('applies eq + limit', async () => {
    const chain = makeChain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listNutritionPlans(ATHLETE_ID, 10);

    expect(chain.eq).toHaveBeenCalledWith('athlete_id', ATHLETE_ID);
    expect(chain.limit).toHaveBeenCalledWith(10);
  });
});

// ===========================================================================
// listPhysioCases
// ===========================================================================

describe('listPhysioCases', () => {
  it('returns physio cases with injury data', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [PHYSIO_CASE], error: null }) as never
    );

    const result = await listPhysioCases(ATHLETE_ID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('pc-001');
    expect(result[0].injuries).toEqual([{ injury_type: 'esguince' }]);
  });

  it('returns an empty array when no cases exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [], error: null }) as never
    );
    expect(await listPhysioCases(ATHLETE_ID)).toEqual([]);
  });

  it('returns an empty array on DB error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'physio error' } }) as never
    );
    expect(await listPhysioCases(ATHLETE_ID)).toEqual([]);
  });

  it('handles cases where injuries is null', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [{ ...PHYSIO_CASE, injuries: null }], error: null }) as never
    );

    const result = await listPhysioCases(ATHLETE_ID);
    expect(result[0].injuries).toBeNull();
  });
});

// ===========================================================================
// listPsychologyCases
// ===========================================================================

describe('listPsychologyCases', () => {
  it('returns psychology cases for the athlete', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [PSYCH_CASE], error: null }) as never
    );

    const result = await listPsychologyCases(ATHLETE_ID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('psy-001');
    expect(result[0].summary).toBe('Evaluación completada.');
  });

  it('returns an empty array when no cases exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [], error: null }) as never
    );
    expect(await listPsychologyCases(ATHLETE_ID)).toEqual([]);
  });

  it('returns an empty array on DB error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'psych error' } }) as never
    );
    expect(await listPsychologyCases(ATHLETE_ID)).toEqual([]);
  });

  it('applies eq + limit + order', async () => {
    const chain = makeChain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listPsychologyCases(ATHLETE_ID, 2);

    expect(chain.eq).toHaveBeenCalledWith('athlete_id', ATHLETE_ID);
    expect(chain.order).toHaveBeenCalledWith('opened_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(2);
  });
});

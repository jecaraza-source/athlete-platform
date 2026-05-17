/**
 * Unit tests for services/diagnostic.ts
 *
 * Covers: getIndividualPlans, upsertDiagnostic, updateSectionStatus,
 *         getDiagnostic, getDiagnosticSections, getSectionsByAthleteId,
 *         and all five evaluation getters.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeChain } from '../helpers';

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import {
  getIndividualPlans,
  upsertDiagnostic,
  updateSectionStatus,
  getDiagnostic,
  getDiagnosticSections,
  getSectionsByAthleteId,
  getMedicalEvaluation,
  getNutritionEvaluation,
  getPsychologyEvaluation,
  getCoachEvaluation,
  getPhysioEvaluation,
} from '@/services/diagnostic';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ATHLETE_ID    = 'ath-001';
const DIAGNOSTIC_ID = 'diag-001';
const SECTION_ID    = 'section-001';

const DIAGNOSTIC_ROW = {
  id:             DIAGNOSTIC_ID,
  athlete_id:     ATHLETE_ID,
  overall_status: 'pendiente',
  completion_pct: 0,
  is_baseline:    true,
  version:        1,
  created_at:     '2025-01-01T00:00:00Z',
  updated_at:     '2025-01-01T00:00:00Z',
  completed_at:   null,
};

const PLAN_ROW = {
  id:           'plan-001',
  diagnostic_id: DIAGNOSTIC_ID,
  athlete_id:   ATHLETE_ID,
  plan_type:    'medico',
  content:      'Evaluación pendiente.',
  created_at:   '2025-01-01T00:00:00Z',
  updated_at:   '2025-01-01T00:00:00Z',
};

const SECTION_ROW = {
  id:             'section-001',
  diagnostic_id:  DIAGNOSTIC_ID,
  athlete_id:     ATHLETE_ID,
  section:        'medico',
  status:         'completo',
  completion_pct: 100,
  captured_at:    '2025-01-01T00:00:00Z',
  updated_at:     '2025-01-01T00:00:00Z',
};

beforeEach(() => vi.clearAllMocks());

// ===========================================================================
// getIndividualPlans
// ===========================================================================

describe('getIndividualPlans', () => {
  it('returns plans for the given athlete', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [PLAN_ROW], error: null }) as never
    );

    const result = await getIndividualPlans(ATHLETE_ID);

    expect(result).toHaveLength(1);
    expect(result[0].plan_type).toBe('medico');
  });

  it('returns an empty array when no plans exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [], error: null }) as never
    );
    expect(await getIndividualPlans(ATHLETE_ID)).toEqual([]);
  });

  it('returns an empty array on DB error (logs warning, does not throw)', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'not found' } }) as never
    );
    expect(await getIndividualPlans(ATHLETE_ID)).toEqual([]);
  });
});

// ===========================================================================
// getDiagnostic
// ===========================================================================

describe('getDiagnostic', () => {
  it('returns the latest diagnostic when found', async () => {
    const chain = makeChain({ data: DIAGNOSTIC_ROW, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await getDiagnostic(ATHLETE_ID);

    expect(result).toMatchObject({ id: DIAGNOSTIC_ID, athlete_id: ATHLETE_ID });
    expect(chain.eq).toHaveBeenCalledWith('athlete_id', ATHLETE_ID);
    expect(chain.maybeSingle).toHaveBeenCalledOnce();
  });

  it('returns null when no diagnostic exists', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: null }) as never
    );
    expect(await getDiagnostic(ATHLETE_ID)).toBeNull();
  });

  it('throws when the DB returns an error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'DB error' } }) as never
    );
    await expect(getDiagnostic(ATHLETE_ID)).rejects.toMatchObject({ message: 'DB error' });
  });
});

// ===========================================================================
// getDiagnosticSections
// ===========================================================================

describe('getDiagnosticSections', () => {
  it('returns sections for the diagnostic', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [SECTION_ROW], error: null }) as never
    );

    const result = await getDiagnosticSections(DIAGNOSTIC_ID);

    expect(result).toHaveLength(1);
    expect(result[0].section).toBe('medico');
  });

  it('returns an empty array when no sections exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [], error: null }) as never
    );
    expect(await getDiagnosticSections(DIAGNOSTIC_ID)).toEqual([]);
  });

  it('throws when the DB returns an error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'sections error' } }) as never
    );
    await expect(getDiagnosticSections(DIAGNOSTIC_ID)).rejects.toMatchObject({
      message: 'sections error',
    });
  });
});

// ===========================================================================
// getSectionsByAthleteId
// ===========================================================================

describe('getSectionsByAthleteId', () => {
  it('returns sections filtered by athlete_id', async () => {
    const chain = makeChain({ data: [SECTION_ROW], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await getSectionsByAthleteId(ATHLETE_ID);

    expect(result).toHaveLength(1);
    expect(chain.eq).toHaveBeenCalledWith('athlete_id', ATHLETE_ID);
  });

  it('throws on DB error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'query failed' } }) as never
    );
    await expect(getSectionsByAthleteId(ATHLETE_ID)).rejects.toMatchObject({
      message: 'query failed',
    });
  });
});

// ===========================================================================
// upsertDiagnostic
// ===========================================================================

describe('upsertDiagnostic', () => {
  it('returns existing diagnostic without creating a new one', async () => {
    // First call (getDiagnosticByAthleteId) returns an existing row
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: DIAGNOSTIC_ROW, error: null }) as never
    );

    const result = await upsertDiagnostic(ATHLETE_ID);

    expect(result).toMatchObject({ id: DIAGNOSTIC_ID });
    // Should NOT call insert
    const chain = vi.mocked(supabase.from).mock.results[0].value;
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it('creates a new diagnostic when none exists', async () => {
    vi.mocked(supabase.from)
      // getDiagnosticByAthleteId → no existing record
      .mockReturnValueOnce(makeChain({ data: null, error: null }) as never)
      // insert call → new diagnostic row
      .mockReturnValueOnce(makeChain({ data: DIAGNOSTIC_ROW, error: null }) as never);

    const result = await upsertDiagnostic(ATHLETE_ID);

    expect(result).toMatchObject({ id: DIAGNOSTIC_ID, is_baseline: true });
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(2);
  });

  it('returns null when the insert fails', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: null, error: null }) as never)
      .mockReturnValueOnce(makeChain({ data: null, error: { message: 'insert failed' } }) as never);

    const result = await upsertDiagnostic(ATHLETE_ID);

    expect(result).toBeNull();
  });
});

// ===========================================================================
// updateSectionStatus
// ===========================================================================

describe('updateSectionStatus', () => {
  function mockUpdateSectionFlow(opts: {
    upsertError?: { message: string } | null;
    sections?: Array<{ status: string; completion_pct: number }>;
    overallUpdateError?: { message: string } | null;
  }) {
    const calls: string[] = [];
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      calls.push(table);
      const callIndex = calls.length;

      if (table === 'athlete_diagnostic_sections' && callIndex === 1) {
        // upsert call
        return makeChain({ error: opts.upsertError ?? null }) as never;
      }
      if (table === 'athlete_diagnostic_sections' && callIndex === 2) {
        // re-read all sections
        return makeChain({ data: opts.sections ?? [], error: null }) as never;
      }
      if (table === 'athlete_initial_diagnostic') {
        // update overall
        return makeChain({ error: opts.overallUpdateError ?? null }) as never;
      }
      return makeChain({ data: null, error: null }) as never;
    });
  }

  it('returns true on success', async () => {
    mockUpdateSectionFlow({
      sections: [{ status: 'completo', completion_pct: 100 }],
    });

    const result = await updateSectionStatus(
      DIAGNOSTIC_ID, ATHLETE_ID, 'medico', 'completo'
    );

    expect(result).toBe(true);
  });

  it('returns false when the upsert fails', async () => {
    mockUpdateSectionFlow({ upsertError: { message: 'upsert error' } });

    const result = await updateSectionStatus(
      DIAGNOSTIC_ID, ATHLETE_ID, 'medico', 'en_proceso'
    );

    expect(result).toBe(false);
  });

  it('calculates overall_status = completo when all 5 sections are complete', async () => {
    const allComplete = Array.from({ length: 5 }, () => ({
      status: 'completo',
      completion_pct: 100,
    }));

    const updateChain = makeChain({ error: null });
    let callCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      callCount++;
      if (table === 'athlete_diagnostic_sections' && callCount === 1) {
        return makeChain({ error: null }) as never;
      }
      if (table === 'athlete_diagnostic_sections' && callCount === 2) {
        return makeChain({ data: allComplete, error: null }) as never;
      }
      if (table === 'athlete_initial_diagnostic') {
        return updateChain as never;
      }
      return makeChain({ data: null, error: null }) as never;
    });

    await updateSectionStatus(DIAGNOSTIC_ID, ATHLETE_ID, 'medico', 'completo');

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ overall_status: 'completo' })
    );
  });

  it('sets completion_pct = 100 for "completo" status, 0 for "pendiente"', async () => {
    const upsertChain = makeChain({ error: null });
    let callCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      callCount++;
      if (table === 'athlete_diagnostic_sections' && callCount === 1) {
        return upsertChain as never;
      }
      if (table === 'athlete_diagnostic_sections' && callCount === 2) {
        return makeChain({ data: [], error: null }) as never;
      }
      return makeChain({ error: null }) as never;
    });

    await updateSectionStatus(DIAGNOSTIC_ID, ATHLETE_ID, 'medico', 'completo');
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ completion_pct: 100 }),
      expect.anything()
    );
  });
});

// ===========================================================================
// Evaluation getters (smoke tests — each getter delegates to maybeSingle)
// ===========================================================================

describe.each([
  { name: 'getMedicalEvaluation',      fn: getMedicalEvaluation,    table: 'athlete_medical_evaluation' },
  { name: 'getNutritionEvaluation',    fn: getNutritionEvaluation,  table: 'athlete_nutrition_evaluation' },
  { name: 'getPsychologyEvaluation',   fn: getPsychologyEvaluation, table: 'athlete_psychology_evaluation' },
  { name: 'getCoachEvaluation',        fn: getCoachEvaluation,      table: 'athlete_coach_evaluation' },
  { name: 'getPhysioEvaluation',       fn: getPhysioEvaluation,     table: 'athlete_physiotherapy_evaluation' },
])('$name', ({ fn, table }) => {
  it('queries the correct table and returns data', async () => {
    const evalData = { id: 'eval-001', diagnostic_section_id: SECTION_ID };
    const chain = makeChain({ data: evalData, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await fn(SECTION_ID);

    expect(supabase.from).toHaveBeenCalledWith(table);
    expect(chain.eq).toHaveBeenCalledWith('diagnostic_section_id', SECTION_ID);
    expect(chain.maybeSingle).toHaveBeenCalledOnce();
    expect(result).toEqual(evalData);
  });

  it('returns null when no evaluation exists', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: null }) as never
    );
    expect(await fn(SECTION_ID)).toBeNull();
  });

  it('throws when the DB returns an error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'eval error' } }) as never
    );
    await expect(fn(SECTION_ID)).rejects.toMatchObject({ message: 'eval error' });
  });
});

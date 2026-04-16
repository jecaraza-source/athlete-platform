/**
 * Unit tests for services/athletes.ts
 *
 * The Supabase client is fully mocked — no real DB connections are made.
 * All tests run in Node via Vitest.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeChain } from '../helpers';

// ---------------------------------------------------------------------------
// Mock @/lib/supabase BEFORE importing service functions (vi.mock is hoisted)
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { listAthletes, getAthlete, countAthletes } from '@/services/athletes';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ATHLETE_A = {
  id: 'ath-001',
  athlete_code: 'ATH-001',
  first_name: 'Ana',
  last_name: 'García',
  status: 'active',
  date_of_birth: '2000-05-20',
  sex: 'female',
  height_cm: 165,
  weight_kg: 60,
  dominant_side: 'right',
  school_or_club: 'Club ABC',
  discipline: 'atletismo',
  disability_status: 'sin_discapacidad',
  guardian_name: null,
  guardian_phone: null,
  guardian_email: null,
  emergency_contact_name: 'María García',
  emergency_contact_phone: '555-0001',
  medical_notes_summary: null,
  email: 'ana@example.com',
  profile_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const ATHLETE_B = { ...ATHLETE_A, id: 'ath-002', first_name: 'Carlos', last_name: 'López', status: 'inactive' };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => vi.clearAllMocks());

// ===========================================================================
// listAthletes
// ===========================================================================

describe('listAthletes', () => {
  it('returns an empty array when no athletes exist in the DB', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: [], error: null }) as never);
    const result = await listAthletes();
    expect(result).toEqual([]);
  });

  it('returns the athletes returned by the DB', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [ATHLETE_A, ATHLETE_B], error: null }) as never
    );
    const result = await listAthletes();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('ath-001');
    expect(result[1].first_name).toBe('Carlos');
  });

  it('throws when the DB returns an error', async () => {
    const dbErr = { message: 'connection refused', code: 'PGRST000' };
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: null, error: dbErr }) as never);
    await expect(listAthletes()).rejects.toMatchObject({ message: 'connection refused' });
  });

  it('adds an eq filter when status is provided', async () => {
    const chain = makeChain({ data: [ATHLETE_A], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listAthletes({ status: 'active' });

    expect(chain.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('adds an eq filter when discipline is provided', async () => {
    const chain = makeChain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listAthletes({ discipline: 'natacion' });

    expect(chain.eq).toHaveBeenCalledWith('discipline', 'natacion');
  });

  it('adds an OR filter when search is provided', async () => {
    const chain = makeChain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listAthletes({ search: 'Ana' });

    expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('%Ana%'));
  });

  it('paginates using the correct range for page 0 (default)', async () => {
    const chain = makeChain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listAthletes({ page: 0, pageSize: 30 });

    expect(chain.range).toHaveBeenCalledWith(0, 29);
  });

  it('paginates correctly for page 2 with pageSize 10', async () => {
    const chain = makeChain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listAthletes({ page: 2, pageSize: 10 });

    expect(chain.range).toHaveBeenCalledWith(20, 29);
  });
});

// ===========================================================================
// getAthlete
// ===========================================================================

describe('getAthlete', () => {
  it('returns the athlete when found', async () => {
    const chain = makeChain({ data: ATHLETE_A, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await getAthlete('ath-001');

    expect(result).toMatchObject({ id: 'ath-001', first_name: 'Ana' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'ath-001');
    expect(chain.maybeSingle).toHaveBeenCalledOnce();
  });

  it('returns null when the athlete does not exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: null }) as never
    );
    const result = await getAthlete('nonexistent-id');
    expect(result).toBeNull();
  });

  it('throws when the DB returns an error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'not found' } }) as never
    );
    await expect(getAthlete('bad-id')).rejects.toMatchObject({ message: 'not found' });
  });
});

// ===========================================================================
// countAthletes
// ===========================================================================

describe('countAthletes', () => {
  it('returns total and activos from two separate count queries', async () => {
    // First call to from('athletes') → total count
    // Second call to from('athletes') → activos count (status = active)
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ count: 20, error: null }) as never)
      .mockReturnValueOnce(makeChain({ count: 15, error: null }) as never);

    const result = await countAthletes();

    expect(result).toEqual({ total: 20, activos: 15 });
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(2);
  });

  it('falls back to 0 when count is null', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ count: null, error: null }) as never)
      .mockReturnValueOnce(makeChain({ count: null, error: null }) as never);

    const result = await countAthletes();

    expect(result).toEqual({ total: 0, activos: 0 });
  });
});

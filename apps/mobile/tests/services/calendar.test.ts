/**
 * Unit tests for services/calendar.ts
 *
 * Covers: createCalendarEvent, addEventParticipants, countEventsInRange,
 *         listEventsInRange, listEventsForAthlete.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeChain } from '../helpers';

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import {
  createCalendarEvent,
  addEventParticipants,
  countEventsInRange,
  listEventsInRange,
  listEventsForAthlete,
} from '@/services/calendar';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const START = '2025-06-01T00:00:00Z';
const END   = '2025-06-30T23:59:59Z';

const EVENT_A = {
  id: 'evt-001',
  title: 'Entrenamiento matutino',
  event_type: 'training',
  sport_id: null,
  start_at: '2025-06-10T08:00:00Z',
  end_at: '2025-06-10T10:00:00Z',
  status: 'scheduled',
  description: null,
  created_by_profile_id: 'profile-coach-001',
};

const EVENT_B = {
  ...EVENT_A,
  id: 'evt-002',
  title: 'Competencia regional',
  event_type: 'competition',
  start_at: '2025-06-20T09:00:00Z',
};

beforeEach(() => vi.clearAllMocks());

// ===========================================================================
// createCalendarEvent
// ===========================================================================

describe('createCalendarEvent', () => {
  it('inserts an event and returns { id }', async () => {
    const chain = makeChain({ data: { id: 'evt-new' }, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await createCalendarEvent({
      title: 'Test event',
      event_type: 'training',
      start_at: START,
      created_by_profile_id: 'profile-001',
    });

    expect(result).toEqual({ id: 'evt-new' });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test event', status: 'scheduled' })
    );
    expect(chain.single).toHaveBeenCalledOnce();
  });

  it('throws when the DB returns an error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'insert failed' } }) as never
    );
    await expect(
      createCalendarEvent({
        title: 'x',
        event_type: 'training',
        start_at: START,
        created_by_profile_id: 'p1',
      })
    ).rejects.toMatchObject({ message: 'insert failed' });
  });
});

// ===========================================================================
// addEventParticipants
// ===========================================================================

describe('addEventParticipants', () => {
  it('is a no-op when profileIds is empty', async () => {
    await addEventParticipants('evt-001', []);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('inserts one row per profile', async () => {
    const chain = makeChain({ error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await addEventParticipants('evt-001', ['p1', 'p2']);

    expect(chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ event_id: 'evt-001', participant_id: 'p1' }),
      expect.objectContaining({ event_id: 'evt-001', participant_id: 'p2' }),
    ]);
  });

  it('throws when the DB returns an error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'fk violation' } }) as never
    );
    await expect(addEventParticipants('evt-001', ['p1'])).rejects.toMatchObject({
      message: 'fk violation',
    });
  });
});

// ===========================================================================
// countEventsInRange
// ===========================================================================

describe('countEventsInRange', () => {
  it('returns the count from the DB', async () => {
    const chain = makeChain({ count: 12 });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await countEventsInRange(START, END);

    expect(result).toBe(12);
    expect(chain.gte).toHaveBeenCalledWith('start_at', START);
    expect(chain.lte).toHaveBeenCalledWith('start_at', END);
  });

  it('falls back to 0 when count is null', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ count: null }) as never
    );
    expect(await countEventsInRange(START, END)).toBe(0);
  });
});

// ===========================================================================
// listEventsInRange
// ===========================================================================

describe('listEventsInRange', () => {
  it('returns events with an empty participants array', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [EVENT_A, EVENT_B], error: null }) as never
    );

    const result = await listEventsInRange(START, END);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('evt-001');
    expect(result[0].participants).toEqual([]);
    expect(result[1].participants).toEqual([]);
  });

  it('returns an empty array when the DB returns no rows', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [], error: null }) as never
    );
    expect(await listEventsInRange(START, END)).toEqual([]);
  });

  it('returns an empty array on DB error (logs warning but does not throw)', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'connection timeout' } }) as never
    );
    const result = await listEventsInRange(START, END);
    expect(result).toEqual([]);
  });

  it('applies gte + lte filters on start_at', async () => {
    const chain = makeChain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listEventsInRange(START, END);

    expect(chain.gte).toHaveBeenCalledWith('start_at', START);
    expect(chain.lte).toHaveBeenCalledWith('start_at', END);
  });
});

// ===========================================================================
// listEventsForAthlete
// ===========================================================================

describe('listEventsForAthlete', () => {
  const ATHLETE_PROFILE_ID = 'profile-athlete-001';

  it('returns an empty array when there are no events in the range', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [], error: null }) as never
    );
    expect(await listEventsForAthlete(ATHLETE_PROFILE_ID, START, END)).toEqual([]);
  });

  it('returns an empty array on events fetch error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'db error' } }) as never
    );
    expect(await listEventsForAthlete(ATHLETE_PROFILE_ID, START, END)).toEqual([]);
  });

  it('includes global events (events with no participants)', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'events') {
        return makeChain({ data: [EVENT_A], error: null }) as never;
      }
      if (table === 'event_participants') {
        // No participant rows → EVENT_A is a global event
        return makeChain({ data: [], error: null }) as never;
      }
      return makeChain({ data: [], error: null }) as never;
    });

    const result = await listEventsForAthlete(ATHLETE_PROFILE_ID, START, END);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('evt-001');
  });

  it('includes events where the athlete is an explicit participant', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'events') {
        return makeChain({ data: [EVENT_A, EVENT_B], error: null }) as never;
      }
      if (table === 'event_participants') {
        return makeChain({
          data: [
            // Both events have participants; athlete is only in EVENT_A
            { event_id: 'evt-001', participant_id: ATHLETE_PROFILE_ID },
            { event_id: 'evt-002', participant_id: 'profile-other-001' },
          ],
          error: null,
        }) as never;
      }
      return makeChain({ data: [], error: null }) as never;
    });

    const result = await listEventsForAthlete(ATHLETE_PROFILE_ID, START, END);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('evt-001');
  });

  it('excludes events that have participants but athlete is not among them', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'events') {
        return makeChain({ data: [EVENT_A], error: null }) as never;
      }
      if (table === 'event_participants') {
        return makeChain({
          data: [{ event_id: 'evt-001', participant_id: 'profile-other-999' }],
          error: null,
        }) as never;
      }
      return makeChain({ data: [], error: null }) as never;
    });

    const result = await listEventsForAthlete(ATHLETE_PROFILE_ID, START, END);

    expect(result).toHaveLength(0);
  });

  it('mixes global events and athlete-specific events correctly', async () => {
    // EVENT_A: global (no participants)
    // EVENT_B: has participants and athlete is one of them
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'events') {
        return makeChain({ data: [EVENT_A, EVENT_B], error: null }) as never;
      }
      if (table === 'event_participants') {
        return makeChain({
          data: [{ event_id: 'evt-002', participant_id: ATHLETE_PROFILE_ID }],
          error: null,
        }) as never;
      }
      return makeChain({ data: [], error: null }) as never;
    });

    const result = await listEventsForAthlete(ATHLETE_PROFILE_ID, START, END);

    expect(result).toHaveLength(2);
    const ids = result.map((e) => e.id);
    expect(ids).toContain('evt-001'); // global
    expect(ids).toContain('evt-002'); // explicit participant
  });
});

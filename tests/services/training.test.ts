/**
 * Unit tests for services/training.ts
 *
 * Covers: listTrainingSessions, createTrainingSession,
 *         updateSessionFeedback, deleteTrainingSession.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeChain } from '../helpers';

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import {
  listTrainingSessions,
  createTrainingSession,
  updateSessionFeedback,
  deleteTrainingSession,
} from '@/services/training';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ATHLETE_ID = 'ath-001';
const SESSION_ID = 'sess-001';

const SESSION_A = {
  id:              SESSION_ID,
  athlete_id:      ATHLETE_ID,
  session_date:    '2025-04-10',
  title:           'Entrenamiento de fuerza',
  location:        'Gimnasio principal',
  start_time:      '08:00',
  end_time:        '09:30',
  notes:           'Alta intensidad',
  athlete_comment: null,
  is_done:         false,
  created_at:      '2025-04-09T12:00:00Z',
};

const SESSION_B = {
  ...SESSION_A,
  id:           'sess-002',
  session_date: '2025-04-11',
  title:        'Entrenamiento de velocidad',
  is_done:      true,
};

beforeEach(() => vi.clearAllMocks());

// ===========================================================================
// listTrainingSessions
// ===========================================================================

describe('listTrainingSessions', () => {
  it('returns sessions for the athlete, most recent first', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [SESSION_B, SESSION_A], error: null }) as never
    );

    const result = await listTrainingSessions(ATHLETE_ID);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('sess-002');
  });

  it('returns an empty array when no sessions exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [], error: null }) as never
    );
    expect(await listTrainingSessions(ATHLETE_ID)).toEqual([]);
  });

  it('throws when the DB returns an error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'table not found' } }) as never
    );
    await expect(listTrainingSessions(ATHLETE_ID)).rejects.toMatchObject({
      message: 'table not found',
    });
  });

  it('applies eq filter, descending order, and limit 50', async () => {
    const chain = makeChain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listTrainingSessions(ATHLETE_ID);

    expect(chain.eq).toHaveBeenCalledWith('athlete_id', ATHLETE_ID);
    expect(chain.order).toHaveBeenCalledWith('session_date', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(50);
  });
});

// ===========================================================================
// createTrainingSession
// ===========================================================================

describe('createTrainingSession', () => {
  it('inserts a session and returns the created row', async () => {
    const chain = makeChain({ data: SESSION_A, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await createTrainingSession({
      athlete_id:   ATHLETE_ID,
      session_date: '2025-04-10',
      title:        'Entrenamiento de fuerza',
      location:     'Gimnasio principal',
    });

    expect(result.id).toBe(SESSION_ID);
    expect(result.athlete_id).toBe(ATHLETE_ID);
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ athlete_id: ATHLETE_ID, title: 'Entrenamiento de fuerza' })
    );
    expect(chain.single).toHaveBeenCalledOnce();
  });

  it('throws when the insert fails', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'insert error' } }) as never
    );
    await expect(
      createTrainingSession({ athlete_id: ATHLETE_ID, session_date: '2025-04-10', title: 'x' })
    ).rejects.toMatchObject({ message: 'insert error' });
  });

  it('includes optional fields when provided', async () => {
    const chain = makeChain({ data: SESSION_A, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await createTrainingSession({
      athlete_id:       ATHLETE_ID,
      session_date:     '2025-04-10',
      title:            'Sesión de velocidad',
      coach_profile_id: 'coach-001',
      start_time:       '07:00',
      end_time:         '08:00',
      notes:            'Intervalos',
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        coach_profile_id: 'coach-001',
        start_time:       '07:00',
        notes:            'Intervalos',
      })
    );
  });
});

// ===========================================================================
// updateSessionFeedback
// ===========================================================================

describe('updateSessionFeedback', () => {
  it('updates athlete_comment on the session', async () => {
    const chain = makeChain({ error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await updateSessionFeedback(SESSION_ID, { athlete_comment: 'Me cansé mucho.' });

    expect(chain.update).toHaveBeenCalledWith({ athlete_comment: 'Me cansé mucho.' });
    expect(chain.eq).toHaveBeenCalledWith('id', SESSION_ID);
  });

  it('updates is_done flag to true', async () => {
    const chain = makeChain({ error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await updateSessionFeedback(SESSION_ID, { is_done: true });

    expect(chain.update).toHaveBeenCalledWith({ is_done: true });
  });

  it('updates both comment and is_done in a single call', async () => {
    const chain = makeChain({ error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await updateSessionFeedback(SESSION_ID, {
      athlete_comment: 'Buen entrenamiento',
      is_done: true,
    });

    expect(chain.update).toHaveBeenCalledWith({
      athlete_comment: 'Buen entrenamiento',
      is_done: true,
    });
  });

  it('throws when the DB update fails', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'update failed' } }) as never
    );
    await expect(
      updateSessionFeedback(SESSION_ID, { is_done: true })
    ).rejects.toMatchObject({ message: 'update failed' });
  });

  it('clears the comment when athlete_comment is null', async () => {
    const chain = makeChain({ error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await updateSessionFeedback(SESSION_ID, { athlete_comment: null });

    expect(chain.update).toHaveBeenCalledWith({ athlete_comment: null });
  });
});

// ===========================================================================
// deleteTrainingSession
// ===========================================================================

describe('deleteTrainingSession', () => {
  it('deletes the session without error', async () => {
    const chain = makeChain({ error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await expect(deleteTrainingSession(SESSION_ID)).resolves.toBeUndefined();

    expect(chain.delete).toHaveBeenCalledOnce();
    expect(chain.eq).toHaveBeenCalledWith('id', SESSION_ID);
  });

  it('throws when the DB delete fails', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'delete failed' } }) as never
    );
    await expect(deleteTrainingSession(SESSION_ID)).rejects.toMatchObject({
      message: 'delete failed',
    });
  });

  it('targets the correct table', async () => {
    const chain = makeChain({ error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await deleteTrainingSession(SESSION_ID);

    expect(supabase.from).toHaveBeenCalledWith('training_sessions');
  });
});

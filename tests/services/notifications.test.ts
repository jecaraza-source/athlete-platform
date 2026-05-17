/**
 * Unit tests for services/notifications.ts
 *
 * Covers: notifyProfiles, listPushNotifications,
 *         countPendingNotifications, markAllNotificationsAsRead.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeChain } from '../helpers';

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import {
  notifyProfiles,
  listPushNotifications,
  countPendingNotifications,
  markAllNotificationsAsRead,
  type NotifyOptions,
} from '@/services/notifications';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE_ID  = 'profile-001';
const PROFILE_IDS = ['profile-001', 'profile-002'];

const BASE_OPTS: NotifyOptions = {
  notifyPush:     true,
  notifyEmail:    false,
  entityType:     'event',
  entityId:       'evt-001',
  pushTitle:      'Nuevo evento',
  pushMessage:    'Se ha creado un entrenamiento.',
  emailSubject:   'Nuevo evento',
  emailHtmlBody:  '<p>Se ha creado un entrenamiento.</p>',
  emailPlainBody: 'Se ha creado un entrenamiento.',
};

const PUSH_JOB = {
  id: 'pj-001',
  recipient_profile_id: PROFILE_ID,
  title: 'Nuevo evento',
  message: 'Se ha creado un entrenamiento.',
  status: 'sent',
  read_at: null,
  created_at: '2025-05-01T10:00:00Z',
};

beforeEach(() => vi.clearAllMocks());

// ===========================================================================
// notifyProfiles
// ===========================================================================

describe('notifyProfiles', () => {
  it('is a no-op when profileIds is empty', async () => {
    await notifyProfiles([], BASE_OPTS);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('is a no-op when both notifyPush and notifyEmail are false', async () => {
    await notifyProfiles(PROFILE_IDS, { ...BASE_OPTS, notifyPush: false, notifyEmail: false });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('inserts push_jobs when notifyPush is true', async () => {
    const chain = makeChain({ error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await notifyProfiles(PROFILE_IDS, { ...BASE_OPTS, notifyPush: true, notifyEmail: false });

    expect(supabase.from).toHaveBeenCalledWith('push_jobs');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          recipient_profile_id: 'profile-001',
          title: 'Nuevo evento',
          status: 'sent',
        }),
        expect.objectContaining({ recipient_profile_id: 'profile-002' }),
      ])
    );
  });

  it('inserts one push_job row per profile', async () => {
    const chain = makeChain({ error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await notifyProfiles(PROFILE_IDS, BASE_OPTS);

    const insertCall = chain.insert.mock.calls[0][0];
    expect(insertCall).toHaveLength(PROFILE_IDS.length);
  });

  it('throws when push_jobs insert fails', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'push insert failed' } }) as never
    );
    await expect(notifyProfiles(PROFILE_IDS, BASE_OPTS)).rejects.toThrow('push: push insert failed');
  });

  it('inserts email_jobs when notifyEmail is true', async () => {
    vi.mocked(supabase.from)
      // profiles lookup
      .mockReturnValueOnce(
        makeChain({
          data: [
            { id: 'profile-001', email: 'a@test.com' },
            { id: 'profile-002', email: 'b@test.com' },
          ],
          error: null,
        }) as never
      )
      // email_jobs insert
      .mockReturnValueOnce(makeChain({ error: null }) as never);

    await notifyProfiles(PROFILE_IDS, {
      ...BASE_OPTS,
      notifyPush:  false,
      notifyEmail: true,
    });

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(supabase.from).toHaveBeenCalledWith('email_jobs');
  });

  it('throws when the email profiles lookup fails', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      makeChain({ data: null, error: { message: 'profiles error' } }) as never
    );
    await expect(
      notifyProfiles(PROFILE_IDS, { ...BASE_OPTS, notifyPush: false, notifyEmail: true })
    ).rejects.toThrow('email lookup: profiles error');
  });

  it('skips email_jobs insert when no profiles have emails', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      makeChain({ data: [{ id: 'profile-001', email: null }], error: null }) as never
    );

    // Should not throw or call email_jobs insert
    await notifyProfiles(PROFILE_IDS, {
      ...BASE_OPTS,
      notifyPush:  false,
      notifyEmail: true,
    });

    // email_jobs was never called
    expect(supabase.from).not.toHaveBeenCalledWith('email_jobs');
  });

  it('sends both push and email when both options are true', async () => {
    vi.mocked(supabase.from)
      // push_jobs
      .mockReturnValueOnce(makeChain({ error: null }) as never)
      // profiles lookup
      .mockReturnValueOnce(
        makeChain({ data: [{ id: 'profile-001', email: 'a@test.com' }], error: null }) as never
      )
      // email_jobs
      .mockReturnValueOnce(makeChain({ error: null }) as never);

    await notifyProfiles(['profile-001'], { ...BASE_OPTS, notifyPush: true, notifyEmail: true });

    expect(supabase.from).toHaveBeenCalledWith('push_jobs');
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(supabase.from).toHaveBeenCalledWith('email_jobs');
  });
});

// ===========================================================================
// listPushNotifications
// ===========================================================================

describe('listPushNotifications', () => {
  it('returns notifications for the profile', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [PUSH_JOB], error: null }) as never
    );

    const result = await listPushNotifications(PROFILE_ID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('pj-001');
  });

  it('returns an empty array when no notifications exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: [], error: null }) as never
    );
    expect(await listPushNotifications(PROFILE_ID)).toEqual([]);
  });

  it('throws when the DB returns an error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'DB error' } }) as never
    );
    await expect(listPushNotifications(PROFILE_ID)).rejects.toMatchObject({ message: 'DB error' });
  });

  it('applies eq filter, order, and limit', async () => {
    const chain = makeChain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await listPushNotifications(PROFILE_ID, 20);

    expect(chain.eq).toHaveBeenCalledWith('recipient_profile_id', PROFILE_ID);
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(20);
  });
});

// ===========================================================================
// countPendingNotifications
// ===========================================================================

describe('countPendingNotifications', () => {
  it('returns the count of unread notifications', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ count: 5, error: null }) as never
    );
    expect(await countPendingNotifications(PROFILE_ID)).toBe(5);
  });

  it('returns 0 when count is null', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ count: null, error: null }) as never
    );
    expect(await countPendingNotifications(PROFILE_ID)).toBe(0);
  });

  it('applies recipient_profile_id eq, status eq sent, and is read_at null', async () => {
    const chain = makeChain({ count: 0, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await countPendingNotifications(PROFILE_ID);

    expect(chain.eq).toHaveBeenCalledWith('recipient_profile_id', PROFILE_ID);
    expect(chain.eq).toHaveBeenCalledWith('status', 'sent');
    expect(chain.is).toHaveBeenCalledWith('read_at', null);
  });
});

// ===========================================================================
// markAllNotificationsAsRead
// ===========================================================================

describe('markAllNotificationsAsRead', () => {
  it('returns true on success', async () => {
    const chain = makeChain({ error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await markAllNotificationsAsRead(PROFILE_ID);

    expect(result).toBe(true);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ read_at: expect.any(String) })
    );
    expect(chain.eq).toHaveBeenCalledWith('recipient_profile_id', PROFILE_ID);
    expect(chain.is).toHaveBeenCalledWith('read_at', null);
  });

  it('returns false when the DB update fails', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'update failed' } }) as never
    );

    const result = await markAllNotificationsAsRead(PROFILE_ID);

    expect(result).toBe(false);
  });
});

/**
 * Unit tests for the athlete push-notification logic in confirmShow and
 * confirmNoShowRemote (medical/appointments/[eventId]/actions.ts).
 *
 * Before this fix, only confirmNoShow and confirmReschedule notified the
 * athlete; confirmShow and confirmNoShowRemote silently skipped it. These
 * tests cover the new behavior:
 *  - confirmShow sends a push when athleteProfileId + active tokens exist
 *  - confirmShow skips the push when athleteProfileId is null
 *  - confirmShow skips the push when there are no active device tokens
 *  - confirmNoShowRemote sends a push when athleteProfileId + tokens exist
 *  - confirmNoShowRemote skips the push when athleteProfileId is null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockFrom,
  mockGetCurrentUser,
  mockOneSignalSend,
} = vi.hoisted(() => ({
  mockFrom:           vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockOneSignalSend:  vi.fn(),
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock('@/lib/rbac/server', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/notifications/providers/onesignal-adapter', () => ({
  oneSignalAdapter: { send: mockOneSignalSend },
}));

import { confirmShow, confirmNoShowRemote } from '@/app/[locale]/(app)/medical/appointments/[eventId]/actions';

const MEDIC_USER = {
  authUserId: 'auth-medic-1',
  profile: { id: 'profile-medic-1' },
  roles: [{ id: 1, code: 'medic', name: 'Médico', description: null, is_system: true, created_at: '' }],
  permissions: new Set<string>(),
};

const TOKENS = [{ onesignal_player_id: 'player-athlete-1' }];

function setupSupabaseMock({ tokens = TOKENS as { onesignal_player_id: string }[] } = {}) {
  mockFrom.mockImplementation((table: string) => {
    switch (table) {
      case 'events':
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { event_type: 'medical' }, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      case 'event_participants':
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      case 'push_device_tokens':
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockResolvedValue({ data: tokens, error: null }),
              }),
            }),
          }),
        };
      default:
        return {};
    }
  });
}

describe('confirmShow / confirmNoShowRemote — athlete push notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
    mockGetCurrentUser.mockResolvedValue(MEDIC_USER);
    mockOneSignalSend.mockResolvedValue({ success: true, notification_id: null, error: null, raw: {} });
  });

  it('confirmShow sends a push when athleteProfileId has active tokens', async () => {
    const result = await confirmShow('evt-1', 'Consulta normal', 'profile-athlete-1');

    expect(result.error).toBeNull();
    expect(mockOneSignalSend).toHaveBeenCalledTimes(1);
    expect(mockOneSignalSend).toHaveBeenCalledWith(
      expect.objectContaining({ player_ids: ['player-athlete-1'] }),
    );
  });

  it('confirmShow skips the push when athleteProfileId is null', async () => {
    const result = await confirmShow('evt-1', 'Consulta normal', null);

    expect(result.error).toBeNull();
    expect(mockOneSignalSend).not.toHaveBeenCalled();
  });

  it('confirmShow skips the push when there are no active device tokens', async () => {
    setupSupabaseMock({ tokens: [] });

    const result = await confirmShow('evt-1', 'Consulta normal', 'profile-athlete-1');

    expect(result.error).toBeNull();
    expect(mockOneSignalSend).not.toHaveBeenCalled();
  });

  it('confirmNoShowRemote sends a push when athleteProfileId has active tokens', async () => {
    const result = await confirmNoShowRemote('evt-1', 'llamada', 'Se le llamó por tel.', 'profile-athlete-1');

    expect(result.error).toBeNull();
    expect(mockOneSignalSend).toHaveBeenCalledTimes(1);
    expect(mockOneSignalSend).toHaveBeenCalledWith(
      expect.objectContaining({ player_ids: ['player-athlete-1'] }),
    );
  });

  it('confirmNoShowRemote skips the push when athleteProfileId is null', async () => {
    const result = await confirmNoShowRemote('evt-1', 'llamada', 'Se le llamó por tel.', null);

    expect(result.error).toBeNull();
    expect(mockOneSignalSend).not.toHaveBeenCalled();
  });
});

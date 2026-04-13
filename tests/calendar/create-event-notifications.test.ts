/**
 * Unit tests for the participant notification logic inside createEvent().
 *
 * Strategy: mock all external collaborators (Supabase, RBAC, email service,
 * push adapter, Next.js cache) and assert that sendEmailDirect /
 * oneSignalAdapter.send are called—or NOT called—under each scenario.
 *
 * Key scenarios covered:
 *  - No participants selected → no notifications regardless of checkboxes
 *  - Participants present, neither checkbox checked → no notifications
 *  - notify_email=on → one sendEmailDirect call per athlete with an email
 *  - notify_email=on, athlete has no email → that athlete is skipped
 *  - notify_push=on → single batch send to all active device player IDs
 *  - notify_push=on, no device tokens → send is skipped
 *  - Both channels on → both called
 *  - send failures are swallowed → createEvent still returns { error: null }
 *  - Permission denied → error returned, no notifications fired
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock handles — must exist before vi.mock factory functions run
// ---------------------------------------------------------------------------

const {
  mockFrom,
  mockSendEmailDirect,
  mockOneSignalSend,
} = vi.hoisted(() => ({
  mockFrom:            vi.fn(),
  mockSendEmailDirect: vi.fn(),
  mockOneSignalSend:   vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock('@/lib/rbac/server', () => ({
  assertPermission: vi.fn().mockResolvedValue(null), // always permit by default
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/notifications/email-service', () => ({
  sendEmailDirect: mockSendEmailDirect,
}));

vi.mock('@/lib/notifications/providers/onesignal-adapter', () => ({
  oneSignalAdapter: { send: mockOneSignalSend },
}));

// Import after mocks are declared so the module under test picks up mocked deps
import { createEvent } from '@/app/calendar/actions';
import { assertPermission } from '@/lib/rbac/server';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type AthleteRow = { id: string; first_name: string; last_name: string; email: string | null };
type TokenRow   = { onesignal_player_id: string };

const ATHLETES: AthleteRow[] = [
  { id: 'ath-1', first_name: 'Ana',  last_name: 'García',   email: 'ana@example.com'  },
  { id: 'ath-2', first_name: 'Luis', last_name: 'Martínez', email: 'luis@example.com' },
];

const ATHLETE_NO_EMAIL: AthleteRow = {
  id: 'ath-3', first_name: 'Pedro', last_name: 'Ruiz', email: null,
};

const TOKENS: TokenRow[] = [
  { onesignal_player_id: 'player-ath-1' },
  { onesignal_player_id: 'player-ath-2' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a FormData object from a plain key→value(s) map. */
function makeFormData(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const v of value) fd.append(key, v);
    } else {
      fd.set(key, value);
    }
  }
  return fd;
}

/** Minimum required fields for a valid event. */
const BASE_FIELDS: Record<string, string> = {
  title:                 'Morning Training',
  event_type:            'training',
  start_at:              '2026-04-15T09:00',
  end_at:                '2026-04-15T11:00',
  created_by_profile_id: 'profile-1',
};

/**
 * Configure mockFrom to simulate a successful event + participant insert,
 * and return the given athletes / tokens when queried for notifications.
 */
function setupSupabaseMock({
  athletes = ATHLETES as AthleteRow[],
  tokens   = TOKENS,
}: {
  athletes?: AthleteRow[];
  tokens?:   TokenRow[];
} = {}) {
  mockFrom.mockImplementation((table: string) => {
    switch (table) {
      case 'events':
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'evt-1' }, error: null }),
            }),
          }),
        };

      case 'event_participants':
        return { insert: vi.fn().mockResolvedValue({ error: null }) };

      case 'athletes':
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: athletes, error: null }),
          }),
        };

      case 'push_device_tokens':
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
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

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('createEvent – participant notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
    // Default: both notification helpers succeed
    mockSendEmailDirect.mockResolvedValue({ success: true, message_id: null, error: null });
    mockOneSignalSend.mockResolvedValue({ success: true, notification_id: null, error: null, raw: {} });
  });

  // ── No participants ────────────────────────────────────────────────────────

  it('sends no notifications when no participants are selected, even if checkboxes are on', async () => {
    // No athlete_id in form data → the notification block is never entered
    const fd = makeFormData({
      ...BASE_FIELDS,
      notify_email: 'on',
      notify_push:  'on',
    });

    const result = await createEvent(fd);

    expect(result.error).toBeNull();
    expect(mockSendEmailDirect).not.toHaveBeenCalled();
    expect(mockOneSignalSend).not.toHaveBeenCalled();
  });

  // ── Neither checkbox checked ───────────────────────────────────────────────

  it('sends no notifications when participants exist but neither checkbox is checked', async () => {
    const fd = makeFormData({
      ...BASE_FIELDS,
      athlete_id: ['ath-1', 'ath-2'],
      // notify_email and notify_push are absent
    });

    const result = await createEvent(fd);

    expect(result.error).toBeNull();
    expect(mockSendEmailDirect).not.toHaveBeenCalled();
    expect(mockOneSignalSend).not.toHaveBeenCalled();
  });

  // ── Email notifications ───────────────────────────────────────────────────

  it('sends one email per athlete when notify_email is checked', async () => {
    const fd = makeFormData({
      ...BASE_FIELDS,
      athlete_id:   ['ath-1', 'ath-2'],
      notify_email: 'on',
    });

    await createEvent(fd);

    expect(mockSendEmailDirect).toHaveBeenCalledTimes(2);
    expect(mockSendEmailDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        to:      'ana@example.com',
        subject: expect.stringContaining('Morning Training'),
      }),
    );
    expect(mockSendEmailDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        to:      'luis@example.com',
        subject: expect.stringContaining('Morning Training'),
      }),
    );
  });

  it('includes the athlete first name in the email body', async () => {
    setupSupabaseMock({ athletes: [ATHLETES[0]] });

    const fd = makeFormData({
      ...BASE_FIELDS,
      athlete_id:   ['ath-1'],
      notify_email: 'on',
    });

    await createEvent(fd);

    expect(mockSendEmailDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('Ana'),
        text: expect.stringContaining('Ana'),
      }),
    );
  });

  it('skips athletes without an email address', async () => {
    setupSupabaseMock({ athletes: [ATHLETES[0], ATHLETE_NO_EMAIL] });

    const fd = makeFormData({
      ...BASE_FIELDS,
      athlete_id:   ['ath-1', 'ath-3'],
      notify_email: 'on',
    });

    await createEvent(fd);

    expect(mockSendEmailDirect).toHaveBeenCalledTimes(1);
    expect(mockSendEmailDirect).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ana@example.com' }),
    );
  });

  it('does not trigger push when only notify_email is checked', async () => {
    const fd = makeFormData({
      ...BASE_FIELDS,
      athlete_id:   ['ath-1'],
      notify_email: 'on',
    });

    await createEvent(fd);

    expect(mockOneSignalSend).not.toHaveBeenCalled();
  });

  // ── Push notifications ────────────────────────────────────────────────────

  it('sends a single batched push to all device player IDs when notify_push is checked', async () => {
    const fd = makeFormData({
      ...BASE_FIELDS,
      athlete_id:  ['ath-1', 'ath-2'],
      notify_push: 'on',
    });

    await createEvent(fd);

    expect(mockOneSignalSend).toHaveBeenCalledTimes(1);
    expect(mockOneSignalSend).toHaveBeenCalledWith(
      expect.objectContaining({
        player_ids: ['player-ath-1', 'player-ath-2'],
        title:      'New Event',
        message:    expect.stringContaining('Morning Training'),
      }),
    );
  });

  it('does not call oneSignalAdapter.send when no device tokens are registered', async () => {
    setupSupabaseMock({ tokens: [] });

    const fd = makeFormData({
      ...BASE_FIELDS,
      athlete_id:  ['ath-1', 'ath-2'],
      notify_push: 'on',
    });

    await createEvent(fd);

    expect(mockOneSignalSend).not.toHaveBeenCalled();
  });

  it('does not trigger email when only notify_push is checked', async () => {
    const fd = makeFormData({
      ...BASE_FIELDS,
      athlete_id:  ['ath-1'],
      notify_push: 'on',
    });

    await createEvent(fd);

    expect(mockSendEmailDirect).not.toHaveBeenCalled();
  });

  // ── Both channels ─────────────────────────────────────────────────────────

  it('sends both email and push when both checkboxes are checked', async () => {
    const fd = makeFormData({
      ...BASE_FIELDS,
      athlete_id:   ['ath-1', 'ath-2'],
      notify_email: 'on',
      notify_push:  'on',
    });

    await createEvent(fd);

    expect(mockSendEmailDirect).toHaveBeenCalledTimes(2);
    expect(mockOneSignalSend).toHaveBeenCalledTimes(1);
  });

  // ── Error resilience ──────────────────────────────────────────────────────

  it('still returns { error: null } when sendEmailDirect rejects', async () => {
    mockSendEmailDirect.mockRejectedValue(new Error('SMTP unavailable'));

    const fd = makeFormData({
      ...BASE_FIELDS,
      athlete_id:   ['ath-1'],
      notify_email: 'on',
    });

    const result = await createEvent(fd);

    expect(result.error).toBeNull();
  });

  it('still returns { error: null } when oneSignalAdapter.send rejects', async () => {
    mockOneSignalSend.mockRejectedValue(new Error('OneSignal API error'));

    const fd = makeFormData({
      ...BASE_FIELDS,
      athlete_id:  ['ath-1'],
      notify_push: 'on',
    });

    const result = await createEvent(fd);

    expect(result.error).toBeNull();
  });

  // ── Permission denied ─────────────────────────────────────────────────────

  it('returns an error and fires no notifications when the caller lacks permission', async () => {
    vi.mocked(assertPermission).mockResolvedValueOnce({ error: 'You do not have permission to perform this action.' });

    const fd = makeFormData({
      ...BASE_FIELDS,
      athlete_id:   ['ath-1'],
      notify_email: 'on',
      notify_push:  'on',
    });

    const result = await createEvent(fd);

    expect(result.error).toBe('You do not have permission to perform this action.');
    expect(mockSendEmailDirect).not.toHaveBeenCalled();
    expect(mockOneSignalSend).not.toHaveBeenCalled();
  });
});

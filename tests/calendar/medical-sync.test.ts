/**
 * Integration tests for calendar ↔ medical-module synchronisation.
 *
 * Covers the fixes applied to calendar/actions.ts:
 *
 *  1. createEvent / updateEvent — naive datetime-local strings are converted
 *     from Mexico City local time (CST UTC-6, year-round since 2023) to UTC
 *     before being stored in Supabase.
 *     (Bug: naive strings were stored as-is, misinterpreted as UTC by PostgreSQL,
 *      placing events 6 hours too early.)
 *
 *  2. updateEvent — differential participant strategy preserves attendance_status.
 *     (Bug: the old delete-all + re-insert reset every participant to 'planned',
 *      wiping attendance records registered via /medical/appointments.)
 *
 *  3. updateEvent / updateEventStatus — revalidatePath('/medical/appointments')
 *     is called so the appointments list reflects calendar changes immediately.
 *     (Bug: only '/calendar' was revalidated.)
 *
 * All external collaborators (Supabase, RBAC, Next.js cache) are mocked.
 * The real `mxLocalToUTC` utility runs so timezone conversion is tested end-to-end.
 *
 * Timezone: America/Mexico_City = CST UTC-6 year-round (DST abolished in 2023).
 * All naive MX times have +6 h added to reach UTC.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock handles
// ---------------------------------------------------------------------------

const { mockFrom, mockRevalidatePath } = vi.hoisted(() => ({
  mockFrom:           vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock('@/lib/rbac/server', () => ({
  assertPermission: vi.fn().mockResolvedValue(null), // always permitted
  getCurrentUser:   vi.fn().mockResolvedValue({ profile: { id: 'profile-coordinator-1' } }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

// Stubs for notification dependencies (not under test here)
vi.mock('@/lib/notifications/email-service',               () => ({ sendEmailDirect:  vi.fn().mockResolvedValue({}) }));
vi.mock('@/lib/notifications/providers/onesignal-adapter', () => ({ oneSignalAdapter: { send: vi.fn().mockResolvedValue({}) } }));

import { createEvent, updateEvent, updateEventStatus } from '@/app/[locale]/(app)/calendar/actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFormData(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, val] of Object.entries(fields)) {
    if (Array.isArray(val)) val.forEach((v) => fd.append(key, v));
    else fd.set(key, val);
  }
  return fd;
}

// Minimum fields for a valid event (no notifications so athlete/token queries are skipped).
// MX times: 06:30 CST → 12:30 UTC (+6 h)   |   07:00 CST → 13:00 UTC (+6 h)
const BASE_FIELDS = {
  title:      'MÉDICO',
  event_type: 'medical',
  status:     'scheduled',
  start_at:   '2026-07-06T06:30',   // naive MX CST  →  12:30Z UTC
  end_at:     '2026-07-06T07:00',   // naive MX CST  →  13:00Z UTC
};

// ---------------------------------------------------------------------------
// Shared Supabase mock factories
// ---------------------------------------------------------------------------

/** Sets up a mock for createEvent: events.insert().select().single() */
function setupCreateMock(captureInsertArg: { payload?: unknown } = {}) {
  const insertSingle = vi.fn().mockResolvedValue({ data: { id: 'evt-new' }, error: null });
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
  const insertFn     = vi.fn().mockImplementation((p) => {
    captureInsertArg.payload = p;
    return { select: insertSelect };
  });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'events')            return { insert: insertFn };
    if (table === 'event_participants') return { insert: vi.fn().mockResolvedValue({ error: null }) };
    return {};
  });
  return { insertFn };
}

/**
 * Sets up mocks for updateEvent.
 * @param existingParticipants  Participants currently in the DB (with their attendance_status)
 */
function setupUpdateMock(existingParticipants: { participant_id: string; attendance_status: string }[]) {
  const eventsUpdateCapture: { payload?: unknown } = {};
  const eventsUpdateEq = vi.fn().mockResolvedValue({ error: null });
  const eventsUpdate   = vi.fn().mockImplementation((p) => {
    eventsUpdateCapture.payload = p;
    return { eq: eventsUpdateEq };
  });

  // event_participants: SELECT existing, DELETE removed, INSERT new
  const epSelectEq  = vi.fn().mockResolvedValue({ data: existingParticipants, error: null });
  const epSelect    = vi.fn().mockReturnValue({ eq: epSelectEq });

  const epDeleteIn  = vi.fn().mockResolvedValue({ error: null });
  const epDeleteEq  = vi.fn().mockReturnValue({ in: epDeleteIn });
  const epDelete    = vi.fn().mockReturnValue({ eq: epDeleteEq });

  const epInsert    = vi.fn().mockResolvedValue({ error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'events')             return { update: eventsUpdate };
    if (table === 'event_participants') return { select: epSelect, delete: epDelete, insert: epInsert };
    return {};
  });

  return { eventsUpdateCapture, epSelect, epDelete, epDeleteIn, epInsert };
}

// ---------------------------------------------------------------------------
// 1. Datetime conversion (createEvent)
// ---------------------------------------------------------------------------

describe('createEvent — datetime-local is converted from MX local time to UTC', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('stores start_at as UTC ISO string (+6 h offset for MX CST)', async () => {
    const capture: { payload?: unknown } = {};
    setupCreateMock(capture);

    await createEvent(makeFormData(BASE_FIELDS));

    // '2026-07-06T06:30' MX CST (UTC-6) → '2026-07-06T12:30:00.000Z'
    expect(capture.payload).toMatchObject({ start_at: '2026-07-06T12:30:00.000Z' });
  });

  it('stores end_at as UTC ISO string', async () => {
    const capture: { payload?: unknown } = {};
    setupCreateMock(capture);

    await createEvent(makeFormData(BASE_FIELDS));

    // '2026-07-06T07:00' MX CST → '2026-07-06T13:00:00.000Z'
    expect(capture.payload).toMatchObject({ end_at: '2026-07-06T13:00:00.000Z' });
  });

  it('does not alter start_at when it already carries a Z suffix', async () => {
    const capture: { payload?: unknown } = {};
    setupCreateMock(capture);

    const fd = makeFormData({ ...BASE_FIELDS, start_at: '2026-07-06T12:30:00.000Z' });
    await createEvent(fd);

    expect(capture.payload).toMatchObject({ start_at: '2026-07-06T12:30:00.000Z' });
  });

  it('applies the same +6 h offset for a January event (no DST change)', async () => {
    const capture: { payload?: unknown } = {};
    setupCreateMock(capture);

    const fd = makeFormData({ ...BASE_FIELDS, start_at: '2026-01-15T08:00', end_at: '2026-01-15T09:00' });
    await createEvent(fd);

    // '2026-01-15T08:00' MX CST (UTC-6) → '2026-01-15T14:00:00.000Z'
    expect(capture.payload).toMatchObject({ start_at: '2026-01-15T14:00:00.000Z' });
  });
});

// ---------------------------------------------------------------------------
// 2. Datetime conversion (updateEvent)
// ---------------------------------------------------------------------------

describe('updateEvent — datetime-local is converted from MX local time to UTC', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('stores updated start_at as UTC ISO string', async () => {
    const { eventsUpdateCapture } = setupUpdateMock([]);

    const fd = makeFormData({ ...BASE_FIELDS, start_at: '2026-07-06T06:30', end_at: '2026-07-06T07:00' });
    await updateEvent('evt-1', fd);

    expect(eventsUpdateCapture.payload).toMatchObject({ start_at: '2026-07-06T12:30:00.000Z' });
  });

  it('stores updated end_at as UTC ISO string', async () => {
    const { eventsUpdateCapture } = setupUpdateMock([]);

    const fd = makeFormData({ ...BASE_FIELDS, start_at: '2026-07-06T06:30', end_at: '2026-07-06T07:00' });
    await updateEvent('evt-1', fd);

    expect(eventsUpdateCapture.payload).toMatchObject({ end_at: '2026-07-06T13:00:00.000Z' });
  });
});

// ---------------------------------------------------------------------------
// 3. Differential participant update — attendance_status preservation
// ---------------------------------------------------------------------------

describe('updateEvent — differential participant strategy', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('does NOT re-insert participants whose attendance_status is already "show"', async () => {
    const { epInsert } = setupUpdateMock([
      { participant_id: 'ath-1', attendance_status: 'show'    },
      { participant_id: 'ath-2', attendance_status: 'planned' },
    ]);

    const fd = makeFormData({ ...BASE_FIELDS, athlete_id: ['ath-1', 'ath-2'] });
    const result = await updateEvent('evt-1', fd);

    expect(result.error).toBeNull();
    // No new participants → insert should not be called at all
    expect(epInsert).not.toHaveBeenCalled();
  });

  it('inserts only newly added participants (not existing ones)', async () => {
    const { epInsert } = setupUpdateMock([
      { participant_id: 'ath-1', attendance_status: 'show' },
    ]);

    const fd = makeFormData({ ...BASE_FIELDS, athlete_id: ['ath-1', 'ath-3'] });
    await updateEvent('evt-1', fd);

    expect(epInsert).toHaveBeenCalledTimes(1);
    expect(epInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ participant_id: 'ath-3', attendance_status: 'planned' }),
      ]),
    );
    // ath-1 (already 'show') must NOT appear in the insert
    const insertedIds = (epInsert.mock.calls[0][0] as { participant_id: string }[]).map(
      (r) => r.participant_id,
    );
    expect(insertedIds).not.toContain('ath-1');
  });

  it('deletes participants removed from the form, leaving others intact', async () => {
    const { epDeleteIn, epInsert } = setupUpdateMock([
      { participant_id: 'ath-1', attendance_status: 'show'    },
      { participant_id: 'ath-2', attendance_status: 'planned' },
    ]);

    const fd = makeFormData({ ...BASE_FIELDS, athlete_id: ['ath-1'] });
    await updateEvent('evt-1', fd);

    // .in() is called as .in('participant_id', ['ath-2'])
    expect(epDeleteIn).toHaveBeenCalledWith('participant_id', ['ath-2']);
    expect(epInsert).not.toHaveBeenCalled();
  });

  it('insert assigns "planned" status for newly added participants', async () => {
    const { epInsert } = setupUpdateMock([]);

    const fd = makeFormData({ ...BASE_FIELDS, athlete_id: ['ath-new'] });
    await updateEvent('evt-1', fd);

    expect(epInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ participant_id: 'ath-new', attendance_status: 'planned' }),
      ]),
    );
  });

  it('does not call delete when no participant is removed', async () => {
    const { epDelete } = setupUpdateMock([
      { participant_id: 'ath-1', attendance_status: 'show' },
    ]);

    const fd = makeFormData({ ...BASE_FIELDS, athlete_id: ['ath-1'] });
    await updateEvent('evt-1', fd);

    expect(epDelete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. Cross-module cache revalidation
// ---------------------------------------------------------------------------

describe('calendar actions — revalidatePath cross-module synchronisation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('createEvent revalidates /medical/appointments', async () => {
    setupCreateMock();
    await createEvent(makeFormData(BASE_FIELDS));
    expect(mockRevalidatePath).toHaveBeenCalledWith('/medical/appointments');
  });

  it('createEvent revalidates /calendar', async () => {
    setupCreateMock();
    await createEvent(makeFormData(BASE_FIELDS));
    expect(mockRevalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('updateEvent revalidates /medical/appointments', async () => {
    setupUpdateMock([]);
    await updateEvent('evt-1', makeFormData(BASE_FIELDS));
    expect(mockRevalidatePath).toHaveBeenCalledWith('/medical/appointments');
  });

  it('updateEvent revalidates /calendar', async () => {
    setupUpdateMock([]);
    await updateEvent('evt-1', makeFormData(BASE_FIELDS));
    expect(mockRevalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('updateEventStatus revalidates /medical/appointments', async () => {
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));
    await updateEventStatus('evt-1', 'completed');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/medical/appointments');
  });

  it('updateEventStatus revalidates /calendar', async () => {
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));
    await updateEventStatus('evt-1', 'completed');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('updateEventStatus writes only the requested status — medical statuses remain safe', async () => {
    const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockFrom.mockImplementation(() => ({ update: updateFn }));

    await updateEventStatus('evt-1', 'completed');

    expect(updateFn).toHaveBeenCalledWith({ status: 'completed' });
  });
});

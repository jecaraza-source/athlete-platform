/**
 * Integration tests for medical/appointments ↔ calendar synchronisation.
 *
 * Covers the fixes applied to medical/appointments/[eventId]/actions.ts:
 *
 *  1. fetchAvailableSlots — booked-slot detection uses Mexico City timezone.
 *     (Bug: `getHours()` returned UTC hours on Vercel, shifting slots by 6 h
 *      and allowing double-bookings for early-morning appointments.)
 *
 *  2. confirmReschedule — new event uses current user's profileId as
 *     created_by_profile_id, not the original event's creator.
 *     (Bug: if the original appointment was admin-created the new event would
 *      inherit the coordinator's profileId, making it invisible to the doctor.)
 *
 *  3. Medical-module actions revalidate /calendar so the calendar view stays
 *     in sync after attendance is registered.
 *
 * Timezone: America/Mexico_City = CST UTC-6 year-round (DST abolished in 2023).
 * 06:30 AM MX CST is stored as 12:30Z UTC (+6 h).
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

// The acting doctor has role 'medic' so assertMedicalAccess() passes.
vi.mock('@/lib/rbac/server', () => ({
  assertPermission: vi.fn().mockResolvedValue(null),
  getCurrentUser: vi.fn().mockResolvedValue({
    profile: { id: 'profile-acting-doctor' },
    roles:   [{ code: 'medic' }],
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock('@/lib/notifications/providers/onesignal-adapter', () => ({
  oneSignalAdapter: { send: vi.fn().mockResolvedValue({}) },
}));

import {
  fetchAvailableSlots,
  confirmReschedule,
  confirmShow,
  confirmNoShow,
  confirmNoShowRemote,
} from '@/app/[locale]/(app)/medical/appointments/[eventId]/actions';

// ---------------------------------------------------------------------------
// 1. fetchAvailableSlots — MX timezone slot detection
// ---------------------------------------------------------------------------

describe('fetchAvailableSlots — slot detection uses Mexico City timezone (CST = UTC-6)', () => {
  // Availability window: 06:00 – 08:00, 30-min slots → ["06:00","06:30","07:00","07:30"]
  const AVAILABILITY = [{ start_time: '06:00', end_time: '08:00', slot_minutes: 30 }];

  function setupSlotMock(bookedStartAt: string) {
    // specialist_availability chain: .select().eq().eq().eq()
    const availEq3     = vi.fn().mockResolvedValue({ data: AVAILABILITY, error: null });
    const availEq2     = vi.fn().mockReturnValue({ eq: availEq3 });
    const availEq1     = vi.fn().mockReturnValue({ eq: availEq2 });
    const availSelect  = vi.fn().mockReturnValue({ eq: availEq1 });

    // events (booked) chain: .select().eq().gte().lte().in()
    const bookedIn     = vi.fn().mockResolvedValue({ data: [{ start_at: bookedStartAt }], error: null });
    const bookedLte    = vi.fn().mockReturnValue({ in: bookedIn });
    const bookedGte    = vi.fn().mockReturnValue({ lte: bookedLte });
    const bookedEq     = vi.fn().mockReturnValue({ gte: bookedGte });
    const bookedSelect = vi.fn().mockReturnValue({ eq: bookedEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'specialist_availability') return { select: availSelect };
      if (table === 'events')                  return { select: bookedSelect };
      return {};
    });
  }

  beforeEach(() => { vi.clearAllMocks(); });

  it('marks 06:30 as taken when the booked event is stored as 12:30Z UTC (= 06:30 MX CST)', async () => {
    // 06:30 MX CST (UTC-6) is stored as 12:30Z UTC.
    // Before fix: getHours() on Vercel (UTC) = 12 → takenTimes = {"12:30"} → 06:30 wrongly shown as available.
    // After fix: toLocaleTimeString(MX) = "06:30" → takenTimes = {"06:30"} → correctly taken.
    setupSlotMock('2026-07-06T12:30:00Z');

    const { slots, error } = await fetchAvailableSlots('spec-1', '2026-07-06');

    expect(error).toBeNull();
    const slot0630 = slots.find((s) => s.time === '06:30');
    expect(slot0630).toBeDefined();
    expect(slot0630!.taken).toBe(true);
  });

  it('leaves all other slots available when only 06:30 is booked', async () => {
    setupSlotMock('2026-07-06T12:30:00Z');

    const { slots } = await fetchAvailableSlots('spec-1', '2026-07-06');

    expect(slots.find((s) => s.time === '06:00')!.taken).toBe(false);
    expect(slots.find((s) => s.time === '07:00')!.taken).toBe(false);
    expect(slots.find((s) => s.time === '07:30')!.taken).toBe(false);
  });

  it('returns no false-positives: 07:00 is free when only 06:30 is booked', async () => {
    setupSlotMock('2026-07-06T12:30:00Z');

    const { slots } = await fetchAvailableSlots('spec-1', '2026-07-06');

    expect(slots.find((s) => s.time === '07:00')!.taken).toBe(false);
  });

  it('correctly detects a 07:00 MX booking stored as 13:00Z UTC', async () => {
    // 07:00 MX CST (UTC-6) = 13:00Z UTC
    setupSlotMock('2026-07-06T13:00:00Z');

    const { slots } = await fetchAvailableSlots('spec-1', '2026-07-06');

    expect(slots.find((s) => s.time === '07:00')!.taken).toBe(true);
    expect(slots.find((s) => s.time === '06:30')!.taken).toBe(false);
  });

  it('applies the same UTC-6 logic in January (no DST difference)', async () => {
    // 06:30 MX CST on Jan 15 = 12:30Z UTC  (same offset as summer)
    setupSlotMock('2026-01-15T12:30:00Z');

    const { slots } = await fetchAvailableSlots('spec-1', '2026-01-15');

    expect(slots.find((s) => s.time === '06:30')!.taken).toBe(true);
  });

  it('returns all slots free when there are no booked events', async () => {
    const availEq3     = vi.fn().mockResolvedValue({ data: AVAILABILITY, error: null });
    const availEq2     = vi.fn().mockReturnValue({ eq: availEq3 });
    const availEq1     = vi.fn().mockReturnValue({ eq: availEq2 });
    const availSelect  = vi.fn().mockReturnValue({ eq: availEq1 });

    const bookedIn     = vi.fn().mockResolvedValue({ data: [], error: null });
    const bookedLte    = vi.fn().mockReturnValue({ in: bookedIn });
    const bookedGte    = vi.fn().mockReturnValue({ lte: bookedLte });
    const bookedEq     = vi.fn().mockReturnValue({ gte: bookedGte });
    const bookedSelect = vi.fn().mockReturnValue({ eq: bookedEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'specialist_availability') return { select: availSelect };
      if (table === 'events')                  return { select: bookedSelect };
      return {};
    });

    const { slots, error } = await fetchAvailableSlots('spec-1', '2026-07-06');

    expect(error).toBeNull();
    expect(slots.every((s) => s.taken === false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. confirmReschedule — new event uses current user's profileId
// ---------------------------------------------------------------------------

describe('confirmReschedule — new event created_by_profile_id uses acting doctor', () => {
  function setupRescheduleMock() {
    const eventsInsertCapture: { payload?: unknown } = {};
    const eventsInsertSingle = vi.fn().mockResolvedValue({ data: { id: 'new-evt-id' }, error: null });
    const eventsInsertSelect = vi.fn().mockReturnValue({ single: eventsInsertSingle });
    const eventsInsert = vi.fn().mockImplementation((p) => {
      eventsInsertCapture.payload = p;
      return { select: eventsInsertSelect };
    });
    const eventsUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const eventsUpdate   = vi.fn().mockReturnValue({ eq: eventsUpdateEq });

    const epUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const epUpdate   = vi.fn().mockReturnValue({ eq: epUpdateEq });
    const epInsert   = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'events')             return { update: eventsUpdate, insert: eventsInsert };
      if (table === 'event_participants') return { update: epUpdate,     insert: epInsert     };
      if (table === 'push_device_tokens') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };
      return {};
    });

    return { eventsInsertCapture };
  }

  beforeEach(() => { vi.clearAllMocks(); });

  it('uses the acting doctor\'s profileId, not the original coordinator\'s', async () => {
    const { eventsInsertCapture } = setupRescheduleMock();

    await confirmReschedule(
      'orig-evt-id',
      '2026-07-10T12:30:00.000Z',          // newStartAt (UTC from RescheduleCalendar)
      '2026-07-10T13:00:00.000Z',          // newEndAt
      '',                                  // no notes
      'ath-nahui',                         // athleteId
      null,                                // no push token
      'profile-original-coordinator',      // specialistId (ORIGINAL creator — a coordinator)
      'MÉDICO',
    );

    // The new event must be owned by the ACTING DOCTOR (profile from getCurrentUser).
    // This ensures the doctor can see the rescheduled appointment in their list.
    expect(eventsInsertCapture.payload).toMatchObject({
      created_by_profile_id: 'profile-acting-doctor',
    });
  });

  it('does NOT use the original specialistId as created_by_profile_id', async () => {
    const { eventsInsertCapture } = setupRescheduleMock();

    await confirmReschedule(
      'orig-evt-id',
      '2026-07-10T12:30:00.000Z',
      '2026-07-10T13:00:00.000Z',
      '',
      'ath-nahui',
      null,
      'profile-original-coordinator',
      'MÉDICO',
    );

    expect(eventsInsertCapture.payload).not.toMatchObject({
      created_by_profile_id: 'profile-original-coordinator',
    });
  });

  it('new event has status "scheduled"', async () => {
    const { eventsInsertCapture } = setupRescheduleMock();

    await confirmReschedule(
      'orig-evt-id', '2026-07-10T12:30:00.000Z', '2026-07-10T13:00:00.000Z',
      '', 'ath-nahui', null, 'prof-coord', 'MÉDICO',
    );

    expect(eventsInsertCapture.payload).toMatchObject({ status: 'scheduled' });
  });

  it('new event preserves the service type as title', async () => {
    const { eventsInsertCapture } = setupRescheduleMock();

    await confirmReschedule(
      'orig-evt-id', '2026-07-10T12:30:00.000Z', '2026-07-10T13:00:00.000Z',
      '', 'ath-nahui', null, 'prof-coord', 'FISIOTERAPIA',
    );

    expect(eventsInsertCapture.payload).toMatchObject({ title: 'FISIOTERAPIA' });
  });

  it('returns { error: null, newEventId } on success', async () => {
    setupRescheduleMock();

    const result = await confirmReschedule(
      'orig-evt-id', '2026-07-10T12:30:00.000Z', '2026-07-10T13:00:00.000Z',
      'Paciente solicitó cambio', 'ath-nahui', null, 'prof-coord', 'MÉDICO',
    );

    expect(result.error).toBeNull();
    if (!result.error) {
      expect((result as { error: null; newEventId: string }).newEventId).toBe('new-evt-id');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Visibility fix — confirmShow works for coordinator-created appointments
// ---------------------------------------------------------------------------
//
// This section verifies the root-cause fix for the Nahui Mariana case:
// a coordinator-created appointment (created_by_profile_id = coordinator)
// must be editable by the attending doctor (isStrictMedical = true).
// We test this indirectly through confirmShow / confirmNoShow since those
// are the server actions invoked when a doctor records attendance.
// The access guard (isStrictMedical) lives in the page component which is
// not directly unit-testable here; but the server actions themselves only
// check assertMedicalAccess(), which any 'medic' passes regardless of whether
// they created the event.

describe('medical staff can record attendance on coordinator-created appointments', () => {
  function setupAttendanceForCoordinatorEvent() {
    // Simulate the DB state: event owned by coordinator (created_by_profile_id = 'profile-coordinator')
    // The ACTING DOCTOR (getCurrentUser mock: 'profile-acting-doctor') did NOT create this event.
    // After the fix, assertMedicalAccess() grants access to any 'medic', regardless of ownership.
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupAttendanceForCoordinatorEvent();
  });

  it('confirmShow succeeds for a coordinator-created event (doctor is not owner)', async () => {
    // The acting doctor is 'profile-acting-doctor' (from getCurrentUser mock).
    // The event was created by 'profile-coordinator' (not the doctor).
    // assertMedicalAccess() only checks that the user has a medical role —
    // it does NOT check event ownership. So this must succeed.
    const result = await confirmShow('evt-coordinator-created', 'Consulta completada');
    expect(result.error).toBeNull();
  });

  it('confirmNoShow succeeds for a coordinator-created event', async () => {
    const result = await confirmNoShow('evt-coordinator-created', 'no_notice', '', null);
    expect(result.error).toBeNull();
  });

  it('confirmNoShowRemote succeeds for a coordinator-created event', async () => {
    const result = await confirmNoShowRemote('evt-coordinator-created', 'llamada', 'Atendida por teléfono', null);
    expect(result.error).toBeNull();
  });

  it('updates the correct event id regardless of ownership', async () => {
    const updateEq   = vi.fn().mockResolvedValue({ error: null });
    const updateFn   = vi.fn().mockReturnValue({ eq: updateEq });
    mockFrom.mockImplementation(() => ({ update: updateFn }));

    await confirmShow('evt-coordinator-created', '');

    // The update must target the coordinator's event by its ID
    expect(updateEq).toHaveBeenCalledWith('id', 'evt-coordinator-created');
  });
});

// ---------------------------------------------------------------------------
// 4. Medical actions revalidate /calendar
// ---------------------------------------------------------------------------

describe('medical attendance actions — revalidatePath includes /calendar', () => {
  function setupAttendanceMock() {
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupAttendanceMock();
  });

  it('confirmShow revalidates /calendar', async () => {
    await confirmShow('evt-1', '');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('confirmShow revalidates /medical/appointments', async () => {
    await confirmShow('evt-1', '');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/medical/appointments');
  });

  it('confirmNoShow revalidates /calendar', async () => {
    await confirmNoShow('evt-1', 'no_notice', '', null);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('confirmNoShowRemote revalidates /calendar', async () => {
    await confirmNoShowRemote('evt-1', 'llamada', '', null);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/calendar');
  });
});

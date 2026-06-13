'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission, getCurrentUser } from '@/lib/rbac/server';
import { oneSignalAdapter } from '@/lib/notifications/providers/onesignal-adapter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlotInfo = {
  time: string;   // 'HH:MM'
  label: string;  // '9:00 AM'
  taken: boolean;
};

// ---------------------------------------------------------------------------
// Guard helper — medical staff only
// ---------------------------------------------------------------------------

const MEDICAL_ROLE_CODES = ['medic', 'psychologist', 'nutritionist', 'physio', 'admin', 'super_admin', 'program_director'];

async function assertMedicalAccess(): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No estás autenticado.' };
  const isMedical = user.roles.some((r) => MEDICAL_ROLE_CODES.includes(r.code));
  if (!isMedical) return { error: 'No tienes acceso a esta sección.' };
  return null;
}

// ---------------------------------------------------------------------------
// confirmShow — mark event as attended, save notes
// ---------------------------------------------------------------------------

export async function confirmShow(eventId: string, notes: string) {
  const denied = await assertPermission('view_athletes');
  if (denied) return denied;

  const user = await getCurrentUser();
  const profileId = user?.profile?.id;

  const now = new Date().toISOString();

  const { error: evErr } = await supabaseAdmin
    .from('events')
    .update({
      status:        'show',
      description:   notes || null,
      confirmed_by:  profileId,
      confirmed_at:  now,
      updated_at:    now,
    })
    .eq('id', eventId);

  if (evErr) return { error: evErr.message };

  // Update participant attendance
  await supabaseAdmin
    .from('event_participants')
    .update({ attendance_status: 'show' })
    .eq('event_id', eventId);

  revalidatePath(`/medical/appointments/${eventId}`);
  revalidatePath('/medical/appointments');
  return { error: null };
}

// ---------------------------------------------------------------------------
// autosaveNotes — debounced background save (called from client)
// ---------------------------------------------------------------------------

export async function autosaveNotes(eventId: string, notes: string) {
  const denied = await assertMedicalAccess();
  if (denied) return denied;

  const { error } = await supabaseAdmin
    .from('events')
    .update({ description: notes || null, updated_at: new Date().toISOString() })
    .eq('id', eventId);

  if (error) return { error: error.message };
  return { error: null };
}

// ---------------------------------------------------------------------------
// confirmNoShow — mark event as no-show, optionally notify athlete
// ---------------------------------------------------------------------------

export async function confirmNoShow(
  eventId: string,
  reason: string,
  notes: string,
  athleteProfileId: string | null,
) {
  const denied = await assertPermission('view_athletes');
  if (denied) return denied;

  const user = await getCurrentUser();
  const profileId = user?.profile?.id;
  const now = new Date().toISOString();

  const { error: evErr } = await supabaseAdmin
    .from('events')
    .update({
      status:          'no_show',
      no_show_reason:  reason || null,
      description:     notes || null,
      confirmed_by:    profileId,
      confirmed_at:    now,
      updated_at:      now,
    })
    .eq('id', eventId);

  if (evErr) return { error: evErr.message };

  await supabaseAdmin
    .from('event_participants')
    .update({ attendance_status: 'no_show' })
    .eq('event_id', eventId);

  // Push notification to athlete (best-effort, non-blocking)
  if (athleteProfileId) {
    const { data: tokens } = await supabaseAdmin
      .from('push_device_tokens')
      .select('onesignal_player_id')
      .eq('profile_id', athleteProfileId)
      .eq('is_active', true)
      .not('onesignal_player_id', 'is', null);

    const playerIds = (tokens ?? [])
      .map((t) => t.onesignal_player_id as string)
      .filter(Boolean);

    if (playerIds.length > 0) {
      oneSignalAdapter.send({
        player_ids: playerIds,
        title: 'Cita no registrada',
        message: 'No se registró tu asistencia a la cita de hoy. Contáctanos si fue un error.',
      }).catch(() => {});
    }
  }

  revalidatePath(`/medical/appointments/${eventId}`);
  revalidatePath('/medical/appointments');
  return { error: null };
}

// ---------------------------------------------------------------------------
// confirmReschedule — mark original as rescheduled, create new event
// ---------------------------------------------------------------------------

export async function confirmReschedule(
  originalEventId: string,
  newStartAt: string,      // ISO string e.g. "2026-06-24T10:00:00"
  newEndAt: string,
  rescheduleNotes: string,
  athleteId: string,       // athletes.id (for event_participants)
  athleteProfileId: string | null, // profiles.id (for push token lookup)
  specialistId: string,
  serviceType: string,
) {
  const denied = await assertPermission('view_athletes');
  if (denied) return denied;

  const user = await getCurrentUser();
  const profileId = user?.profile?.id;
  const now = new Date().toISOString();

  // 1. Mark original event as rescheduled
  const { error: origErr } = await supabaseAdmin
    .from('events')
    .update({
      status:            'rescheduled',
      reschedule_reason: rescheduleNotes || null,
      confirmed_by:      profileId,
      confirmed_at:      now,
      updated_at:        now,
    })
    .eq('id', originalEventId);

  if (origErr) return { error: origErr.message };

  await supabaseAdmin
    .from('event_participants')
    .update({ attendance_status: 'rescheduled' })
    .eq('event_id', originalEventId);

  // 2. Create the new event
  const { data: newEvent, error: newErr } = await supabaseAdmin
    .from('events')
    .insert({
      title:                serviceType,
      event_type:           'medical',
      start_at:             newStartAt,
      end_at:               newEndAt,
      status:               'scheduled',
      specialist_id:        specialistId,
      original_event_id:    originalEventId,
      description:          rescheduleNotes || null,
      created_by_profile_id: profileId,
    })
    .select('id')
    .single();

  if (newErr || !newEvent) return { error: newErr?.message ?? 'Error al crear la nueva cita.' };

  // 3. Link athlete to new event
  await supabaseAdmin
    .from('event_participants')
    .insert({
      event_id:          newEvent.id,
      participant_id:    athleteId,
      participant_type:  'athlete',
      attendance_status: 'planned',
    });

  // 4. Push notification to athlete (best-effort)
  if (athleteProfileId) {
    const { data: tokens } = await supabaseAdmin
      .from('push_device_tokens')
      .select('onesignal_player_id')
      .eq('profile_id', athleteProfileId)
      .eq('is_active', true)
      .not('onesignal_player_id', 'is', null);

    const playerIds = (tokens ?? [])
      .map((t) => t.onesignal_player_id as string)
      .filter(Boolean);

    if (playerIds.length > 0) {
      const dateLabel = new Date(newStartAt).toLocaleString('es-MX', {
        weekday: 'long',
        month:   'long',
        day:     'numeric',
        hour:    '2-digit',
        minute:  '2-digit',
      });
      oneSignalAdapter.send({
        player_ids: playerIds,
        title: '📅 Tu cita fue reagendada',
        message: `Nueva cita: ${dateLabel}`,
        extra_data: { appointmentId: newEvent.id },
      }).catch(() => {});
    }
  }

  revalidatePath(`/medical/appointments/${originalEventId}`);
  revalidatePath('/medical/appointments');
  return { error: null, newEventId: newEvent.id };
}

// ---------------------------------------------------------------------------
// fetchAvailableSlots — returns slots for a specialist on a given date
// ---------------------------------------------------------------------------

export async function fetchAvailableSlots(
  specialistId: string,
  dateStr: string, // 'YYYY-MM-DD'
): Promise<{ slots: SlotInfo[]; error: string | null }> {
  const denied = await assertMedicalAccess();
  if (denied) return { slots: [], error: denied.error };

  const date = new Date(dateStr + 'T00:00:00');
  const dow = date.getDay(); // 0=Sun … 6=Sat

  // Fetch specialist availability for this day of week
  const { data: avail } = await supabaseAdmin
    .from('specialist_availability')
    .select('start_time, end_time, slot_minutes')
    .eq('specialist_id', specialistId)
    .eq('day_of_week', dow)
    .eq('is_active', true);

  // Default: 09:00–17:00, 30-min slots if no availability row
  const windows: { startH: number; startM: number; endH: number; endM: number; slotMin: number }[] =
    (avail && avail.length > 0)
      ? avail.map((a) => {
          const [sh, sm] = (a.start_time as string).split(':').map(Number);
          const [eh, em] = (a.end_time   as string).split(':').map(Number);
          return { startH: sh, startM: sm, endH: eh, endM: em, slotMin: a.slot_minutes ?? 30 };
        })
      : [{ startH: 9, startM: 0, endH: 17, endM: 0, slotMin: 30 }];

  // Build all possible slots
  const allSlots: string[] = [];
  for (const w of windows) {
    let cur = w.startH * 60 + w.startM;
    const end = w.endH  * 60 + w.endM;
    while (cur < end) {
      const h = Math.floor(cur / 60);
      const m = cur % 60;
      allSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      cur += w.slotMin;
    }
  }

  // Fetch already-booked events for this specialist on this date
  const dayStart = dateStr + 'T00:00:00';
  const dayEnd   = dateStr + 'T23:59:59';

  const { data: booked } = await supabaseAdmin
    .from('events')
    .select('start_at')
    .eq('specialist_id', specialistId)
    .gte('start_at', dayStart)
    .lte('start_at', dayEnd)
    .in('status', ['scheduled', 'show', 'planned']);

  const takenTimes = new Set(
    (booked ?? []).map((e) => {
      const d = new Date(e.start_at as string);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    })
  );

  const slots: SlotInfo[] = allSlots.map((t) => {
    const [h, m] = t.split(':').map(Number);
    const period = h < 12 ? 'AM' : 'PM';
    const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return {
      time:  t,
      label: `${h12}:${String(m).padStart(2, '0')} ${period}`,
      taken: takenTimes.has(t),
    };
  });

  return { slots, error: null };
}

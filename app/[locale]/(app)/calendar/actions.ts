'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission, getCurrentUser } from '@/lib/rbac/server';
import { sendEmailDirect } from '@/lib/notifications/email-service';
import { oneSignalAdapter } from '@/lib/notifications/providers/onesignal-adapter';
import { mxLocalToUTC } from '@/lib/timezone';

export async function createEvent(formData: FormData) {
  const denied = await assertPermission('manage_calendar');
  if (denied) return denied;

  // Always use the signed-in user's profile — never trust client-supplied value.
  const currentUser = await getCurrentUser();
  const createdByProfileId = currentUser?.profile?.id;
  if (!createdByProfileId) return { error: 'Could not resolve your profile. Please sign in again.' };

  const payload = {
    title:                 formData.get('title')                 as string,
    event_type:            formData.get('event_type')            as string,
    sport_id:             (formData.get('sport_id') as string)  || null,
    // Convert naive datetime-local values (no TZ suffix) from Mexico City local time to UTC.
    // Without this, PostgreSQL timestamptz would treat them as UTC, placing the event 5-6
    // hours earlier than intended.
    start_at:             mxLocalToUTC(formData.get('start_at') as string),
    end_at:               mxLocalToUTC(formData.get('end_at')   as string),
    status:               (formData.get('status') as string)    || 'scheduled',
    description:          (formData.get('description') as string) || null,
    created_by_profile_id: createdByProfileId,
  };

  // Insert event and get back the new row's id
  const { data: newEvent, error } = await supabaseAdmin
    .from('events')
    .insert(payload)
    .select('id')
    .single();

  if (error) return { error: error.message };

  // Link selected athletes as participants
  const athleteIds = (formData.getAll('athlete_id') as string[]).filter(Boolean);
  if (athleteIds.length > 0 && newEvent) {
    const { error: partErr } = await supabaseAdmin
      .from('event_participants')
      .insert(athleteIds.map((id) => ({
          event_id:          newEvent.id,
          participant_id:    id,
          participant_type:  'athlete',
          attendance_status: 'planned',
        })));
    if (partErr) return { error: `Event created but could not add participants: ${partErr.message}` };

    // Send notifications to participants if requested
    const notifyEmail = formData.get('notify_email') === 'on';
    const notifyPush  = formData.get('notify_push')  === 'on';

    if (notifyEmail || notifyPush) {
      const { data: athletes } = await supabaseAdmin
        .from('athletes')
        .select('id, first_name, last_name, email, profile_id')
        .in('id', athleteIds);

      if (athletes && athletes.length > 0) {
        const startDate = new Date(payload.start_at).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

        if (notifyEmail) {
          for (const athlete of athletes) {
            if (athlete.email) {
              // Non-blocking — ignore individual send errors
              sendEmailDirect({
                to:      athlete.email,
                subject: `New event: ${payload.title}`,
                html:    `<p>Hi ${athlete.first_name},</p><p>You have been invited to <strong>${payload.title}</strong> on ${startDate}.</p>`,
                text:    `Hi ${athlete.first_name}, you have been invited to "${payload.title}" on ${startDate}.`,
              }).catch(() => {});
            }
          }
        }

        if (notifyPush) {
          // Use profile_id (FK to profiles) — not athlete.id — to look up device tokens
          const profileIds = (athletes as { profile_id: string | null }[])
            .map((a) => a.profile_id)
            .filter((id): id is string => id != null);

          if (profileIds.length > 0) {
            const { data: tokens } = await supabaseAdmin
              .from('push_device_tokens')
              .select('onesignal_player_id')
              .in('profile_id', profileIds)
              .eq('is_active', true)
              .not('onesignal_player_id', 'is', null);

            const playerIds = (tokens ?? [])
              .map((t) => t.onesignal_player_id as string)
              .filter(Boolean);

            if (playerIds.length > 0) {
              oneSignalAdapter.send({
                player_ids: playerIds,
                title:      'New Event',
                message:    `${payload.title} — ${startDate}`,
              }).catch(() => {});
            }
          }
        }
      }
    }
  }

  revalidatePath('/calendar');
  revalidatePath('/medical/appointments');
  return { error: null };
}

export async function updateEvent(id: string, formData: FormData) {
  const denied = await assertPermission('manage_calendar');
  if (denied) return denied;

  const payload = {
    title:       formData.get('title')       as string,
    event_type:  formData.get('event_type')  as string,
    sport_id:   (formData.get('sport_id') as string) || null,
    // Convert naive datetime-local values from MX local time to UTC (same as createEvent)
    start_at:   mxLocalToUTC(formData.get('start_at') as string),
    end_at:     mxLocalToUTC(formData.get('end_at')   as string),
    status:      formData.get('status')      as string,
    description: (formData.get('description') as string) || null,
  };

  const { error } = await supabaseAdmin.from('events').update(payload).eq('id', id);
  if (error) return { error: error.message };

  // Update participants using a differential strategy to preserve attendance_status.
  // The old approach (delete-all + re-insert with 'planned') would erase attendance
  // records already registered by medical staff through /medical/appointments.
  const athleteIds = (formData.getAll('athlete_id') as string[]).filter(Boolean);

  // Fetch existing participants with their current attendance_status
  const { data: existing } = await supabaseAdmin
    .from('event_participants')
    .select('participant_id, attendance_status')
    .eq('event_id', id);

  const existingMap = new Map(
    (existing ?? []).map((p) => [p.participant_id as string, p.attendance_status as string])
  );
  const existingIds = new Set(existingMap.keys());
  const newIds      = new Set(athleteIds);

  // Remove participants that are no longer in the list
  const toDelete = [...existingIds].filter((pid) => !newIds.has(pid));
  if (toDelete.length > 0) {
    await supabaseAdmin
      .from('event_participants')
      .delete()
      .eq('event_id', id)
      .in('participant_id', toDelete);
  }

  // Insert only newly added participants (start as 'planned')
  const toInsert = athleteIds.filter((aid) => !existingIds.has(aid));
  if (toInsert.length > 0) {
    const { error: partErr } = await supabaseAdmin
      .from('event_participants')
      .insert(toInsert.map((aid) => ({
        event_id:          id,
        participant_id:    aid,
        participant_type:  'athlete',
        attendance_status: 'planned',
      })));
    if (partErr) return { error: `Event updated but participants failed: ${partErr.message}` };
  }
  // Participants present in both old and new lists are left untouched,
  // preserving any attendance_status recorded via /medical/appointments.

  if (athleteIds.length > 0) {
    // Notify participants of the update if requested
    const notifyEmail = formData.get('notify_email') === 'on';
    const notifyPush  = formData.get('notify_push')  === 'on';

    if (notifyEmail || notifyPush) {
      const title    = formData.get('title')    as string;
      const start_at = formData.get('start_at') as string;

      const { data: athletes } = await supabaseAdmin
        .from('athletes')
        .select('id, first_name, last_name, email, profile_id')
        .in('id', athleteIds);

      if (athletes && athletes.length > 0) {
        const startDate = new Date(start_at).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

        if (notifyEmail) {
          for (const athlete of athletes) {
            if (athlete.email) {
              sendEmailDirect({
                to:      athlete.email,
                subject: `Event updated: ${title}`,
                html:    `<p>Hi ${athlete.first_name},</p><p>The event <strong>${title}</strong> has been updated. It is now scheduled for ${startDate}.</p>`,
                text:    `Hi ${athlete.first_name}, the event "${title}" has been updated. It is now scheduled for ${startDate}.`,
              }).catch(() => {});
            }
          }
        }

        if (notifyPush) {
          const profileIds = (athletes as { profile_id: string | null }[])
            .map((a) => a.profile_id)
            .filter((id): id is string => id != null);

          if (profileIds.length > 0) {
            const { data: tokens } = await supabaseAdmin
              .from('push_device_tokens')
              .select('onesignal_player_id')
              .in('profile_id', profileIds)
              .eq('is_active', true)
              .not('onesignal_player_id', 'is', null);

            const playerIds = (tokens ?? [])
              .map((t) => t.onesignal_player_id as string)
              .filter(Boolean);

            if (playerIds.length > 0) {
              oneSignalAdapter.send({
                player_ids: playerIds,
                title:      'Event Updated',
                message:    `${title} — ${startDate}`,
              }).catch(() => {});
            }
          }
        }
      }
    }
  }

  revalidatePath('/calendar');
  revalidatePath('/medical/appointments');
  return { error: null };
}

export async function deleteEvent(id: string) {
  const denied = await assertPermission('manage_calendar');
  if (denied) return denied;

  const { error } = await supabaseAdmin.from('events').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/calendar');
  revalidatePath('/medical/appointments');
  return { error: null };
}

export async function updateEventStatus(id: string, status: string) {
  const denied = await assertPermission('manage_calendar');
  if (denied) return denied;

  const { error } = await supabaseAdmin
    .from('events')
    .update({ status })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/calendar');
  revalidatePath('/medical/appointments');
  return { error: null };
}

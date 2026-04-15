'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission } from '@/lib/rbac/server';
import { sendEmailDirect } from '@/lib/notifications/email-service';
import { oneSignalAdapter } from '@/lib/notifications/providers/onesignal-adapter';

export async function createEvent(formData: FormData) {
  const denied = await assertPermission('manage_calendar');
  if (denied) return denied;

  const payload = {
    title:                 formData.get('title')                 as string,
    event_type:            formData.get('event_type')            as string,
    sport_id:             (formData.get('sport_id') as string)  || null,
    start_at:              formData.get('start_at')              as string,
    end_at:                formData.get('end_at')                as string,
    status:               (formData.get('status') as string)    || 'scheduled',
    description:          (formData.get('description') as string) || null,
    created_by_profile_id: formData.get('created_by_profile_id') as string,
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
  return { error: null };
}

export async function updateEvent(id: string, formData: FormData) {
  const denied = await assertPermission('manage_calendar');
  if (denied) return denied;

  const payload = {
    title:       formData.get('title')       as string,
    event_type:  formData.get('event_type')  as string,
    sport_id:   (formData.get('sport_id') as string) || null,
    start_at:    formData.get('start_at')    as string,
    end_at:      formData.get('end_at')      as string,
    status:      formData.get('status')      as string,
    description: (formData.get('description') as string) || null,
  };

  const { error } = await supabaseAdmin.from('events').update(payload).eq('id', id);
  if (error) return { error: error.message };

  // Replace participants: delete all existing, then insert selected ones
  await supabaseAdmin.from('event_participants').delete().eq('event_id', id);

  const athleteIds = (formData.getAll('athlete_id') as string[]).filter(Boolean);
  if (athleteIds.length > 0) {
    const { error: partErr } = await supabaseAdmin
      .from('event_participants')
      .insert(athleteIds.map((aid) => ({
        event_id:          id,
        participant_id:    aid,
        participant_type:  'athlete',
        attendance_status: 'planned',
      })));
    if (partErr) return { error: `Event updated but participants failed: ${partErr.message}` };

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
  return { error: null };
}

export async function deleteEvent(id: string) {
  const denied = await assertPermission('manage_calendar');
  if (denied) return denied;

  const { error } = await supabaseAdmin.from('events').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/calendar');
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
  return { error: null };
}

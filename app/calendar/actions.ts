'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission } from '@/lib/rbac/server';

export async function createEvent(formData: FormData) {
  const denied = await assertPermission('manage_calendar');
  if (denied) return denied;
  const payload = {
    title: formData.get('title') as string,
    event_type: formData.get('event_type') as string,
    start_at: formData.get('start_at') as string,
    end_at: formData.get('end_at') as string,
    status: (formData.get('status') as string) || 'scheduled',
    description: (formData.get('description') as string) || null,
    created_by_profile_id: formData.get('created_by_profile_id') as string,
  };

  const { error } = await supabaseAdmin.from('events').insert(payload);

  if (error) {
    return { error: error.message };
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
    start_at:    formData.get('start_at')    as string,
    end_at:      formData.get('end_at')      as string,
    status:      formData.get('status')      as string,
    description: (formData.get('description') as string) || null,
  };

  const { error } = await supabaseAdmin.from('events').update(payload).eq('id', id);
  if (error) return { error: error.message };

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

'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission } from '@/lib/rbac/server';

export async function createTrainingSession(formData: FormData) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const payload = {
    athlete_id: formData.get('athlete_id') as string,
    coach_profile_id: formData.get('coach_profile_id') as string,
    title: formData.get('title') as string,
    session_date: formData.get('session_date') as string,
    start_time: (formData.get('start_time') as string) || null,
    end_time: (formData.get('end_time') as string) || null,
    location: (formData.get('location') as string) || null,
    notes: (formData.get('notes') as string) || null,
  };

  const { error } = await supabaseAdmin.from('training_sessions').insert(payload);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/follow-up/training');
  return { error: null };
}

export async function updateTrainingSession(id: string, formData: FormData) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const payload = {
    title:        formData.get('title')        as string,
    session_date: formData.get('session_date') as string,
    start_time:   (formData.get('start_time') as string) || null,
    end_time:     (formData.get('end_time')   as string) || null,
    location:     (formData.get('location')   as string) || null,
    notes:        (formData.get('notes')      as string) || null,
  };

  const { error } = await supabaseAdmin
    .from('training_sessions')
    .update(payload)
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/follow-up/training');
  return { error: null };
}

export async function deleteTrainingSession(id: string) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const { error } = await supabaseAdmin
    .from('training_sessions')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/follow-up/training');
  return { error: null };
}

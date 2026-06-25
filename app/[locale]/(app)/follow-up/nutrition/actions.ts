'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission } from '@/lib/rbac/server';

export async function createNutritionPlan(formData: FormData) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const payload = {
    athlete_id: formData.get('athlete_id') as string,
    nutritionist_profile_id: formData.get('nutritionist_profile_id') as string,
    title: formData.get('title') as string,
    start_date: formData.get('start_date') as string,
    end_date: (formData.get('end_date') as string) || null,
    status: (formData.get('status') as string) || 'active',
  };

  const { error } = await supabaseAdmin.from('nutrition_plans').insert(payload);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/follow-up/nutrition');
  return { error: null };
}

export async function updateNutritionPlan(id: string, formData: FormData) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const editReason = (formData.get('edit_reason') as string)?.trim();
  const todayStr = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric' });
  const titleBase = formData.get('title') as string;
  let title = titleBase;
  if (editReason) {
    title = titleBase; // title stays clean; reason goes in audit log but we have no notes field on plans
  }

  const payload: Record<string, unknown> = {
    title,
    start_date: formData.get('start_date') as string,
    end_date: (formData.get('end_date') as string) || null,
    status: formData.get('status') as string,
  };

  const { error } = await supabaseAdmin.from('nutrition_plans').update(payload).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/follow-up/nutrition');
  return { error: null };
}

export async function updateNutritionPlanStatus(id: string, status: string) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const { error } = await supabaseAdmin
    .from('nutrition_plans')
    .update({ status })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/follow-up/nutrition');
  return { error: null };
}

export async function updateNutritionCheckin(id: string, formData: FormData) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const adherenceRaw = formData.get('adherence_score') as string;
  const weightRaw = formData.get('weight_kg') as string;
  const bodyFatRaw = formData.get('body_fat_percent') as string;
  const existingNotes = (formData.get('notes') as string) || null;
  const editReason = (formData.get('edit_reason') as string)?.trim();
  const todayStr = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric' });

  let notes = existingNotes;
  if (editReason) {
    const entry = `[Modificado ${todayStr}: ${editReason}]`;
    notes = existingNotes ? `${existingNotes}\n${entry}` : entry;
  }

  const payload = {
    checkin_date: formData.get('checkin_date') as string,
    weight_kg: weightRaw ? parseFloat(weightRaw) : null,
    body_fat_percent: bodyFatRaw ? parseFloat(bodyFatRaw) : null,
    adherence_score: adherenceRaw ? parseInt(adherenceRaw, 10) : null,
    notes,
    next_actions: (formData.get('next_actions') as string) || null,
  };

  const { error } = await supabaseAdmin
    .from('nutrition_checkins')
    .update(payload)
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/follow-up/nutrition');
  return { error: null };
}

export async function createNutritionCheckin(formData: FormData) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const adherenceRaw = formData.get('adherence_score') as string;
  const weightRaw = formData.get('weight_kg') as string;
  const bodyFatRaw = formData.get('body_fat_percent') as string;

  const payload = {
    athlete_id: formData.get('athlete_id') as string,
    nutritionist_profile_id: formData.get('nutritionist_profile_id') as string,
    checkin_date: formData.get('checkin_date') as string,
    weight_kg: weightRaw ? parseFloat(weightRaw) : null,
    body_fat_percent: bodyFatRaw ? parseFloat(bodyFatRaw) : null,
    adherence_score: adherenceRaw ? parseInt(adherenceRaw, 10) : null,
    notes: (formData.get('notes') as string) || null,
    next_actions: (formData.get('next_actions') as string) || null,
  };

  const { error } = await supabaseAdmin.from('nutrition_checkins').insert(payload);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/follow-up/nutrition');
  return { error: null };
}

'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function createNutritionPlan(formData: FormData) {
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

export async function updateNutritionPlanStatus(id: string, status: string) {
  const { error } = await supabaseAdmin
    .from('nutrition_plans')
    .update({ status })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/follow-up/nutrition');
  return { error: null };
}

export async function createNutritionCheckin(formData: FormData) {
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

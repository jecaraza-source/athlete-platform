'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function createPsychologyCase(formData: FormData) {
  const payload = {
    athlete_id: formData.get('athlete_id') as string,
    psychologist_profile_id: formData.get('psychologist_profile_id') as string,
    status: (formData.get('status') as string) || 'open',
    opened_at: formData.get('opened_at') as string,
    summary: (formData.get('summary') as string) || null,
  };

  const { error } = await supabaseAdmin.from('psychology_cases').insert(payload);

  if (error) return { error: error.message };

  revalidatePath('/follow-up/psychology');
  return { error: null };
}

export async function updatePsychologySession(id: string, formData: FormData) {
  const moodRaw = formData.get('mood_score') as string;
  const stressRaw = formData.get('stress_score') as string;

  const payload = {
    session_date: formData.get('session_date') as string,
    mood_score: moodRaw ? parseInt(moodRaw, 10) : null,
    stress_score: stressRaw ? parseInt(stressRaw, 10) : null,
    topic_summary: (formData.get('topic_summary') as string) || null,
    recommendations: (formData.get('recommendations') as string) || null,
    next_session_date: (formData.get('next_session_date') as string) || null,
  };

  const { error } = await supabaseAdmin
    .from('psychology_sessions')
    .update(payload)
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/follow-up/psychology');
  return { error: null };
}

export async function updatePsychologyCaseStatus(id: string, status: string) {
  const { error } = await supabaseAdmin
    .from('psychology_cases')
    .update({ status })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/follow-up/psychology');
  return { error: null };
}

export async function createPsychologySession(formData: FormData) {
  const moodRaw = formData.get('mood_score') as string;
  const stressRaw = formData.get('stress_score') as string;

  const payload = {
    psychology_case_id: formData.get('psychology_case_id') as string,
    session_date: formData.get('session_date') as string,
    mood_score: moodRaw ? parseInt(moodRaw, 10) : null,
    stress_score: stressRaw ? parseInt(stressRaw, 10) : null,
    topic_summary: (formData.get('topic_summary') as string) || null,
    recommendations: (formData.get('recommendations') as string) || null,
    next_session_date: (formData.get('next_session_date') as string) || null,
  };

  const { error } = await supabaseAdmin.from('psychology_sessions').insert(payload);

  if (error) return { error: error.message };

  revalidatePath('/follow-up/psychology');
  return { error: null };
}

'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function createPhysioCase(formData: FormData) {
  const payload = {
    athlete_id: formData.get('athlete_id') as string,
    physio_profile_id: formData.get('physio_profile_id') as string,
    injury_id: (formData.get('injury_id') as string) || null,
    status: (formData.get('status') as string) || 'open',
    opened_at: formData.get('opened_at') as string,
  };

  const { error } = await supabaseAdmin.from('physio_cases').insert(payload);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/follow-up/physio');
  return { error: null };
}

export async function createPhysioSession(formData: FormData) {
  const painRaw = formData.get('pain_score') as string;
  const mobilityRaw = formData.get('mobility_score') as string;

  const payload = {
    physio_case_id: formData.get('physio_case_id') as string,
    session_date: formData.get('session_date') as string,
    treatment_summary: formData.get('treatment_summary') as string,
    pain_score: painRaw ? parseInt(painRaw, 10) : null,
    mobility_score: mobilityRaw ? parseInt(mobilityRaw, 10) : null,
    notes: (formData.get('notes') as string) || null,
    next_session_date: (formData.get('next_session_date') as string) || null,
  };

  const { error } = await supabaseAdmin.from('physio_sessions').insert(payload);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/follow-up/physio');
  return { error: null };
}

export async function updatePhysioCaseStatus(id: string, status: string) {
  const { error } = await supabaseAdmin
    .from('physio_cases')
    .update({ status })
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/follow-up/physio');
  return { error: null };
}

export async function updatePhysioSession(id: string, formData: FormData) {
  const painRaw = formData.get('pain_score') as string;
  const mobilityRaw = formData.get('mobility_score') as string;

  const payload = {
    session_date: formData.get('session_date') as string,
    treatment_summary: (formData.get('treatment_summary') as string) || null,
    pain_score: painRaw ? parseInt(painRaw, 10) : null,
    mobility_score: mobilityRaw ? parseInt(mobilityRaw, 10) : null,
    notes: (formData.get('notes') as string) || null,
    next_session_date: (formData.get('next_session_date') as string) || null,
  };

  const { error } = await supabaseAdmin
    .from('physio_sessions')
    .update(payload)
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/follow-up/physio');
  return { error: null };
}

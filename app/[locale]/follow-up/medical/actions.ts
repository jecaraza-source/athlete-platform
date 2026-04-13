'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission } from '@/lib/rbac/server';

// ---------------------------------------------------------------------------
// Medical cases
// ---------------------------------------------------------------------------

export async function createMedicalCase(formData: FormData) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const payload = {
    athlete_id:        formData.get('athlete_id') as string,
    doctor_profile_id: (formData.get('doctor_profile_id') as string) || null,
    condition:         (formData.get('condition') as string) || null,
    status:            (formData.get('status') as string) || 'open',
    opened_at:         formData.get('opened_at') as string,
    notes:             (formData.get('notes') as string) || null,
  };

  const { error } = await supabaseAdmin.from('medical_cases').insert(payload);
  if (error) return { error: error.message };

  revalidatePath('/follow-up/medical');
  return { error: null };
}

export async function updateMedicalCaseStatus(id: string, status: string) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const { error } = await supabaseAdmin
    .from('medical_cases')
    .update({ status })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/follow-up/medical');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Medical sessions
// ---------------------------------------------------------------------------

export async function createMedicalSession(formData: FormData) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const num = (key: string) => {
    const v = formData.get(key) as string;
    return v ? parseInt(v, 10) : null;
  };
  const float = (key: string) => {
    const v = formData.get(key) as string;
    return v ? parseFloat(v) : null;
  };

  const payload = {
    medical_case_id:   formData.get('medical_case_id') as string,
    session_date:      formData.get('session_date') as string,
    treatment_summary: (formData.get('treatment_summary') as string) || null,
    pain_score:        num('pain_score'),
    health_score:      num('health_score'),
    weight_kg:         float('weight_kg'),
    blood_pressure:    (formData.get('blood_pressure') as string) || null,
    adherence_score:   num('adherence_score'),
    notes:             (formData.get('notes') as string) || null,
    next_session_date: (formData.get('next_session_date') as string) || null,
  };

  const { error } = await supabaseAdmin.from('medical_sessions').insert(payload);
  if (error) return { error: error.message };

  revalidatePath('/follow-up/medical');
  return { error: null };
}

export async function updateMedicalSession(id: string, formData: FormData) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;

  const num = (key: string) => {
    const v = formData.get(key) as string;
    return v ? parseInt(v, 10) : null;
  };
  const float = (key: string) => {
    const v = formData.get(key) as string;
    return v ? parseFloat(v) : null;
  };

  const payload = {
    session_date:      formData.get('session_date') as string,
    treatment_summary: (formData.get('treatment_summary') as string) || null,
    pain_score:        num('pain_score'),
    health_score:      num('health_score'),
    weight_kg:         float('weight_kg'),
    blood_pressure:    (formData.get('blood_pressure') as string) || null,
    adherence_score:   num('adherence_score'),
    notes:             (formData.get('notes') as string) || null,
    next_session_date: (formData.get('next_session_date') as string) || null,
  };

  const { error } = await supabaseAdmin
    .from('medical_sessions')
    .update(payload)
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/follow-up/medical');
  return { error: null };
}

'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission } from '@/lib/rbac/server';

export async function updateAthlete(id: string, formData: FormData) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;
  const raw = (key: string) => (formData.get(key) as string) || null;
  const num = (key: string) => {
    const v = formData.get(key) as string;
    return v ? parseFloat(v) : null;
  };

  const section = formData.get('section') as string;

  let payload: Record<string, unknown> = {};

  if (section === 'general') {
    payload = {
      date_of_birth:     raw('date_of_birth'),
      sex:               raw('sex'),
      dominant_side:     raw('dominant_side'),
      height_cm:         num('height_cm'),
      weight_kg:         num('weight_kg'),
      school_or_club:    raw('school_or_club'),
      discipline:        raw('discipline'),
      disability_status: raw('disability_status'),
      email:             raw('email'),
    };
  } else if (section === 'guardian') {
    payload = {
      guardian_name: raw('guardian_name'),
      guardian_phone: raw('guardian_phone'),
      guardian_email: raw('guardian_email'),
    };
  } else if (section === 'emergency') {
    payload = {
      emergency_contact_name: raw('emergency_contact_name'),
      emergency_contact_phone: raw('emergency_contact_phone'),
      medical_notes_summary: raw('medical_notes_summary'),
    };
  } else if (section === 'account') {
    // Link or unlink the athlete's Supabase Auth profile
    const profileId = (formData.get('profile_id') as string) || null;
    payload = { profile_id: profileId };
  }

  const { error } = await supabaseAdmin
    .from('athletes')
    .update(payload)
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath(`/athletes/${id}`);
  return { error: null };
}

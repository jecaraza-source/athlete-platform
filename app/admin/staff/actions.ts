'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/rbac/server';

async function ensureAthleteRow(
  profileId: string,
  firstName: string,
  lastName: string,
  schoolOrClub: string | null,
): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from('athletes')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (!existing) {
    const { error } = await supabaseAdmin.from('athletes').insert({
      profile_id: profileId,
      first_name: firstName,
      last_name: lastName,
      school_or_club: schoolOrClub,
      status: 'active',
    });
    if (error) return error.message;
  }
  return null;
}

export async function createProfile(formData: FormData) {
  await requirePermission('manage_users');

  const email = (formData.get('email') as string)?.trim();
  if (!email) return { error: 'Email is required to create a new profile.' };

  // Create the Supabase Auth user first so we have an auth_user_id
  let authUserId: string;

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (authError) {
    const alreadyExists =
      authError.message.toLowerCase().includes('already been registered') ||
      authError.message.toLowerCase().includes('already registered');

    if (!alreadyExists) return { error: authError.message };

    // Auth user exists — find their ID
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existing = users.find((u) => u.email === email);
    if (!existing) return { error: authError.message };

    // Check if a profile already exists for this auth user
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('auth_user_id', existing.id)
      .maybeSingle();

    if (existingProfile) {
      return {
        error: `This email is already registered to ${existingProfile.first_name} ${existingProfile.last_name}. Use a different email or edit the existing profile.`,
      };
    }

    authUserId = existing.id;
  } else {
    authUserId = authData.user.id;
  }

  const payload = {
    auth_user_id: authUserId,
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    email,
    role: (formData.get('role') as string) || null,
    phone: (formData.get('phone') as string) || null,
    specialty: (formData.get('specialty') as string) || null,
  };

  const { error } = await supabaseAdmin.from('profiles').insert(payload);

  if (error) {
    if (error.message.includes('profiles_auth_user_id_key') || error.message.includes('duplicate key')) {
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      if (existing) {
        return {
          error: `This email is already registered to ${existing.first_name} ${existing.last_name}. Use a different email or edit the existing profile.`,
        };
      }
    }
    // Roll back the auth user only if it was newly created
    await supabaseAdmin.auth.admin.deleteUser(authUserId);
    return { error: error.message };
  }

  // Create the athletes table row when the role is 'athlete'
  if (payload.role === 'athlete') {
    const { data: newProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (!newProfile) {
      return { error: 'Profile was created but could not be retrieved. Refresh and try again.' };
    }

    const athleteError = await ensureAthleteRow(
      newProfile.id,
      payload.first_name,
      payload.last_name,
      (formData.get('school_or_club') as string) || null,
    );
    if (athleteError) {
      return { error: `Profile created but athlete record failed: ${athleteError}` };
    }
  }

  revalidatePath('/admin/staff');
  revalidatePath('/admin/athletes');
  revalidatePath('/athletes');
  return { error: null };
}

export async function updateProfile(id: string, formData: FormData) {
  await requirePermission('manage_users');

  const base = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
  };

  const full = {
    ...base,
    role: (formData.get('role') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    specialty: (formData.get('specialty') as string) || null,
  };

  const { error } = await supabaseAdmin.from('profiles').update(full).eq('id', id);

  if (error?.message?.includes('does not exist')) {
    const { error: basicError } = await supabaseAdmin.from('profiles').update(base).eq('id', id);
    if (basicError) return { error: basicError.message };
    revalidatePath('/admin/staff');
  revalidatePath('/admin/athletes');
    return { error: null };
  }

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin/staff');
  revalidatePath('/admin/athletes');
  return { error: null };
}

export async function deleteProfile(id: string) {
  await requirePermission('manage_users');

  // Remove linked athlete row first
  await supabaseAdmin.from('athletes').delete().eq('profile_id', id);

  // Nullify all FK references from other tables (or delete if column is NOT NULL)
  const nullifyOrDelete = async (table: string, column: string) => {
    const { error } = await supabaseAdmin.from(table).update({ [column]: null }).eq(column, id);
    if (error) await supabaseAdmin.from(table).delete().eq(column, id);
  };

  await Promise.all([
    nullifyOrDelete('athlete_notes', 'author_profile_id'),
    nullifyOrDelete('nutrition_plans', 'nutritionist_profile_id'),
    nullifyOrDelete('nutrition_checkins', 'nutritionist_profile_id'),
    nullifyOrDelete('training_sessions', 'coach_profile_id'),
    nullifyOrDelete('physio_cases', 'physio_profile_id'),
    nullifyOrDelete('psychology_cases', 'psychologist_profile_id'),
    nullifyOrDelete('events', 'created_by_profile_id'),
  ]);

  const { error } = await supabaseAdmin.from('profiles').delete().eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin/staff');
  revalidatePath('/admin/athletes');
  revalidatePath('/athletes');
  return { error: null };
}

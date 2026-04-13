'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/rbac/server';
import { SECTION_KEYS } from '@/lib/types/diagnostic';

/** Crea o recupera la fila de athletes y devuelve su ID. */
async function ensureAthleteRow(
  profileId: string,
  firstName: string,
  lastName: string,
  discipline: string | null,
  disabilityStatus: string | null,
): Promise<{ athleteId: string } | { error: string }> {
  const { data: existing } = await supabaseAdmin
    .from('athletes')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existing) return { athleteId: existing.id };

  const { data, error } = await supabaseAdmin
    .from('athletes')
    .insert({
      profile_id:       profileId,
      first_name:       firstName,
      last_name:        lastName,
      discipline:       discipline,
      disability_status: disabilityStatus,
      status:           'active',
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  return { athleteId: data.id };
}

/**
 * Crea el expediente de diagnóstico inicial para un atleta recién dado de alta.
 * Genera el registro principal + 5 secciones en estado 'pendiente'.
 */
async function createInitialDiagnostic(athleteId: string): Promise<void> {
  // Evitar duplicados
  const { data: existing } = await supabaseAdmin
    .from('athlete_initial_diagnostic')
    .select('id')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (existing) return;

  const { data: diagnostic, error: diagError } = await supabaseAdmin
    .from('athlete_initial_diagnostic')
    .insert({ athlete_id: athleteId })
    .select('id')
    .single();

  if (diagError || !diagnostic) return;

  // Crear las 5 secciones en paralelo
  await supabaseAdmin.from('athlete_diagnostic_sections').insert(
    SECTION_KEYS.map((section) => ({
      diagnostic_id: diagnostic.id,
      athlete_id:    athleteId,
      section,
    }))
  );
}

/** Assigns a role (by code) in the RBAC user_roles table.
 *  Silently ignores duplicate-key errors (role already assigned). */
async function assignRbacRole(profileId: string, roleCode: string): Promise<void> {
  const { data: role } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('code', roleCode)
    .maybeSingle();
  if (role) {
    // ON CONFLICT DO NOTHING — duplicate key just means already assigned
    await supabaseAdmin
      .from('user_roles')
      .insert({ profile_id: profileId, role_id: role.id });
    // Ignore the returned error; a duplicate key here is expected and harmless
  }
}

export async function createProfile(formData: FormData) {
  await requirePermission('manage_users');

  const email = (formData.get('email') as string)?.trim();
  if (!email) return { error: 'Email is required to create a new profile.' };

  const profileFields = {
    first_name: formData.get('first_name') as string,
    last_name:  formData.get('last_name')  as string,
    email,
    role:      (formData.get('role')      as string) || null,
    phone:     (formData.get('phone')     as string) || null,
    specialty: (formData.get('specialty') as string) || null,
  };

  // ── 1. Create (or locate) the Supabase Auth user ─────────────────────────
  let authUserId: string;
  let authUserWasNew = false;

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });

  if (authError) {
    const alreadyExists =
      authError.message.toLowerCase().includes('already been registered') ||
      authError.message.toLowerCase().includes('already registered');
    if (!alreadyExists) return { error: authError.message };

    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const found = users.find((u) => u.email === email);
    if (!found) return { error: authError.message };
    authUserId = found.id;
    authUserWasNew = false;
  } else {
    authUserId = authData.user.id;
    authUserWasNew = true;
  }

  // ── 2. Handle the profile row ─────────────────────────────────────────────
  //
  // Some Supabase projects have a DB trigger that auto-creates a stub profile
  // (e.g. first_name='New', last_name='User') the moment an auth user is made.
  // We detect that here and UPDATE it instead of failing on a duplicate-key error.

  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  let profileId: string;

  if (existingProfile) {
    if (!authUserWasNew) {
      // Auth user pre-existed with a real profile — do not overwrite.
      return {
        error: `This email is already registered to ${existingProfile.first_name} ${existingProfile.last_name}. Use a different email or edit the existing profile.`,
      };
    }

    // Auth user was just created but a stub profile was auto-created by a DB trigger.
    // Update it with the real data submitted by the admin.
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(profileFields)
      .eq('id', existingProfile.id);

    if (updateError) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return { error: updateError.message };
    }
    profileId = existingProfile.id;
  } else {
    // No existing profile — insert a fresh one.
    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({ auth_user_id: authUserId, ...profileFields });

    if (insertError) {
      if (
        insertError.message.includes('profiles_auth_user_id_key') ||
        insertError.message.includes('duplicate key')
      ) {
        // Race condition: trigger fired between our check and our insert.
        // Try to update the auto-created stub.
        const { data: raceProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('auth_user_id', authUserId)
          .maybeSingle();

        if (raceProfile && authUserWasNew) {
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update(profileFields)
            .eq('id', raceProfile.id);
          if (updateError) {
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            return { error: updateError.message };
          }
          profileId = raceProfile.id;
        } else {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
          return { error: insertError.message };
        }
      } else {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        return { error: insertError.message };
      }
    } else {
      // Fetch the inserted row's ID
      const { data: inserted } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      if (!inserted) return { error: 'Profile saved but ID not found. Please refresh.' };
      profileId = inserted.id;
    }
  }

  // ── 3. Athlete-specific setup ─────────────────────────────────────────────
  if (profileFields.role === 'athlete') {
    const discipline       = (formData.get('discipline')        as string) || null;
    const disabilityStatus = (formData.get('disability_status') as string) || null;

    const athleteResult = await ensureAthleteRow(
      profileId,
      profileFields.first_name,
      profileFields.last_name,
      discipline,
      disabilityStatus,
    );

    if ('error' in athleteResult) {
      return { error: `Perfil creado pero registro de atleta falló: ${athleteResult.error}` };
    }

    // Crear el diagnóstico inicial automáticamente
    await createInitialDiagnostic(athleteResult.athleteId);

    // Asignar rol RBAC
    await assignRbacRole(profileId, 'athlete');

    revalidatePath('/admin/staff');
    revalidatePath('/admin/athletes');
    revalidatePath('/athletes');
    return { error: null, athleteId: athleteResult.athleteId };
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

'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission, getCurrentUser } from '@/lib/rbac/server';

export async function assignRole(profileId: string, roleId: string) {
  await requirePermission('manage_users');

  // role_id is an INTEGER in the existing schema; coerce from the string
  // value passed by the select element.
  const { error } = await supabaseAdmin.from('user_roles').insert({
    profile_id: profileId,
    role_id: Number(roleId),
  });

  if (error) {
    if (error.code === '23505') return { error: 'Role already assigned.' };
    return { error: error.message };
  }

  revalidatePath('/admin/access-control/users');
  return { error: null };
}

export async function revokeRole(profileId: string, roleId: string) {
  await requirePermission('manage_users');

  const { error } = await supabaseAdmin
    .from('user_roles')
    .delete()
    .eq('profile_id', profileId)
    .eq('role_id', Number(roleId));

  if (error) return { error: error.message };

  revalidatePath('/admin/access-control/users');
  return { error: null };
}

/**
 * Permanently delete a user: nullifies FK references across all tables,
 * removes the profile row, then deletes the Supabase Auth account.
 * Restricted to super_admin only. Cannot be used to delete yourself.
 */
export async function deleteUser(
  profileId: string,
  authUserId: string,
): Promise<{ error: string | null }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'You must be signed in.' };

  const isSuperAdmin = currentUser.roles.some((r) => r.code === 'super_admin');
  if (!isSuperAdmin) return { error: 'Only super admins can delete users.' };

  if (currentUser.profile?.id === profileId) {
    return { error: 'You cannot delete your own account.' };
  }

  // Nullify FK references (or delete rows when the column is NOT NULL)
  const nullifyOrDelete = async (table: string, column: string) => {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ [column]: null })
      .eq(column, profileId);
    if (error) await supabaseAdmin.from(table).delete().eq(column, profileId);
  };

  await Promise.all([
    // athlete_notes is a pre-existing base-schema table (see 000_base_schema.sql)
    nullifyOrDelete('athlete_notes',        'author_profile_id'),
    nullifyOrDelete('nutrition_plans',      'nutritionist_profile_id'),
    nullifyOrDelete('nutrition_checkins',   'nutritionist_profile_id'),
    nullifyOrDelete('training_sessions',    'coach_profile_id'),
    nullifyOrDelete('physio_cases',         'physio_profile_id'),
    nullifyOrDelete('psychology_cases',     'psychologist_profile_id'),
    nullifyOrDelete('events',               'created_by_profile_id'),
    nullifyOrDelete('medical_cases',        'doctor_profile_id'),
  ]);

  // Remove linked athlete row (cascades further via athletes FK)
  await supabaseAdmin.from('athletes').delete().eq('profile_id', profileId);

  // Delete the profile row
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', profileId);
  if (profileError) return { error: profileError.message };

  // Remove the Supabase Auth account — this prevents the user from signing in
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
  if (authError) return { error: authError.message };

  revalidatePath('/admin/access-control/users');
  revalidatePath('/admin/staff');
  return { error: null };
}

/**
 * Change the Supabase Auth password for a user.
 * Only users with the super_admin role can call this — it uses the
 * service-role admin API which bypasses the existing password entirely.
 */
export async function changeUserPassword(
  authUserId: string,
  newPassword: string,
): Promise<{ error: string | null }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'You must be signed in.' };

  const isSuperAdmin = currentUser.roles.some((r) => r.code === 'super_admin');
  if (!isSuperAdmin) return { error: 'Only super admins can change user passwords.' };

  if (!newPassword || newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
    password: newPassword,
  });

  if (error) return { error: error.message };
  return { error: null };
}

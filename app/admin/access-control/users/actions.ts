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

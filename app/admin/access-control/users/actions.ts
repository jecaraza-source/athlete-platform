'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission, getCurrentUser } from '@/lib/rbac/server';

export async function assignRole(profileId: string, roleId: string) {
  await requirePermission('manage_users');

  const actor = await getCurrentUser();

  const { error } = await supabaseAdmin.from('user_roles').insert({
    profile_id: profileId,
    role_id: roleId,
    assigned_by_profile_id: actor?.profile?.id ?? null,
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
    .eq('role_id', roleId);

  if (error) return { error: error.message };

  revalidatePath('/admin/access-control/users');
  return { error: null };
}

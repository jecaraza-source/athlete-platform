'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/rbac/server';

// ---------------------------------------------------------------------------
// Role CRUD
// ---------------------------------------------------------------------------

export async function createRole(formData: FormData) {
  await requirePermission('manage_roles');

  const name = (formData.get('name') as string)?.trim().toLowerCase().replace(/\s+/g, '_');
  const description = (formData.get('description') as string)?.trim() || null;

  if (!name) return { error: 'Role name is required.' };

  const { error } = await supabaseAdmin.from('roles').insert({ name, description });

  if (error) {
    if (error.code === '23505') return { error: `A role named "${name}" already exists.` };
    return { error: error.message };
  }

  revalidatePath('/admin/access-control/roles');
  revalidatePath('/admin/access-control');
  return { error: null };
}

export async function updateRole(id: string | number, formData: FormData) {
  await requirePermission('manage_roles');

  const description = (formData.get('description') as string)?.trim() || null;

  const { error } = await supabaseAdmin
    .from('roles')
    .update({ description })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/admin/access-control/roles');
  revalidatePath(`/admin/access-control/roles/${id}`);
  return { error: null };
}

export async function deleteRole(id: string | number) {
  await requirePermission('manage_roles');

  // Prevent deletion of system roles
  const { data: role } = await supabaseAdmin
    .from('roles')
    .select('is_system')
    .eq('id', id)
    .maybeSingle();

  if (role?.is_system) {
    return { error: 'System roles cannot be deleted.' };
  }

  const { error } = await supabaseAdmin.from('roles').delete().eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/admin/access-control/roles');
  revalidatePath('/admin/access-control');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Permission assignment for a role
// ---------------------------------------------------------------------------

/**
 * Replaces the full permission set for a role.
 * Takes a FormData with checkbox values: permission_id[]=<uuid>, ...
 */
export async function setRolePermissions(roleId: string | number, formData: FormData) {
  await requirePermission('manage_permissions');

  const permissionIds = formData.getAll('permission_id') as string[];

  // Delete all existing assignments
  const { error: deleteError } = await supabaseAdmin
    .from('role_permissions')
    .delete()
    .eq('role_id', roleId);

  if (deleteError) return { error: deleteError.message };

  // Re-insert checked permissions
  if (permissionIds.length > 0) {
    // role_id is INTEGER in the existing schema
    const rows = permissionIds.map((pid) => ({ role_id: Number(roleId), permission_id: pid }));
    const { error: insertError } = await supabaseAdmin.from('role_permissions').insert(rows);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/admin/access-control/roles/${roleId}`);
  revalidatePath('/admin/access-control/roles');
  return { error: null };
}

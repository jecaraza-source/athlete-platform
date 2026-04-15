'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/rbac/server';

export async function createPermission(formData: FormData) {
  await requirePermission('manage_permissions');

  const name = (formData.get('name') as string)?.trim().toLowerCase().replace(/\s+/g, '_');
  const description = (formData.get('description') as string)?.trim() || null;

  if (!name) return { error: 'Permission name is required.' };

  const { error } = await supabaseAdmin.from('permissions').insert({ name, description });

  if (error) {
    if (error.code === '23505') return { error: `A permission named "${name}" already exists.` };
    return { error: error.message };
  }

  revalidatePath('/admin/access-control/permissions');
  revalidatePath('/admin/access-control');
  return { error: null };
}

export async function deletePermission(id: string) {
  await requirePermission('manage_permissions');

  // Cascade handles role_permissions rows automatically
  const { error } = await supabaseAdmin.from('permissions').delete().eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/admin/access-control/permissions');
  revalidatePath('/admin/access-control');
  return { error: null };
}

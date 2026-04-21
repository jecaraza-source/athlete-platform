'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertAdminAccess } from '@/lib/rbac/server';

export async function createDiscipline(formData: FormData) {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const name = (formData.get('name') as string | null)?.trim();
  if (!name) return { error: 'El nombre es requerido.' };

  const category_type = (formData.get('category_type') as string) || 'individual';

  const { error } = await supabaseAdmin
    .from('sports')
    .insert({ name, category_type, status: 'active' });

  if (error) {
    if (error.code === '23505') return { error: `Ya existe una disciplina con el nombre "${name}".` };
    return { error: error.message };
  }

  revalidatePath('/admin/disciplines');
  return { error: null };
}

export async function deleteDiscipline(id: string) {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const { error } = await supabaseAdmin.from('sports').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/disciplines');
  return { error: null };
}

export async function toggleDisciplineStatus(id: string, status: 'active' | 'inactive') {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const { error } = await supabaseAdmin.from('sports').update({ status }).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/disciplines');
  return { error: null };
}

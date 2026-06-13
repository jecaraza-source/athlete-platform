'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertAdminAccess } from '@/lib/rbac/server';

export async function createDiscipline(formData: FormData) {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const code = (formData.get('code') as string | null)?.trim().toLowerCase().replace(/\s+/g, '_');
  const name = (formData.get('name') as string | null)?.trim();
  const block = (formData.get('block') as string | null)?.trim() || 'combate';

  if (!code) return { error: 'El código es requerido.' };
  if (!name) return { error: 'El nombre es requerido.' };

  const { error } = await supabaseAdmin
    .from('cat_disciplines')
    .insert({ code, name, block });

  if (error) {
    if (error.code === '23505') return { error: `Ya existe una disciplina con el código "${code}".` };
    return { error: error.message };
  }

  revalidatePath('/admin/disciplines');
  revalidatePath('/athletes');
  return { error: null };
}

export async function deleteDiscipline(id: string) {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const { error } = await supabaseAdmin.from('cat_disciplines').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/disciplines');
  revalidatePath('/athletes');
  return { error: null };
}

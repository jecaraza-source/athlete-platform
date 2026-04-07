'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * Accept only root-relative paths to prevent open-redirect attacks.
 * e.g. "/dashboard" is accepted; "https://evil.com" or "//evil.com" are not.
 */
function sanitizeRedirectTo(raw: FormDataEntryValue | null): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

export async function signIn(formData: FormData) {
  const email = (formData.get('email') as string)?.trim();
  const password = formData.get('password') as string;
  const redirectTo = sanitizeRedirectTo(formData.get('redirectTo'));

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect(redirectTo);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

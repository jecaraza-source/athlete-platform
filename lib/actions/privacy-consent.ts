'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function acceptPrivacyConsent(): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'No autenticado.' };

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ privacy_consent_accepted_at: new Date().toISOString() })
    .eq('auth_user_id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return {};
}

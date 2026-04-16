'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function requestPasswordReset(
  formData: FormData
): Promise<{ error: string | null; sent: boolean }> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();

  if (!email) {
    return { error: 'El correo electrónico es requerido.', sent: false };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Supabase enviará un correo con un enlace al resetPasswordURL configurado
    // en el proyecto (Authentication → URL Configuration → Redirect URLs).
    // Si NEXT_PUBLIC_APP_URL está definido, lo usamos como redirectTo.
    redirectTo: process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`
      : undefined,
  });

  if (error) {
    // No revelar si el correo existe o no — mostrar mensaje genérico para
    // proteger contra enumeración de cuentas.
    console.error('[auth] resetPasswordForEmail error:', error.message);
    return {
      error: 'No se pudo procesar la solicitud. Verifica el correo e intenta de nuevo.',
      sent: false,
    };
  }

  return { error: null, sent: true };
}

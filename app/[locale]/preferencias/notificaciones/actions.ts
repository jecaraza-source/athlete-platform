'use server';

import { revalidatePath }    from 'next/cache';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import { getCurrentUser }    from '@/lib/rbac/server';
import { writeNotificationAudit } from '@/lib/notifications/email-service';

export async function updateNotificationPreferences(
  formData: FormData
): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!user?.profile) return { error: 'Debes iniciar sesión.' };

  const profileId    = formData.get('profile_id') as string;
  const emailEnabled = formData.get('email_enabled') === 'true';
  const pushEnabled  = formData.get('push_enabled')  === 'true';

  // Only allow users to update their own preferences
  if (profileId !== user.profile.id) {
    return { error: 'No tienes permiso para cambiar estas preferencias.' };
  }

  // Fetch mandatory flags (cannot be overridden)
  const { data: existingPrefs } = await supabaseAdmin
    .from('notification_preferences')
    .select('channel, is_mandatory')
    .eq('profile_id', profileId);

  const mandatoryMap = new Map(
    (existingPrefs ?? []).map((p) => [p.channel, p.is_mandatory])
  );

  const rows = [
    { channel: 'email', enabled: emailEnabled },
    { channel: 'push',  enabled: pushEnabled  },
  ].map(({ channel, enabled }) => ({
    profile_id:   profileId,
    channel,
    enabled:      mandatoryMap.get(channel) ? true : enabled,
    is_mandatory: mandatoryMap.get(channel) ?? false,
    updated_at:   new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from('notification_preferences')
    .upsert(rows, { onConflict: 'profile_id,channel' });

  if (error) return { error: error.message };

  await writeNotificationAudit({
    action:      'preference_updated',
    performedBy: user.profile.id,
    entityType:  'notification_preferences',
    entityId:    user.profile.id,
    metadata:    { email_enabled: emailEnabled, push_enabled: pushEnabled },
  });

  revalidatePath('/preferencias/notificaciones');
  return { error: null };
}

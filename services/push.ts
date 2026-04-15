import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { PushPlatform } from '@/types';

/**
 * Upsert a device token for the current user.
 * Called after obtaining an Expo push token.
 */
export async function registerDeviceToken(payload: {
  profileId: string;
  deviceToken: string;
  deviceName?: string;
}): Promise<void> {
  const platform: PushPlatform =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  const { error } = await supabase.from('push_device_tokens').upsert(
    {
      profile_id: payload.profileId,
      device_token: payload.deviceToken,
      platform,
      device_name: payload.deviceName ?? null,
      is_active: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,device_token' }
  );

  if (error) {
    console.warn('[push] Failed to register device token:', error.message);
  }
}

/** Deactivate all tokens for a profile (on sign-out). */
export async function deactivateDeviceTokens(profileId: string): Promise<void> {
  await supabase
    .from('push_device_tokens')
    .update({ is_active: false })
    .eq('profile_id', profileId);
}

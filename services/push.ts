import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { PushPlatform } from '@/types';

/**
 * Upsert a device token for the current user.
 * Stores both the Expo push token (device_token) and the OneSignal
 * player ID (onesignal_player_id) so the web server can route to the
 * correct provider: Expo Push API for ExponentPushToken values,
 * OneSignal REST API for UUID-format player IDs.
 */
export async function registerDeviceToken(payload: {
  profileId: string;
  deviceToken: string;
  deviceName?: string;
  onesignalPlayerId?: string | null;
}): Promise<void> {
  const platform: PushPlatform =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  const row: Record<string, unknown> = {
    profile_id:  payload.profileId,
    device_token: payload.deviceToken,
    platform,
    device_name:  payload.deviceName ?? null,
    is_active:    true,
    last_seen_at: new Date().toISOString(),
  };

  // Store the OneSignal player ID when available so the cron job can route
  // to OneSignal instead of the Expo Push gateway.
  if (payload.onesignalPlayerId) {
    row['onesignal_player_id'] = payload.onesignalPlayerId;
  }

  const { error } = await supabase
    .from('push_device_tokens')
    .upsert(row, { onConflict: 'profile_id,device_token' });

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

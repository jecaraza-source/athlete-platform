import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { registerDeviceToken } from '@/services/push';
import { useAuthStore } from '@/store';
import type * as NotificationsType from 'expo-notifications';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// OneSignal App ID — must match ONESIGNAL_APP_ID in the web server env.
const ONESIGNAL_APP_ID = 'fdfdbad9-0741-44dc-a562-a71fd642c2c7';

// Expo Go doesn't support native push modules (SDK 53+).
const IS_EXPO_GO = Constants.appOwnership === 'expo';

// Staff role codes — kept in sync with SYSTEM_ROLES in types/index.ts.
const STAFF_ROLES = ['super_admin', 'admin', 'coach', 'staff', 'program_director'] as const;

// ---------------------------------------------------------------------------
// Lazy loader — prevents native module evaluation in Expo Go
// ---------------------------------------------------------------------------

type OSModule = typeof import('react-native-onesignal');

function requireOneSignal(): OSModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-onesignal') as OSModule;
  } catch {
    return null;
  }
}

// Guard: initialize() must only be called once per JS runtime session.
let oneSignalReady = false;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePushNotifications() {
  const router  = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const roles   = useAuthStore((s) => s.roles);

  const notifRef    = useRef<NotificationsType.EventSubscription | null>(null);
  const responseRef = useRef<NotificationsType.EventSubscription | null>(null);

  // ── Effect 1: expo-notifications foreground handler (mount once) ─────────
  useEffect(() => {
    if (IS_EXPO_GO) return;

    let N: typeof NotificationsType;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      N = require('expo-notifications') as typeof NotificationsType;
    } catch {
      return;
    }

    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Foreground: received but not interacted with.
    notifRef.current = N.addNotificationReceivedListener(() => {});

    // Background / quit: tapped by the user → deep-link into the app.
    responseRef.current = N.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      // Newsletter approval notification: navigate to newsletter screen
      if (data?.type === 'newsletter_approval') {
        router.push('/app/newsletter' as never);
        return;
      }
      const link = data?.deep_link as string | undefined;
      if (link) router.push(link.replace(/^aodeporte:\/\//, '/') as never);
    });

    return () => {
      notifRef.current?.remove();
      responseRef.current?.remove();
    };
  // router is stable in expo-router — safe to omit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Effect 2: OneSignal SDK init (once) + identity per profile ───────────
  //
  // Runs whenever the logged-in user changes:
  //   profile === null  → user signed out → logout from OneSignal
  //   profile !== null  → user signed in  → login + tags + token registration
  useEffect(() => {
    if (IS_EXPO_GO) return;

    const sdk = requireOneSignal();
    if (!sdk) return;
    const { OneSignal } = sdk;

    // Initialize the SDK exactly once per app session.
    if (!oneSignalReady) {
      OneSignal.initialize(ONESIGNAL_APP_ID);
      oneSignalReady = true;
      console.log('[push] OneSignal initialized');
    }

    if (!profile) {
      // Signed out — disassociate this device from the previous user so they
      // no longer receive targeted notifications after logging out.
      try { OneSignal.logout(); } catch { /* best-effort */ }
      return;
    }

    // Tie the OneSignal subscription to the app's internal user ID.
    // The backend can now target a specific user via external_id without
    // needing to look up the subscription/player ID.
    OneSignal.login(profile.id);

    // Segmentation tags — enables "send to all athletes" or "send to all staff"
    // from the OneSignal dashboard or REST API.
    const isStaff = roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r.code));
    OneSignal.User.addTags({
      role:       isStaff ? 'staff' : 'athlete',
      profile_id: profile.id,
    });

    // Permission prompt (iOS system dialog / Android 13+ dialog).
    OneSignal.Notifications.requestPermission(true).catch(() => {});

    // OneSignal click handler — notification tapped while app is foregrounded
    // or from the notification tray. Mirrors the expo-notifications deep-link
    // handler above so both delivery channels are covered.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleClick = (event: any) => {
      const data = event?.notification?.additionalData as Record<string, unknown> | undefined;
      // Newsletter approval: navigate to newsletter admin screen
      if (data?.type === 'newsletter_approval') {
        router.push('/app/newsletter' as never);
        return;
      }
      const link = data?.deep_link as string | undefined;
      if (link) router.push(link.replace(/^aodeporte:\/\//, '/') as never);
    };
    OneSignal.Notifications.addEventListener('click', handleClick);

    // Register subscription ID + Expo fallback token in Supabase.
    registerAllTokens(OneSignal, profile.id);

    return () => {
      OneSignal.Notifications.removeEventListener('click', handleClick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);
}

// ---------------------------------------------------------------------------
// Token registration
// ---------------------------------------------------------------------------

/**
 * Save both delivery channels to `push_device_tokens`:
 *   1. OneSignal subscription ID  — preferred; used by the web server's cron.
 *   2. Expo push token            — fallback for direct Expo Push API delivery.
 */
async function registerAllTokens(
  OneSignal: OSModule['OneSignal'],
  profileId: string,
): Promise<void> {
  // 1. OneSignal subscription ID
  try {
    const save = async (id: string | null | undefined) => {
      if (!id) return;
      await registerDeviceToken({ profileId, deviceToken: 'onesignal:' + id, onesignalPlayerId: id });
      console.log('[push] OneSignal subscription ID saved:', id.slice(0, 8) + '…');
    };

    const existingId = await OneSignal.User.pushSubscription.getIdAsync();
    if (existingId) {
      await save(existingId);
    } else {
      // First launch — SDK hasn't finished registering with OneSignal servers yet.
      // PushSubscriptionChangedState wraps the new state in `.current`.
      OneSignal.User.pushSubscription.addEventListener('change', (sub) => {
        save(sub.current?.id).catch(console.warn);
      });
    }
  } catch (e) {
    console.warn('[push] OneSignal subscription ID skipped:', (e as Error).message);
  }

  // 2. Expo push token (fallback)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const N = require('expo-notifications') as typeof import('expo-notifications');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const D = require('expo-device') as typeof import('expo-device');

    if (!D.isDevice) return;

    const { status: existing } = await N.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await N.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'default',
        importance: N.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0a7ea4',
      });
    }

    const projectId = (
      Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
    )?.eas?.projectId;

    const token = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await registerDeviceToken({
      profileId,
      deviceToken: token.data,
      deviceName:  D.deviceName ?? undefined,
    });
    console.log('[push] Expo push token saved');
  } catch (e) {
    console.warn('[push] Expo push token skipped:', (e as Error).message);
  }
}

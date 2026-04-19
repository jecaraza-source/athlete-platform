import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { registerDeviceToken } from '@/services/push';
import { useAuthStore } from '@/store';
// Types only — no runtime import of expo-notifications at the top level.
import type * as NotificationsType from 'expo-notifications';
import type * as DeviceType from 'expo-device';

// OneSignal App ID — must match ONESIGNAL_APP_ID in the web server env.
const ONESIGNAL_APP_ID = 'fdfdbad9-0741-44dc-a562-a71fd642c2c7';

// Expo Go doesn’t support native push modules (SDK 53+).
const IS_EXPO_GO = Constants.appOwnership === 'expo';

export function usePushNotifications() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const notificationListener = useRef<NotificationsType.EventSubscription | null>(null);
  const responseListener = useRef<NotificationsType.EventSubscription | null>(null);

  useEffect(() => {
    // Skip in Expo Go — native push modules aren’t available there.
    if (IS_EXPO_GO || !profile) return;

    // Lazy-load so the modules are never evaluated in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof NotificationsType;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device') as typeof DeviceType;

    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch {
      return;
    }

    registerForPushNotifications(Notifications, Device, profile.id);
    initOneSignal(profile.id);

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const deepLink = data?.deep_link as string | undefined;
      if (deepLink) {
        const path = deepLink.replace(/^aodeporte:\/\//, '/');
        router.push(path as never);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);
}

// ---------------------------------------------------------------------------
// OneSignal initialisation
// ---------------------------------------------------------------------------

/**
 * Initialise the OneSignal SDK and, once a player ID is available,
 * update push_device_tokens.onesignal_player_id for this profile.
 * This runs alongside the Expo token registration so both tokens are
 * stored — the web server’s cron prefers the OneSignal UUID for delivery.
 */
async function initOneSignal(profileId: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OneSignal } = require('react-native-onesignal') as {
      OneSignal: {
        initialize: (appId: string) => void;
        Notifications: {
          requestPermission: (fallback: boolean) => Promise<boolean>;
        };
        User: {
          pushSubscription: {
            getIdAsync: () => Promise<string | null | undefined>;
            id: string | null | undefined;
            addEventListener: (event: string, cb: (sub: { id?: string | null }) => void) => void;
          };
        };
      };
    };

    OneSignal.initialize(ONESIGNAL_APP_ID);
    await OneSignal.Notifications.requestPermission(true);

    // Try to get the player ID immediately; if not yet available, listen for
    // the subscription change event which fires once the SDK has registered.
    const savePlayerId = async (playerId: string | null | undefined) => {
      if (!playerId) return;
      await registerDeviceToken({
        profileId,
        deviceToken:       playerId,  // also usable as device_token fallback
        onesignalPlayerId: playerId,
      });
      console.log('[push] OneSignal player ID registered:', playerId.slice(0, 8) + '...');
    };

    const existingId = await OneSignal.User.pushSubscription.getIdAsync();
    if (existingId) {
      await savePlayerId(existingId);
    } else {
      // First launch: wait for the SDK to finish registering with OneSignal.
      OneSignal.User.pushSubscription.addEventListener('change', (sub) => {
        savePlayerId(sub.id).catch(console.warn);
      });
    }
  } catch (e) {
    // OneSignal is unavailable (Expo Go, simulator without push entitlements).
    console.warn('[push] OneSignal init skipped:', (e as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Expo push token registration (kept as fallback)
// ---------------------------------------------------------------------------

async function registerForPushNotifications(
  Notifications: typeof NotificationsType,
  Device: typeof DeviceType,
  profileId: string,
) {
  if (!Device.isDevice) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0a7ea4',
    });
  }

  try {
    const projectId = (
      Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
    )?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    // Register the Expo token as a fallback; onesignal_player_id is set separately
    // by initOneSignal() once the OneSignal SDK finishes its registration.
    await registerDeviceToken({
      profileId,
      deviceToken: token.data,
      deviceName:  Device.deviceName ?? undefined,
    });
  } catch (e) {
    console.warn('[push] Could not get Expo push token:', e);
  }
}

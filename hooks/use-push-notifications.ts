import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { registerDeviceToken } from '@/services/push';
import { useAuthStore } from '@/store';
// Types only — no runtime import of expo-notifications at the top level.
// The module is loaded lazily inside the effect so Expo Go never evaluates it.
import type * as NotificationsType from 'expo-notifications';
import type * as DeviceType from 'expo-device';

// expo-notifications removed Android push support from Expo Go in SDK 53.
// Checking at module-load time lets us skip the require() entirely.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

export function usePushNotifications() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const notificationListener = useRef<NotificationsType.EventSubscription | null>(null);
  const responseListener = useRef<NotificationsType.EventSubscription | null>(null);

  useEffect(() => {
    // In Expo Go the module would crash on load — skip entirely.
    if (IS_EXPO_GO || !profile) return;

    // Lazy-load so the module is never evaluated in Expo Go.
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
    const token = await Notifications.getExpoPushTokenAsync();
    await registerDeviceToken({
      profileId,
      deviceToken: token.data,
      deviceName: Device.deviceName ?? undefined,
    });
  } catch (e) {
    console.warn('[push] Could not get push token:', e);
  }
}

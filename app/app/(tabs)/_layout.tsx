import { Image, TouchableOpacity, useColorScheme } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY } from '@/constants/theme';
import { useAuthStore } from '@/store';
import { countPendingNotifications } from '@/services/notifications';
import { useRealtimeNotificationBadge } from '@/hooks/use-realtime';

function LogoHeader() {
  return (
    <Image
      source={require('@/assets/images/icon.png')}
      style={{ width: 30, height: 30, marginLeft: 12 }}
      resizeMode="contain"
    />
  );
}

export default function TabsLayout() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  // Subscribe to the raw data — NOT the helper functions — so this
  // component re-renders when loadUserData() populates permissions/roles.
  const permissions = useAuthStore((s) => s.permissions);
  const profile     = useAuthStore((s) => s.profile);
  const showAthletes    = permissions.has('view_athletes');
  // Training tab: visible to anyone with view_training OR manage_training
  const showTraining    = permissions.has('view_training') || permissions.has('manage_training');
  // Ticket create button: visible only to users who can open tickets
  const canCreateTicket = permissions.has('create_tickets');

  // Notification badge — counts unread push_jobs (read_at IS NULL).
  // Refreshed on mount, on profile change, and on every incoming Realtime event.
  const [notifBadge, setNotifBadge] = useState<number | undefined>(undefined);

  const refreshBadge = useCallback(() => {
    if (!profile?.id) { setNotifBadge(undefined); return; }
    countPendingNotifications(profile.id)
      .then((n) => setNotifBadge(n > 0 ? n : undefined))
      .catch(() => setNotifBadge(undefined));
  }, [profile?.id]);

  // Initial load
  useEffect(() => { refreshBadge(); }, [refreshBadge]);

  // Live update: fires when a new push_job is delivered to this profile
  useRealtimeNotificationBadge(refreshBadge);

  return (
    <Tabs
      screenOptions={{
        // Show header with logo on all tabs
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerLeft: () => <LogoHeader />,
        headerTitleStyle: { color: colors.text, fontSize: 17, fontWeight: '600' },
        headerTintColor: PRIMARY,
        // Tab bar
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: scheme === 'dark' ? '#1e2022' : '#e2e8f0',
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          headerTitle: '',        // Hide text — logo icon (headerLeft) is enough
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Athletes tab — visible only with view_athletes permission */}
      <Tabs.Screen
        name="athletes"
        options={{
          title: 'Atletas',
          href: showAthletes ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Tickets',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ticket-outline" size={size} color={color} />
          ),
          // Add button: only for roles with create_tickets permission
          headerRight: canCreateTicket ? () => (
            <TouchableOpacity
              onPress={() => router.push('/app/tickets/create' as never)}
              style={{ marginRight: 14 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add-circle" size={26} color={PRIMARY} />
            </TouchableOpacity>
          ) : undefined,
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alertas',
          // Show a small red dot (not a count) when there are unread notifications
          tabBarBadge: notifBadge !== undefined ? '' : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#dc2626',
            minWidth: 10,
            height: 10,
            borderRadius: 5,
            borderWidth: 0,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Entrenamiento tab — athletes only */}
      <Tabs.Screen
        name="training"
        options={{
          title: 'Entrena',
          href: showTraining ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendario',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Plan screen — hidden from tab bar, accessible from Home dashboard */}
      <Tabs.Screen name="plan" options={{ href: null }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
    </Tabs>
  );
}

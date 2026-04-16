import { useEffect, useState, useCallback } from 'react';
import {
  FlatList, StyleSheet, useColorScheme, View, Text,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, PRIMARY } from '@/constants/theme';
import { NotificationItem } from '@/components/notifications/notification-item';
import { Loading } from '@/components/ui/loading';
import { EmptyView } from '@/components/ui/empty-view';
import {
  listPushNotifications,
  markAllNotificationsAsRead,
} from '@/services/notifications';
import { useAuthStore } from '@/store';
import type { PushJob } from '@/types';

export default function NotificationsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { profile } = useAuthStore();

  const [notifications, setNotifications] = useState<PushJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    if (!profile) { setLoading(false); return; }
    try {
      const data = await listPushNotifications(profile.id);
      setNotifications(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  async function handleMarkAllRead() {
    if (!profile || marking) return;
    setMarking(true);
    await markAllNotificationsAsRead(profile.id);
    await load();
    setMarking(false);
  }

  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header bar with "Mark all read" button */}
      {hasUnread && (
        <View style={[styles.header, { borderBottomColor: scheme === 'dark' ? '#1e2022' : '#e2e8f0' }]}>
          <Text style={[styles.headerText, { color: colors.icon }]}>
            {notifications.filter((n) => !n.read_at).length} sin leer
          </Text>
          <TouchableOpacity
            onPress={handleMarkAllRead}
            disabled={marking}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.markAllText, { color: marking ? colors.icon : PRIMARY }]}>
              {marking ? 'Marcando…' : 'Marcar todo como leído'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <Loading fullScreen />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => <NotificationItem notification={item} />}
          ListEmptyComponent={
            <EmptyView
              title="Sin notificaciones"
              subtitle="Aquí aparecerán las alertas y notificaciones del sistema"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  headerText: { fontSize: 13 },
  markAllText: { fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
});

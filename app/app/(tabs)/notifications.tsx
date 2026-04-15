import { useEffect, useState } from 'react';
import {
  FlatList, StyleSheet, useColorScheme,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { NotificationItem } from '@/components/notifications/notification-item';
import { Loading } from '@/components/ui/loading';
import { EmptyView } from '@/components/ui/empty-view';
import { listPushNotifications } from '@/services/notifications';
import { useAuthStore } from '@/store';
import type { PushJob } from '@/types';

export default function NotificationsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { profile } = useAuthStore();

  const [notifications, setNotifications] = useState<PushJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!profile) { setLoading(false); return; }
    try {
      const data = await listPushNotifications(profile.id);
      setNotifications(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [profile?.id]);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
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
  list: { paddingHorizontal: 16, paddingBottom: 30 },
});

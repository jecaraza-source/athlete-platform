import { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, useColorScheme,
  RefreshControl, TouchableOpacity, Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, PRIMARY } from '@/constants/theme';
import { TicketCard } from '@/components/tickets/ticket-card';
import { Loading } from '@/components/ui/loading';
import { EmptyView } from '@/components/ui/empty-view';
import { listTickets } from '@/services/tickets';
import type { TicketWithProfiles, TicketStatus } from '@/types';

const STATUS_FILTERS: { label: string; value: TicketStatus | undefined }[] = [
  { label: 'Todos', value: undefined },
  { label: 'Abierto', value: 'open' },
  { label: 'En progreso', value: 'in_progress' },
  { label: 'Resuelto', value: 'resolved' },
];

export default function TicketsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();

  const [tickets, setTickets] = useState<TicketWithProfiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const data = await listTickets({ status: statusFilter });
      setTickets(data);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Status filters */}
      <View style={styles.filtersRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.label}
            onPress={() => setStatusFilter(f.value)}
            style={[
              styles.filter,
              statusFilter === f.value && { backgroundColor: PRIMARY },
            ]}
          >
            <Text style={[styles.filterText, { color: statusFilter === f.value ? '#fff' : colors.icon }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <Loading fullScreen />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <TicketCard
              ticket={item}
              onPress={() => router.push(`/app/tickets/${item.id}` as never)}
            />
          )}
          ListEmptyComponent={
            <EmptyView title="Sin tickets" subtitle="Crea un nuevo ticket usando el botón +" />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  filtersRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  filter: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#e2e8f0' },
  filterText: { fontSize: 12, fontWeight: '500' },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
});

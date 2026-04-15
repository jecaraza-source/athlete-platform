import { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, TextInput, StyleSheet, useColorScheme,
  Text, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, PRIMARY } from '@/constants/theme';
import { AthleteCard } from '@/components/athletes/athlete-card';
import { Loading } from '@/components/ui/loading';
import { EmptyView } from '@/components/ui/empty-view';
import { listAthletes } from '@/services/athletes';
import type { Athlete, AthleteStatus } from '@/types';
import { Ionicons } from '@expo/vector-icons';

// Labels are in Spanish; values match the DB schema (English).
const STATUS_FILTERS: { label: string; value: AthleteStatus | undefined }[] = [
  { label: 'Todos',      value: undefined    },
  { label: 'Activos',   value: 'active'     },
  { label: 'Lesionados', value: 'injured'   },
  { label: 'Inactivos', value: 'inactive'   },
  { label: 'Suspendidos', value: 'suspended' },
];

export default function AthletesScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AthleteStatus | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const data = await listAthletes({ search: search || undefined, status: statusFilter });
      setAthletes(data);
    } catch {
      setAthletes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View style={[styles.searchRow, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#f1f5f9' }]}>
        <Ionicons name="search-outline" size={18} color={colors.icon} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Buscar atleta..."
          placeholderTextColor={colors.icon}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.icon} />
          </TouchableOpacity>
        )}
      </View>

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
            <Text
              style={[
                styles.filterText,
                { color: statusFilter === f.value ? '#fff' : colors.icon },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <Loading fullScreen />
      ) : (
        <FlatList
          data={athletes}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <AthleteCard
              athlete={item}
              onPress={() => router.push(`/app/athletes/${item.id}` as never)}
            />
          )}
          ListEmptyComponent={
            <EmptyView
              title="No se encontraron atletas"
              subtitle="Intenta cambiar los filtros o la búsqueda"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    borderRadius: 10, paddingHorizontal: 12, height: 42,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  filtersRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 6 },
  filter: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  filterText: { fontSize: 12, fontWeight: '500' },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
});

import { useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, useColorScheme, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store';
import { useNewsletterStore } from '@/store/newsletterStore';
import { Colors, PRIMARY } from '@/constants/theme';

const AUDIENCIA_LABELS: Record<string, string> = {
  atleta: 'Atletas',
  coach:  'Coaches',
  all:    'Todos',
};

function fmt(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function NewsletterHistorialScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();

  const { isAthlete } = useAuthStore();
  const {
    history,
    isLoading,
    hasMore,
    currentPage,
    historyLoaded,
    fetchHistory,
  } = useNewsletterStore();

  const audiencia = isAthlete() ? 'atleta' : 'coach';

  useEffect(() => {
    if (!historyLoaded) fetchHistory(audiencia, 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadMore() {
    if (!isLoading && hasMore) fetchHistory(audiencia, currentPage + 1);
  }

  const bg = scheme === 'dark' ? '#151718' : '#fff';

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {history.length === 0 && !isLoading ? (
        <View style={styles.empty}>
          <Ionicons name="mail-outline" size={48} color={colors.icon} />
          <Text style={[styles.emptyText, { color: colors.icon }]}>
            No hay newsletters enviados todavía.
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isLoading ? (
              <ActivityIndicator color={PRIMARY} style={styles.loader} />
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff', borderColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}
              onPress={() => router.push(`/app/newsletter/${item.id}` as never)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={styles.audienciaBadge}>
                  <Text style={styles.audienciaText}>
                    {AUDIENCIA_LABELS[item.audiencia] ?? item.audiencia}
                  </Text>
                </View>
                <Text style={[styles.dateText, { color: colors.icon }]}>
                  {fmt(item.sent_at)}
                </Text>
              </View>

              <Text style={[styles.subject, { color: colors.text }]} numberOfLines={2}>
                {item.asunto}
              </Text>

              {item.intro && (
                <Text style={[styles.intro, { color: colors.icon }]} numberOfLines={2}>
                  {item.intro}
                </Text>
              )}

              <View style={styles.cardFooter}>
                <Ionicons name="chevron-forward" size={16} color={PRIMARY} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { fontSize: 15, textAlign: 'center' },

  list: { padding: 16, gap: 12, paddingBottom: 40 },
  loader: { marginVertical: 16 },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  audienciaBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  audienciaText: { fontSize: 11, fontWeight: '700', color: '#15803d' },

  dateText: { fontSize: 11 },

  subject: { fontSize: 15, fontWeight: '700', lineHeight: 20, marginBottom: 5 },
  intro:   { fontSize: 13, lineHeight: 18, marginBottom: 8 },

  cardFooter: { alignItems: 'flex-end' },
});

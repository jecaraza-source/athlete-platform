import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { Colors, PRIMARY } from '@/constants/theme';
import { EmptyView } from '@/components/ui/empty-view';
import { Loading } from '@/components/ui/loading';
import { useAuthStore } from '@/store';
import { listPsychologicalHistory, type PsychologicalHistoryItem } from '@/services/psych';

export default function PsychologicalHistoryScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const isAthlete = useAuthStore((state) => state.isAthlete);
  const [items, setItems] = useState<PsychologicalHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setItems(await listPsychologicalHistory());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar el histórico.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (!isAthlete()) return <Redirect href="/app/(tabs)" />;
  if (loading) return <Loading fullScreen />;
  if (error || items.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <EmptyView
          title="Aún no hay resultados publicados"
          subtitle={error ?? 'Cuando el equipo de salud mental publique una evaluación, aparecerá aquí.'}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.eyebrow}>RESULTADOS PUBLICADOS</Text>
        <Text style={[styles.title, { color: colors.text }]}>Mi historial psicológico</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          Sólo se muestran evaluaciones publicadas para ti por el equipo de salud mental.
        </Text>
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={[styles.card, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff' }]}>
              <Text style={[styles.instrument, { color: colors.text }]}>{item.instrumentName}</Text>
              <Text style={[styles.date, { color: colors.icon }]}>
                {item.completedAt
                  ? new Date(item.completedAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
                  : 'Fecha de evaluación no disponible'}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20, paddingBottom: 36 },
  eyebrow: { color: PRIMARY, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  list: { gap: 10, marginTop: 20 },
  card: { borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  instrument: { fontSize: 16, fontWeight: '700' },
  date: { fontSize: 13, marginTop: 6 },
});

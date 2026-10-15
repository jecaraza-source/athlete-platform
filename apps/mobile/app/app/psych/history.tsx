import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { Colors, PRIMARY } from '@/constants/theme';
import { Loading } from '@/components/ui/loading';
import { useAuthStore } from '@/store';
import { getPsychOverview, type PsychOverview } from '@/services/psych';
import { formatPsychDate, instrumentAbout, subscaleLabel } from '@/lib/psych-labels';
import { PendingTestsCard } from '@/components/psych/PendingTestsCard';

const GREEN = { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' };

/**
 * "Mis evaluaciones": pending tests, published results (summary written for
 * the athlete plus per-area interpretations) and the record of answered tests.
 * Never shows answers, scores, bands or the confidential clinical note.
 */
export default function PsychologicalHistoryScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const isAthlete = useAuthStore((state) => state.isAthlete);
  const [overview, setOverview] = useState<PsychOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setOverview(await getPsychOverview());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar tus evaluaciones.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (!isAthlete()) return <Redirect href="/app/(tabs)" />;
  if (loading) return <Loading fullScreen />;

  const cardBg = scheme === 'dark' ? '#1e2022' : '#fff';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.eyebrow}>EXÁMENES</Text>
        <Text style={[styles.title, { color: colors.text }]}>Mis evaluaciones</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        {overview && (
          <>
            <PendingTestsCard pending={overview.pending} completionWindowDays={overview.completionWindowDays} />

            <View style={[styles.section, { backgroundColor: scheme === 'dark' ? '#14231a' : GREEN.bg, borderColor: GREEN.border }]}>
              <Text style={[styles.sectionEyebrow, { color: GREEN.text }]}>MIS RESULTADOS</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Resultados publicados</Text>
              <Text style={[styles.sectionHint, { color: colors.icon }]}>
                Resultados que el equipo de salud mental revisó y compartió contigo.
              </Text>
              {overview.results.length === 0 ? (
                <Text style={[styles.empty, { color: colors.icon, backgroundColor: cardBg }]}>
                  Aún no tienes resultados publicados. Cuando el equipo revise y publique uno de tus exámenes, aparecerá aquí.
                </Text>
              ) : overview.results.map((result) => {
                const about = instrumentAbout(result.instrumentCode);
                return (
                  <View key={result.id} style={[styles.card, { backgroundColor: cardBg, borderColor: GREEN.border }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{result.instrumentName}</Text>
                    <Text style={[styles.meta, { color: colors.icon }]}>
                      {[
                        result.completedAt && `Contestado: ${formatPsychDate(result.completedAt)}`,
                        result.publishedAt && `Publicado: ${formatPsychDate(result.publishedAt)}`,
                      ].filter(Boolean).join(' · ')}
                    </Text>
                    {about && (
                      <Text style={[styles.about, { color: colors.icon }]}>
                        <Text style={styles.aboutLabel}>Sobre esta prueba: </Text>{about}
                      </Text>
                    )}
                    <Text style={[styles.label, { color: GREEN.text }]}>RESULTADO Y RECOMENDACIONES</Text>
                    <Text style={[styles.summary, { color: colors.text }]}>{result.summary}</Text>
                    {result.interpretations.length > 0 && (
                      <>
                        <Text style={[styles.label, { color: GREEN.text }]}>DETALLE POR ÁREA</Text>
                        {result.interpretations.map((interpretation) => (
                          <View key={interpretation.subscaleCode} style={[styles.area, { backgroundColor: scheme === 'dark' ? '#26292c' : '#f8fafc' }]}>
                            <Text style={[styles.areaName, { color: colors.text }]}>{subscaleLabel(interpretation.subscaleCode)}</Text>
                            <Text style={[styles.areaText, { color: colors.text }]}>{interpretation.text}</Text>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                );
              })}
            </View>

            <View style={[styles.section, { backgroundColor: cardBg, borderColor: scheme === 'dark' ? '#303236' : '#e2e8f0' }]}>
              <Text style={[styles.sectionEyebrow, { color: PRIMARY }]}>MI REGISTRO</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Exámenes contestados</Text>
              <Text style={[styles.sectionHint, { color: colors.icon }]}>
                Lleva el control de los exámenes que ya respondiste. Los resultados los comparte el equipo de salud mental una vez revisados.
              </Text>
              {overview.answered.length === 0 ? (
                <Text style={[styles.emptyPlain, { color: colors.icon }]}>Aún no has contestado ningún examen.</Text>
              ) : overview.answered.map((assessment) => (
                <View key={assessment.id} style={[styles.row, { borderColor: scheme === 'dark' ? '#303236' : '#e2e8f0' }]}>
                  <Text style={[styles.rowName, { color: colors.text }]}>{assessment.instrumentName}</Text>
                  <Text style={[styles.meta, { color: colors.icon }]}>
                    {assessment.completedAt ? `Contestado el ${formatPsychDate(assessment.completedAt)}` : 'Sin fecha'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20, paddingBottom: 36 },
  eyebrow: { color: PRIMARY, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '800' },
  error: { color: '#b91c1c', fontSize: 14, marginTop: 12 },
  section: { borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 16 },
  sectionEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  sectionHint: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  empty: { fontSize: 13, lineHeight: 18, marginTop: 12, padding: 14, borderRadius: 10, textAlign: 'center' },
  emptyPlain: { fontSize: 13, marginTop: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4 },
  about: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  aboutLabel: { fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 14 },
  summary: { fontSize: 14, lineHeight: 21, marginTop: 4 },
  area: { borderRadius: 10, padding: 10, marginTop: 8 },
  areaName: { fontSize: 12, fontWeight: '700' },
  areaText: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  row: { borderTopWidth: 1, paddingVertical: 10, marginTop: 8 },
  rowName: { fontSize: 15, fontWeight: '600' },
});

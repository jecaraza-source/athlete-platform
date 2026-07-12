import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY } from '@/constants/theme';
import { Loading } from '@/components/ui/loading';
import { EmptyView } from '@/components/ui/empty-view';
import { useAuthStore } from '@/store';
import { listTrainingSessions, type TrainingSession } from '@/services/training';
import { getDiagnostic, getDiagnosticSections } from '@/services/diagnostic';
import type { AthleteInitialDiagnostic, AthleteSection } from '@/types';
import { DIAGNOSTIC_STATUS_LABELS, SECTION_LABELS } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sessionsThisMonth(sessions: TrainingSession[]): number {
  const now = new Date();
  return sessions.filter((s) => {
    const d = new Date(s.session_date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

function sessionsLast30Days(sessions: TrainingSession[]): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return sessions.filter((s) => new Date(s.session_date) >= cutoff).length;
}

const SECTION_COLORS: Record<string, { bg: string; text: string }> = {
  pendiente:         { bg: '#f1f5f9', text: '#64748b' },
  en_proceso:        { bg: '#fef9c3', text: '#854d0e' },
  completo:          { bg: '#dcfce7', text: '#15803d' },
  requiere_atencion: { bg: '#fee2e2', text: '#b91c1c' },
};

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ value, label, color }: { value: string | number; label: string; color?: string }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  return (
    <View style={[styles.statCard, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff' }]}>
      <Text style={[styles.statValue, { color: color ?? PRIMARY }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.icon }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Session row
// ---------------------------------------------------------------------------

function SessionRow({ session }: { session: TrainingSession }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const date = new Date(session.session_date).toLocaleDateString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short',
  });
  return (
    <View style={[styles.sessionRow, { borderBottomColor: scheme === 'dark' ? '#1e2022' : '#f1f5f9' }]}>
      <View style={[styles.sessionDot, { backgroundColor: PRIMARY + '22' }]}>
        <Ionicons name="barbell-outline" size={14} color={PRIMARY} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
          {session.title}
        </Text>
        <Text style={[styles.sessionDate, { color: colors.icon }]}>{date}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ProgressScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { isAthlete } = useAuthStore();
  const athleteId = useAuthStore((s) => s.athleteId);

  const [sessions, setSessions]     = useState<TrainingSession[]>([]);
  const [diagnostic, setDiagnostic] = useState<AthleteInitialDiagnostic | null>(null);
  const [sections, setSections]     = useState<AthleteSection[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(refresh = false) {
    if (!athleteId) { setLoading(false); return; }
    try {
      const [sessionData, diagData] = await Promise.all([
        listTrainingSessions(athleteId),
        getDiagnostic(athleteId),
      ]);

      setSessions(sessionData);
      setDiagnostic(diagData);

      if (diagData) {
        const secs = await getDiagnosticSections(diagData.id);
        setSections(secs);
      }
    } catch (e) {
      console.warn('[progress] load error', e);
    } finally {
      setLoading(false);
      if (refresh) setRefreshing(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [athleteId]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  if (loading) return <Loading fullScreen />;

  if (!isAthlete()) {
    return (
      <EmptyView
        title="Progreso"
        subtitle="Esta sección muestra el progreso individual del atleta."
      />
    );
  }

  const thisMonth = sessionsThisMonth(sessions);
  const last30    = sessionsLast30Days(sessions);
  const recentSessions = sessions.slice(0, 10);

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Stats row */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Entrenamiento</Text>
      <View style={styles.statsRow}>
        <StatCard value={sessions.length} label="Total sesiones" />
        <StatCard value={thisMonth}       label="Este mes" />
        <StatCard
          value={last30}
          label="Últimos 30 días"
          color={last30 >= 8 ? '#15803d' : last30 >= 4 ? '#b45309' : '#dc2626'}
        />
      </View>

      {/* Diagnostic progress */}
      {diagnostic && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>Diagnóstico inicial</Text>
          <View style={[styles.diagCard, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff' }]}>
            {/* Progress bar */}
            <View style={styles.diagBarRow}>
              <Text style={[styles.diagPct, { color: PRIMARY }]}>{diagnostic.completion_pct}%</Text>
              <Text style={[styles.diagLabel, { color: colors.icon }]}>completado</Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${diagnostic.completion_pct}%` as never,
                    backgroundColor:
                      diagnostic.completion_pct === 100 ? '#22c55e'
                      : diagnostic.completion_pct > 50  ? PRIMARY
                      : '#f59e0b',
                  },
                ]}
              />
            </View>

            {/* Sections grid */}
            {sections.length > 0 && (
              <View style={styles.sectionsGrid}>
                {sections.map((s) => {
                  const sc = SECTION_COLORS[s.status] ?? SECTION_COLORS.pendiente;
                  return (
                    <View
                      key={s.id}
                      style={[styles.sectionTag, { backgroundColor: sc.bg }]}
                    >
                      <Text style={[styles.sectionName, { color: sc.text }]}>
                        {SECTION_LABELS[s.section]}
                      </Text>
                      <Text style={[styles.sectionStatus, { color: sc.text }]}>
                        {DIAGNOSTIC_STATUS_LABELS[s.status]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}

      {/* Recent sessions */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>Sesiones recientes</Text>
      {recentSessions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={32} color={colors.icon} />
          <Text style={[styles.emptyText, { color: colors.icon }]}>
            Sin sesiones registradas aún.
          </Text>
        </View>
      ) : (
        <View style={[styles.sessionsList, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff' }]}>
          {recentSessions.map((s) => <SessionRow key={s.id} session={s} />)}
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex:      { flex: 1 },
  container: { padding: 16, paddingBottom: 40 },

  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Stats
  statsRow:  { flexDirection: 'row', gap: 10 },
  statCard:  {
    flex: 1, borderRadius: 12, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  statValue: { fontSize: 26, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 11, textAlign: 'center' },

  // Diagnostic
  diagCard:  {
    borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  diagBarRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 },
  diagPct:     { fontSize: 28, fontWeight: '800' },
  diagLabel:   { fontSize: 13 },
  barTrack:    { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  barFill:     { height: '100%', borderRadius: 4 },
  sectionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sectionTag:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  sectionName: { fontSize: 11, fontWeight: '700' },
  sectionStatus: { fontSize: 10, marginTop: 1 },

  // Sessions
  sessionsList: { borderRadius: 12, overflow: 'hidden' },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10,
    borderBottomWidth: 1,
  },
  sessionDot:  { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sessionTitle: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  sessionDate:  { fontSize: 11 },

  // Empty
  empty:     { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13 },
});

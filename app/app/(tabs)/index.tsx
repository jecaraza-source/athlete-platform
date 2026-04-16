import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store';
import { Colors, PRIMARY, StatusColors } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { Badge } from '@/components/ui/badge';
import { Ionicons } from '@expo/vector-icons';
import { countAthletes, getAthleteByEmail, getAthleteByProfileId } from '@/services/athletes';
import { countOpenTickets } from '@/services/tickets';
import { getDiagnostic, getDiagnosticSections } from '@/services/diagnostic';
import type { AthleteInitialDiagnostic, AthleteSection } from '@/types';
import { DIAGNOSTIC_STATUS_LABELS, SECTION_LABELS } from '@/types';

export default function DashboardScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { profile, isStaff, isAthlete, fullName, roles, isInitialized } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Staff stats
  const [athleteCount, setAthleteCount] = useState({ total: 0, activos: 0 });
  const [openTickets, setOpenTickets] = useState(0);

  // Athlete stats
  const [diagnostic, setDiagnostic] = useState<AthleteInitialDiagnostic | null>(null);
  const [sections, setSections] = useState<AthleteSection[]>([]);

  async function loadData() {
    try {
      if (isStaff()) {
        const [counts, tickets] = await Promise.all([
          countAthletes(),
          countOpenTickets(),
        ]);
        setAthleteCount(counts);
        setOpenTickets(tickets);
      } else if (isAthlete() && profile) {
        // Primary: email. Fallback: profile_id.
        const email = profile.email;
        const athlete = email
          ? (await getAthleteByEmail(email)) ?? (await getAthleteByProfileId(profile.id))
          : await getAthleteByProfileId(profile.id);
          if (athlete) {
          const diag = await getDiagnostic(athlete.id);
          setDiagnostic(diag);
          if (diag) {
            const secs = await getDiagnosticSections(diag.id);
            setSections(secs);
          }
        }
      }
    } catch (e) {
      console.warn('[dashboard] load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Re-run when auth store finishes initializing or the user's profile changes.
  // This ensures the dashboard reflects the correct role (staff/athlete) even
  // when roles load after the component first mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isInitialized) return;
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, profile?.id]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading) return <Loading fullScreen />;

  const roleLabel = roles[0]?.name ?? 'Usuario';
  const statusColors = diagnostic
    ? StatusColors[diagnostic.overall_status] ?? StatusColors.pendiente
    : null;

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.icon }]}>Bienvenido</Text>
          <Text style={[styles.name, { color: colors.text }]}>{fullName() || 'Usuario'}</Text>
          <View style={[styles.roleTag, { backgroundColor: PRIMARY + '18' }]}>
            <Text style={[styles.roleText, { color: PRIMARY }]}>{roleLabel}</Text>
          </View>
        </View>

        {/* Staff dashboard */}
        {isStaff() && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Resumen</Text>
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{athleteCount.activos}</Text>
                <Text style={[styles.statLabel, { color: colors.icon }]}>Atletas activos</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{athleteCount.total}</Text>
                <Text style={[styles.statLabel, { color: colors.icon }]}>Total atletas</Text>
              </Card>
            </View>
            <View style={styles.statsRow}>
              <Card style={{ ...styles.statCard, flex: 1 }}>
                <Text style={[styles.statValue, { color: openTickets > 0 ? '#dc2626' : '#15803d' }]}>
                  {openTickets}
                </Text>
                <Text style={[styles.statLabel, { color: colors.icon }]}>Tickets abiertos</Text>
              </Card>
            </View>
          </>
        )}

        {/* Athlete dashboard */}
        {isAthlete() && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Mi Diagnóstico</Text>
            {diagnostic ? (
              <Card style={styles.diagCard}>
                <View style={styles.diagHeader}>
                  <Text style={[styles.diagTitle, { color: colors.text }]}>Estado general</Text>
                  {statusColors && (
                    <Badge
                      label={DIAGNOSTIC_STATUS_LABELS[diagnostic.overall_status]}
                      bg={statusColors.bg}
                      color={statusColors.text}
                    />
                  )}
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${diagnostic.completion_pct}%` as never, backgroundColor: PRIMARY },
                    ]}
                  />
                </View>
                <Text style={[styles.pctText, { color: colors.icon }]}>
                  {diagnostic.completion_pct}% completado
                </Text>

                {sections.length > 0 && (
                  <View style={styles.sections}>
                    {sections.map((s) => {
                      const sc = StatusColors[s.status] ?? StatusColors.pendiente;
                      return (
                        <View key={s.id} style={styles.sectionRow}>
                          <Text style={[styles.sectionName, { color: colors.text }]}>
                            {SECTION_LABELS[s.section]}
                          </Text>
                          <Badge
                            label={DIAGNOSTIC_STATUS_LABELS[s.status]}
                            bg={sc.bg}
                            color={sc.text}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}
              </Card>
            ) : (
              <Card>
                <Text style={{ color: colors.icon, fontSize: 14 }}>
                  Aún no tienes un diagnóstico inicial registrado.
                </Text>
              </Card>
            )}
          </>
        )}
        {/* Plan & Progress — athletes only */}
        {isAthlete() && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 8 }]}>Mi espacio</Text>
            <View style={styles.quickRow}>
              <TouchableOpacity
                onPress={() => router.push('/app/plan' as never)}
                style={[styles.quickCard, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#eff6ff' }]}
                activeOpacity={0.8}
              >
                <View style={[styles.quickIcon, { backgroundColor: '#dbeafe' }]}>
                  <Ionicons name="clipboard-outline" size={20} color="#1d4ed8" />
                </View>
                <Text style={[styles.quickTitle, { color: colors.text }]}>Mis Planes</Text>
                <Text style={[styles.quickSub, { color: colors.icon }]}>Médico · Nutrición · Psico</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/app/progress' as never)}
                style={[styles.quickCard, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#f0fdf4' }]}
                activeOpacity={0.8}
              >
                <View style={[styles.quickIcon, { backgroundColor: '#dcfce7' }]}>
                  <Ionicons name="trending-up-outline" size={20} color="#15803d" />
                </View>
                <Text style={[styles.quickTitle, { color: colors.text }]}>Mi Progreso</Text>
                <Text style={[styles.quickSub, { color: colors.icon }]}>Sesiones · Diagnóstico</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Protocols quick access — visible to all roles */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 8 }]}>Protocolos</Text>
        <TouchableOpacity
          onPress={() => router.push('/app/protocols' as never)}
          style={[
            styles.protocolCard,
            { backgroundColor: scheme === 'dark' ? '#1e2022' : '#f5f3ff' },
          ]}
          activeOpacity={0.8}
        >
          <View style={[styles.protocolIcon, { backgroundColor: '#ede9fe' }]}>
            <Ionicons name="document-text-outline" size={20} color="#7c3aed" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.protocolTitle, { color: colors.text }]}>
              Guías operativas del equipo
            </Text>
            <Text style={[styles.protocolSub, { color: colors.icon }]}>
              Entrenador · Fisio · Médico · Nutrición · Psicología
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.icon} />
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  container: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  greeting: { fontSize: 13, marginBottom: 2 },
  name: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  roleTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleText: { fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: '800', color: PRIMARY },
  statLabel: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  diagCard: { marginBottom: 16 },
  diagHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  diagTitle: { fontSize: 15, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, marginBottom: 6 },
  progressFill: { height: 6, borderRadius: 3 },
  pctText: { fontSize: 12, marginBottom: 16 },
  sections: { gap: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionName: { fontSize: 13 },

  // Quick access cards (Plan + Progress)
  quickRow:  { flexDirection: 'row', gap: 10, marginBottom: 8 },
  quickCard: {
    flex: 1, borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  quickIcon: {
    width: 40, height: 40, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  quickTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  quickSub:   { fontSize: 10, lineHeight: 14 },

  // Protocols
  protocolCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  protocolIcon: {
    width: 40, height: 40, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  protocolTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  protocolSub:   { fontSize: 11 },
});

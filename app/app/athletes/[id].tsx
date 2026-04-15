import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Colors, PRIMARY, SectionColors, StatusColors } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { getAthlete } from '@/services/athletes';
import { getDiagnostic, getDiagnosticSections } from '@/services/diagnostic';
import { listTrainingSessions, type TrainingSession } from '@/services/training';
import {
  listNutritionPlans, listPhysioCases, listPsychologyCases,
  type NutritionPlan, type PhysioCase, type PsychologyCase,
} from '@/services/follow-up';
import type { Athlete, AthleteInitialDiagnostic, AthleteSection } from '@/types';
import { SECTION_LABELS, DIAGNOSTIC_STATUS_LABELS, SECTION_KEYS, ATHLETE_STATUS_LABELS } from '@/types';

const INFO_ROWS: { label: string; key: keyof Athlete }[] = [
  { label: 'Código', key: 'athlete_code' },
  { label: 'Disciplina', key: 'discipline' },
  { label: 'Fecha de nacimiento', key: 'birth_date' },
  { label: 'Género', key: 'gender' },
  { label: 'Nacionalidad', key: 'nationality' },
  { label: 'Correo', key: 'email' },
  { label: 'Teléfono', key: 'phone' },
];

export default function AthleteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [diagnostic, setDiagnostic] = useState<AthleteInitialDiagnostic | null>(null);
  const [sections, setSections] = useState<AthleteSection[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
  const [nutritionPlans, setNutritionPlans] = useState<NutritionPlan[]>([]);
  const [physioCases, setPhysioCases] = useState<PhysioCase[]>([]);
  const [psychCases, setPsychCases] = useState<PsychologyCase[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'diagnostic' | 'seguimiento'>('info');

  useEffect(() => {
    (async () => {
      try {
        const a = await getAthlete(id);
        setAthlete(a);
        if (a) {
          const [diag, sessions, plans, physio, psych] = await Promise.all([
            getDiagnostic(a.id),
            listTrainingSessions(a.id),
            listNutritionPlans(a.id),
            listPhysioCases(a.id),
            listPsychologyCases(a.id),
          ]);
          setDiagnostic(diag);
          setTrainingSessions(sessions);
          setNutritionPlans(plans);
          setPhysioCases(physio);
          setPsychCases(psych);
          if (diag) {
            const secs = await getDiagnosticSections(diag.id);
            setSections(secs);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Loading fullScreen />;
  if (!athlete) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, textAlign: 'center', marginTop: 40 }}>
          Atleta no encontrado
        </Text>
      </SafeAreaView>
    );
  }

  const initials = `${athlete.first_name[0] ?? ''}${athlete.last_name[0] ?? ''}`.toUpperCase();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: PRIMARY }]}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>
            {athlete.first_name} {athlete.last_name}
          </Text>
          {athlete.status && (
            <Text style={[styles.status, { color: colors.icon }]}>
              {ATHLETE_STATUS_LABELS[athlete.status] ?? athlete.status}
            </Text>
          )}
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { borderBottomColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}>
          {(['info', 'diagnostic', 'seguimiento'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === tab ? PRIMARY : colors.icon },
              ]}>
                {tab === 'info' ? 'Información' : tab === 'diagnostic' ? 'Diagnóstico' : 'Seguimiento'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info tab */}
        {activeTab === 'info' && (
          <Card style={styles.card}>
            {INFO_ROWS.map((row) => {
              const val = athlete[row.key];
              if (!val) return null;
              return (
                <View key={row.key} style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.icon }]}>{row.label}</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{String(val)}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Seguimiento tab */}
        {activeTab === 'seguimiento' && (
          <>
            {/* Entrenamiento */}
            <Text style={[styles.sectionsTitle, { color: colors.text }]}>
              Entrenamiento ({trainingSessions.length})
            </Text>
            {trainingSessions.length === 0 ? (
              <Card><Text style={{ color: colors.icon, fontSize: 14 }}>Sin sesiones registradas.</Text></Card>
            ) : (
              trainingSessions.slice(0, 10).map((s) => (
                <Card key={s.id} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <View style={[styles.sessionIcon, { backgroundColor: PRIMARY + '18' }]}>
                      <Ionicons name="barbell-outline" size={16} color={PRIMARY} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                        {s.title}
                      </Text>
                      <Text style={[styles.sessionDate, { color: colors.icon }]}>
                        {new Date(s.session_date).toLocaleDateString('es-MX', {
                          weekday: 'short', day: '2-digit', month: 'short',
                        })}
                        {s.location ? ` • ${s.location}` : ''}
                      </Text>
                    </View>
                  </View>
                  {s.notes && (
                    <Text style={[styles.sessionNotes, { color: colors.icon }]} numberOfLines={2}>
                      {s.notes}
                    </Text>
                  )}
                </Card>
              ))
            )}

            {/* Nutrición */}
            <Text style={[styles.sectionsTitle, { color: colors.text, marginTop: 16 }]}>
              Nutrición ({nutritionPlans.length})
            </Text>
            {nutritionPlans.length === 0 ? (
              <Card><Text style={{ color: colors.icon, fontSize: 14 }}>Sin planes de nutrición.</Text></Card>
            ) : (
              nutritionPlans.map((p) => (
                <Card key={p.id} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <View style={[styles.sessionIcon, { backgroundColor: '#dcfce718' }]}>
                      <Ionicons name="nutrition-outline" size={16} color="#15803d" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                        {p.title}
                      </Text>
                      <Text style={[styles.sessionDate, { color: colors.icon }]}>
                        {new Date(p.start_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {p.end_date ? ` – ${new Date(p.end_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}` : ' (en curso)'}
                      </Text>
                    </View>
                    <View style={[styles.statusTag, { backgroundColor: '#f0fdf4' }]}>
                      <Text style={{ fontSize: 10, color: '#15803d', fontWeight: '600' }}>{p.status}</Text>
                    </View>
                  </View>
                </Card>
              ))
            )}

            {/* Fisioterapia */}
            <Text style={[styles.sectionsTitle, { color: colors.text, marginTop: 16 }]}>
              Fisioterapia ({physioCases.length})
            </Text>
            {physioCases.length === 0 ? (
              <Card><Text style={{ color: colors.icon, fontSize: 14 }}>Sin casos de fisioterapia.</Text></Card>
            ) : (
              physioCases.map((c) => (
                <Card key={c.id} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <View style={[styles.sessionIcon, { backgroundColor: '#ffe4e6' }]}>
                      <Ionicons name="body-outline" size={16} color="#be123c" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                        {c.injuries?.[0]?.injury_type ?? 'Caso de fisioterapia'}
                      </Text>
                      <Text style={[styles.sessionDate, { color: colors.icon }]}>
                        Abierto {new Date(c.opened_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={[styles.statusTag, { backgroundColor: '#fff1f2' }]}>
                      <Text style={{ fontSize: 10, color: '#be123c', fontWeight: '600' }}>{c.status}</Text>
                    </View>
                  </View>
                </Card>
              ))
            )}

            {/* Psicología */}
            <Text style={[styles.sectionsTitle, { color: colors.text, marginTop: 16 }]}>
              Psicología ({psychCases.length})
            </Text>
            {psychCases.length === 0 ? (
              <Card><Text style={{ color: colors.icon, fontSize: 14 }}>Sin casos de psicología.</Text></Card>
            ) : (
              psychCases.map((c) => (
                <Card key={c.id} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <View style={[styles.sessionIcon, { backgroundColor: '#fef9c3' }]}>
                      <Ionicons name="happy-outline" size={16} color="#854d0e" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                        {c.summary ?? 'Caso de psicología'}
                      </Text>
                      <Text style={[styles.sessionDate, { color: colors.icon }]}>
                        Abierto {new Date(c.opened_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={[styles.statusTag, { backgroundColor: '#fefce8' }]}>
                      <Text style={{ fontSize: 10, color: '#854d0e', fontWeight: '600' }}>{c.status}</Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </>
        )}

        {/* Diagnostic tab */}
        {activeTab === 'diagnostic' && (
          <>
            {diagnostic ? (
              <>
                <Card style={styles.card}>
                  <View style={styles.diagHeader}>
                    <Text style={[styles.diagTitle, { color: colors.text }]}>Estado general</Text>
                    <Badge
                      label={DIAGNOSTIC_STATUS_LABELS[diagnostic.overall_status as keyof typeof DIAGNOSTIC_STATUS_LABELS]}
                      bg={(StatusColors[diagnostic.overall_status as keyof typeof StatusColors] ?? StatusColors.pendiente).bg}
                      color={(StatusColors[diagnostic.overall_status as keyof typeof StatusColors] ?? StatusColors.pendiente).text}
                    />
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${diagnostic.completion_pct}%` as never, backgroundColor: PRIMARY },
                      ]}
                    />
                  </View>
                  <Text style={[styles.pct, { color: colors.icon }]}>
                    {diagnostic.completion_pct}% completado
                  </Text>
                </Card>

                <Text style={[styles.sectionsTitle, { color: colors.text }]}>Secciones</Text>
                {SECTION_KEYS.map((key) => {
                  const sec = sections.find((s: AthleteSection) => s.section === key);
                  const sc = SectionColors[key];
                  const status = (sec?.status ?? 'pendiente') as keyof typeof StatusColors;
                  const statusC = StatusColors[status] ?? StatusColors.pendiente;
                  return (
                    <Card key={key} style={{ ...styles.sectionCard, borderLeftColor: sc.border, borderLeftWidth: 4 }}>
                      <View style={styles.sectionRow}>
                        <View style={[styles.sectionBadge, { backgroundColor: sc.bg }]}>
                          <Text style={[styles.sectionBadgeText, { color: sc.text }]}>
                            {SECTION_LABELS[key]}
                          </Text>
                        </View>
                        <Badge
                          label={DIAGNOSTIC_STATUS_LABELS[status as keyof typeof DIAGNOSTIC_STATUS_LABELS]}
                          bg={statusC.bg}
                          color={statusC.text}
                        />
                      </View>
                      {sec && (
                        <View style={styles.miniProgress}>
                          <View
                            style={[
                              styles.miniProgressFill,
                              { width: `${sec.completion_pct}%` as never, backgroundColor: sc.text },
                            ]}
                          />
                        </View>
                      )}
                    </Card>
                  );
                })}
              </>
            ) : (
              <Card>
                <Text style={{ color: colors.icon }}>Sin diagnóstico registrado.</Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  initials: { color: '#fff', fontSize: 26, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  status: { fontSize: 13 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: PRIMARY },
  tabText: { fontSize: 14, fontWeight: '600' },
  card: { marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' },
  infoLabel: { fontSize: 13, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },
  diagHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  diagTitle: { fontSize: 15, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, marginBottom: 6 },
  progressFill: { height: 6, borderRadius: 3 },
  pct: { fontSize: 12 },
  sectionsTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  sectionCard: { marginBottom: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sectionBadgeText: { fontSize: 13, fontWeight: '600' },
  miniProgress: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2 },
  miniProgressFill: { height: 4, borderRadius: 2 },
  // Follow-up sections (Seguimiento tab)
  sessionCard: { marginBottom: 10 },
  sessionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  sessionIcon: {
    width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  sessionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  sessionDate: { fontSize: 12 },
  sessionNotes: { fontSize: 12, lineHeight: 17, marginTop: 4, fontStyle: 'italic' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
});

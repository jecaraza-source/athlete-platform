import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme,
  RefreshControl, TouchableOpacity, Linking, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { Loading } from '@/components/ui/loading';
import { EmptyView } from '@/components/ui/empty-view';
import { useAuthStore } from '@/store';
import {
  getPublishedPlansForAthlete,
  getPlanFileUrl,
  type AssignedPlan,
  type AssignedPlanType,
} from '@/services/plans';

// ---------------------------------------------------------------------------
// Plan metadata (English type keys from the new plans table)
// ---------------------------------------------------------------------------

type PlanMeta = { label: string; icon: string; bg: string; color: string };

const PLAN_META: Record<AssignedPlanType, PlanMeta> = {
  medical:        { label: 'Plan Médico',            icon: 'medical-outline',   bg: '#fff1f2', color: '#be123c' },
  nutrition:      { label: 'Plan Alimentario',       icon: 'nutrition-outline', bg: '#f0fdf4', color: '#15803d' },
  psychology:     { label: 'Plan Psicológico',       icon: 'happy-outline',     bg: '#faf5ff', color: '#7c3aed' },
  training:       { label: 'Plan de Entrenamiento',  icon: 'barbell-outline',   bg: '#eff6ff', color: '#1d4ed8' },
  rehabilitation: { label: 'Plan de Rehabilitación', icon: 'fitness-outline',   bg: '#fff7ed', color: '#c2410c' },
};

// ---------------------------------------------------------------------------
// Plan card
// ---------------------------------------------------------------------------

function PlanCard({ plan }: { plan: AssignedPlan }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const meta   = PLAN_META[plan.type] ?? PLAN_META.medical;

  const [expanded, setExpanded]       = useState(false);
  const [pdfLoading, setPdfLoading]   = useState(false);

  const createdDate = new Date(plan.created_at).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  async function openPdf() {
    if (!plan.file_path) return;
    setPdfLoading(true);
    try {
      const url = await getPlanFileUrl(plan.file_path);
      if (url) await Linking.openURL(url);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff', borderLeftColor: meta.color }]}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
        style={styles.cardHeader}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon as never} size={18} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {plan.title}
          </Text>
          <Text style={[styles.cardSubtitle, { color: meta.color }]}>{meta.label}</Text>
          <Text style={[styles.cardDate, { color: colors.icon }]}>{createdDate}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.icon}
        />
      </TouchableOpacity>

      {/* Expanded body */}
      {expanded && (
        <View style={[styles.cardBody, { borderTopColor: scheme === 'dark' ? '#374151' : '#f1f5f9' }]}>
          {plan.description ? (
            <Text style={[styles.cardContent, { color: colors.text }]}>{plan.description}</Text>
          ) : (
            <Text style={[styles.cardEmpty, { color: colors.icon }]}>
              Sin descripción adicional.
            </Text>
          )}

          {/* PDF button */}
          {plan.file_path && (
            <TouchableOpacity
              onPress={openPdf}
              disabled={pdfLoading}
              style={[styles.pdfBtn, { borderColor: meta.color }]}
              activeOpacity={0.75}
            >
              {pdfLoading ? (
                <ActivityIndicator size="small" color={meta.color} />
              ) : (
                <Ionicons name="document-text-outline" size={15} color={meta.color} />
              )}
              <Text style={[styles.pdfBtnText, { color: meta.color }]}>
                {pdfLoading ? 'Cargando…' : 'Ver documento PDF'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function PlanScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { profile, isAthlete } = useAuthStore();
  // athleteId is resolved once by the auth store and used as an explicit
  // filter in getPublishedPlansForAthlete (defense-in-depth vs RLS-only).
  const athleteId = useAuthStore((s) => s.athleteId);

  const [plans, setPlans]               = useState<AssignedPlan[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!profile) { setLoading(false); return; }
    try {
      const data = await getPublishedPlansForAthlete(athleteId);
      setPlans(data);
    } catch (e) {
      console.warn('[plan] load error', e);
    } finally {
      setLoading(false);
      if (refresh) setRefreshing(false);
    }
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  if (loading) return <Loading fullScreen />;

  if (!isAthlete()) {
    return (
      <EmptyView
        title="Planes individuales"
        subtitle="Esta sección está disponible para atletas. Gestiona los planes desde la plataforma web."
      />
    );
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={[styles.header, { color: colors.text }]}>Mis Planes</Text>
      <Text style={[styles.sub, { color: colors.icon }]}>
        Planes personalizados elaborados por tu equipo técnico.
        Toca cada plan para ver el detalle.
      </Text>

      {plans.length === 0 ? (
        <View style={styles.noPlans}>
          <Ionicons name="document-outline" size={40} color={colors.icon} />
          <Text style={[styles.noPlansTitle, { color: colors.text }]}>
            Sin planes asignados
          </Text>
          <Text style={[styles.noPlansText, { color: colors.icon }]}>
            Tu equipo técnico aún no ha publicado planes para ti.
            Revisa más tarde o contacta a tu entrenador.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
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
  container: { padding: 20, paddingBottom: 40 },
  header:    { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sub:       { fontSize: 13, marginBottom: 20, lineHeight: 18 },
  list:      { gap: 10 },

  card: {
    borderRadius: 12, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 14, gap: 12,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 2,
  },
  cardTitle:    { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  cardSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  cardDate:     { fontSize: 11, marginTop: 1 },
  cardBody:     { borderTopWidth: 1, padding: 14, gap: 10 },
  cardContent:  { fontSize: 13, lineHeight: 20 },
  cardEmpty:    { fontSize: 13, fontStyle: 'italic' },

  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    alignSelf: 'flex-start', marginTop: 4,
  },
  pdfBtnText: { fontSize: 13, fontWeight: '600' },

  noPlans:      { alignItems: 'center', paddingTop: 40, gap: 10 },
  noPlansTitle: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  noPlansText:  { fontSize: 13, textAlign: 'center', lineHeight: 18, maxWidth: 280 },
});

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { Loading } from '@/components/ui/loading';
import { EmptyView } from '@/components/ui/empty-view';
import { useAuthStore } from '@/store';
import { getAthleteByEmail, getAthleteByProfileId } from '@/services/athletes';
import { getIndividualPlans, type IndividualPlan, type PlanType } from '@/services/diagnostic';

// ---------------------------------------------------------------------------
// Plan metadata
// ---------------------------------------------------------------------------

type PlanMeta = { label: string; icon: string; bg: string; color: string };

const PLAN_META: Record<PlanType, PlanMeta> = {
  medico:        { label: 'Plan Médico',        icon: 'medical-outline',      bg: '#fff1f2', color: '#be123c' },
  alimentario:   { label: 'Plan Alimentario',   icon: 'nutrition-outline',    bg: '#f0fdf4', color: '#15803d' },
  psicologico:   { label: 'Plan Psicológico',   icon: 'happy-outline',        bg: '#faf5ff', color: '#7c3aed' },
  entrenamiento: { label: 'Plan de Entrena',    icon: 'barbell-outline',      bg: '#eff6ff', color: '#1d4ed8' },
  rehabilitacion:{ label: 'Plan de Rehab.',     icon: 'fitness-outline',      bg: '#fff7ed', color: '#c2410c' },
};

const ALL_PLAN_TYPES: PlanType[] = [
  'medico', 'alimentario', 'psicologico', 'entrenamiento', 'rehabilitacion',
];

// ---------------------------------------------------------------------------
// Plan card (expandable)
// ---------------------------------------------------------------------------

function PlanCard({ plan, meta }: { plan: IndividualPlan; meta: PlanMeta }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [expanded, setExpanded] = useState(false);

  const updatedDate = new Date(plan.updated_at).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <View style={[styles.card, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff', borderLeftColor: meta.color }]}>
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
        style={styles.cardHeader}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon as never} size={18} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{meta.label}</Text>
          <Text style={[styles.cardDate, { color: colors.icon }]}>Actualizado: {updatedDate}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.icon}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.cardBody, { borderTopColor: scheme === 'dark' ? '#374151' : '#f1f5f9' }]}>
          {plan.content ? (
            <Text style={[styles.cardContent, { color: colors.text }]}>{plan.content}</Text>
          ) : (
            <Text style={[styles.cardEmpty, { color: colors.icon }]}>
              El contenido de este plan está pendiente.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// Empty placeholder for plan types not yet assigned
function PlanPlaceholder({ meta }: { meta: PlanMeta }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  return (
    <View style={[
      styles.card,
      styles.cardEmpty2,
      { backgroundColor: scheme === 'dark' ? '#1a1c1e' : '#f8fafc', borderLeftColor: '#cbd5e1' },
    ]}>
      <View style={[styles.iconWrap, { backgroundColor: '#f1f5f9' }]}>
        <Ionicons name={meta.icon as never} size={18} color="#94a3b8" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: colors.icon }]}>{meta.label}</Text>
        <Text style={[styles.cardDate, { color: colors.icon }]}>Sin plan asignado</Text>
      </View>
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

  const [plans, setPlans]       = useState<IndividualPlan[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [athleteId, setAthleteId] = useState<string | null>(null);

  async function load(refresh = false) {
    if (!profile) { setLoading(false); return; }
    try {
      // Email-first athlete lookup
      let aId = athleteId;
      if (!aId) {
        const email = profile.email;
        const row = email
          ? (await getAthleteByEmail(email)) ?? (await getAthleteByProfileId(profile.id))
          : await getAthleteByProfileId(profile.id);
        aId = row?.id ?? null;
        setAthleteId(aId);
      }
      if (aId) {
        const data = await getIndividualPlans(aId);
        setPlans(data);
      }
    } catch (e) {
      console.warn('[plan] load error', e);
    } finally {
      setLoading(false);
      if (refresh) setRefreshing(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [profile?.id]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  if (loading) return <Loading fullScreen />;

  // Build map by plan_type for quick lookup
  const planMap = Object.fromEntries(plans.map((p) => [p.plan_type, p]));

  // Staff / non-athlete
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
        Toca cada sección para ver el contenido.
      </Text>

      <View style={styles.list}>
        {ALL_PLAN_TYPES.map((type) => {
          const plan = planMap[type] as IndividualPlan | undefined;
          const meta = PLAN_META[type];
          return plan
            ? <PlanCard key={type} plan={plan} meta={meta} />
            : <PlanPlaceholder key={type} meta={meta} />;
        })}
      </View>

      {plans.length === 0 && (
        <View style={styles.noPlans}>
          <Ionicons name="document-outline" size={36} color={colors.icon} />
          <Text style={[styles.noPlansText, { color: colors.icon }]}>
            Aún no tienes planes asignados.
            Tu equipo técnico los creará tras completar el diagnóstico inicial.
          </Text>
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
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  cardEmpty2: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle:   { fontSize: 14, fontWeight: '600' },
  cardDate:    { fontSize: 11, marginTop: 2 },
  cardBody:    { borderTopWidth: 1, padding: 14 },
  cardContent: { fontSize: 13, lineHeight: 20 },
  cardEmpty:   { fontSize: 13, fontStyle: 'italic' },

  noPlans: { alignItems: 'center', paddingTop: 20, gap: 10 },
  noPlansText: { fontSize: 13, textAlign: 'center', lineHeight: 18, maxWidth: 260 },
});

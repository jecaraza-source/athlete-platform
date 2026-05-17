/**
 * app/app/(tabs)/finances.tsx
 *
 * Finance Reports screen — read-only dashboard for staff with
 * `view_finances` permission.
 *
 * Sections:
 *  1. Presupuesto global (KPI cards + execution bar)
 *  2. Gastos por estado  (horizontal % bars)
 *  3. Gastos por categoría  (horizontal % bars with colour dot)
 *  4. Por disciplina / destino  (compact rows)
 *  5. Métodos de pago  (list with amounts)
 *  6. Top 10 gastos  (ranked list)
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme,
  RefreshControl, TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { useAuthStore } from '@/store';
import {
  getFinanceReport,
  type FinanceMobileReport,
} from '@/services/finance-reports';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCREEN_W = Dimensions.get('window').width;

const STATUS_LABEL: Record<string, string> = {
  draft:     'Borrador',
  submitted: 'En revisión',
  approved:  'Aprobado',
  rejected:  'Rechazado',
  paid:      'Pagado',
  cancelled: 'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  draft:     '#94a3b8',
  submitted: '#f59e0b',
  approved:  '#10b981',
  rejected:  '#ef4444',
  paid:      '#3b82f6',
  cancelled: '#6b7280',
};

const METHOD_LABEL: Record<string, string> = {
  transfer: 'Transferencia',
  check:    'Cheque',
  cash:     'Efectivo',
  card:     'Tarjeta',
  other:    'Otro',
};

// Palette for categories without a DB colour
const PIE_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899',
  '#8b5cf6', '#14b8a6', '#ef4444', '#f97316', '#6b7280',
];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmt(v: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(v);
}

function fmtShort(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  return (
    <View style={sc.sectionHeader}>
      <Text style={[sc.sectionTitle, { color: colors.text }]}>{title}</Text>
      {subtitle && <Text style={[sc.sectionSub, { color: colors.icon }]}>{subtitle}</Text>}
    </View>
  );
}

function KPICard({
  label, value, sub, accent = PRIMARY,
}: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  return (
    <Card style={sc.kpiCard}>
      <Text style={[sc.kpiLabel, { color: colors.icon }]}>{label}</Text>
      <Text style={[sc.kpiValue, { color: accent }]}>{value}</Text>
      {sub ? <Text style={[sc.kpiSub, { color: colors.icon }]}>{sub}</Text> : null}
    </Card>
  );
}

function BarRow({
  label, value, total, color, right,
}: {
  label: string; value: number; total: number; color: string; right?: string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const pct    = total > 0 ? Math.round((value / total) * 100) : 0;
  const maxBarW = SCREEN_W - 32 - 32 - 72;   // screen - padding - card padding - right label

  return (
    <View style={sc.barRow}>
      <View style={sc.barLabelRow}>
        <Text style={[sc.barLabel, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[sc.barRight, { color: colors.icon }]}>
          {right ?? `${pct}%`}
        </Text>
      </View>
      <View style={[sc.barTrack, { backgroundColor: scheme === 'dark' ? '#2a2d2f' : '#f1f5f9' }]}>
        <View
          style={[
            sc.barFill,
            { width: pct > 0 ? (maxBarW * pct) / 100 : 2, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

function ColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, marginRight: 6,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Access denied screen
// ---------------------------------------------------------------------------

function AccessDenied() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  return (
    <View style={sc.centered}>
      <Ionicons name="lock-closed-outline" size={44} color={colors.icon} />
      <Text style={[sc.accessTitle, { color: colors.text }]}>Acceso restringido</Text>
      <Text style={[sc.accessSub, { color: colors.icon }]}>
        Necesitas el permiso <Text style={{ fontWeight: '700' }}>view_finances</Text> para ver los reportes financieros.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function FinancesScreen() {
  const scheme  = useColorScheme() ?? 'light';
  const colors  = Colors[scheme];
  const hasPermission = useAuthStore((s) => s.permissions.has('view_finances'));

  const [report, setReport]     = useState<FinanceMobileReport | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getFinanceReport();
      setReport(data);
    } catch (e) {
      setError('No se pudieron cargar los datos. Verifica tu conexión.');
      console.warn('[finances] load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!hasPermission) { setLoading(false); return; }
    load();
  }, [load, hasPermission]);

  const onRefresh = () => { setRefreshing(true); load(); };

  // ── Permission guard ────────────────────────────────────────────────────
  if (!hasPermission) return <AccessDenied />;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return <Loading fullScreen />;

  // ── Error banner (inline, with retry) ────────────────────────────────────
  if (error && !report) {
    return (
      <View style={sc.centered}>
        <Ionicons name="wifi-outline" size={40} color="#dc2626" />
        <Text style={[sc.accessTitle, { color: colors.text }]}>Sin conexión</Text>
        <Text style={[sc.accessSub, { color: colors.icon }]}>{error}</Text>
        <TouchableOpacity
          onPress={() => { setLoading(true); load(); }}
          style={[sc.retryBtn, { backgroundColor: PRIMARY }]}
        >
          <Text style={sc.retryBtnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const r = report!;
  const { summary } = r;
  const exercisedPct = summary.total_budget > 0
    ? Math.round((summary.total_exercised / summary.total_budget) * 100)
    : 0;
  const totalExpenses = r.by_status.reduce((s, x) => s + x.total, 0);

  return (
    <SafeAreaView style={[sc.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={sc.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >

        {/* ── 1. Presupuesto global ─────────────────────────────────────── */}
        <SectionHeader title="Presupuesto global" />

        <View style={sc.kpiRow}>
          <KPICard
            label="Total presupuestado"
            value={fmtShort(summary.total_budget)}
          />
          <KPICard
            label="Ejercido"
            value={fmtShort(summary.total_exercised)}
            sub={`${exercisedPct}%`}
            accent={exercisedPct > 90 ? '#dc2626' : exercisedPct > 70 ? '#d97706' : '#16a34a'}
          />
        </View>

        <View style={sc.kpiRow}>
          <KPICard
            label="Disponible"
            value={fmtShort(Math.max(0, summary.total_available))}
            accent={summary.total_available < 0 ? '#dc2626' : '#0a7ea4'}
          />
          <KPICard
            label="Pendientes aprob."
            value={String(summary.pending_count)}
            sub={fmtShort(summary.pending_amount)}
            accent="#d97706"
          />
        </View>

        {/* Execution bar */}
        <Card style={sc.execCard}>
          <View style={sc.execHeader}>
            <Text style={[sc.execTitle, { color: colors.text }]}>Ejecución presupuestal</Text>
            <Text style={[
              sc.execPct,
              { color: exercisedPct > 90 ? '#dc2626' : exercisedPct > 70 ? '#d97706' : '#16a34a' },
            ]}>
              {exercisedPct}%
            </Text>
          </View>
          <View style={[sc.execTrack, { backgroundColor: scheme === 'dark' ? '#2a2d2f' : '#f1f5f9' }]}>
            <View
              style={[
                sc.execFill,
                {
                  width: `${Math.min(100, exercisedPct)}%` as never,
                  backgroundColor: exercisedPct > 90 ? '#dc2626' : exercisedPct > 70 ? '#d97706' : '#16a34a',
                },
              ]}
            />
          </View>
          <View style={sc.execFooter}>
            <Text style={[sc.execFooterText, { color: colors.icon }]}>
              {fmt(summary.total_exercised)} ejercido
            </Text>
            <Text style={[sc.execFooterText, { color: colors.icon }]}>
              {fmt(summary.total_budget)} total
            </Text>
          </View>
        </Card>

        {/* Total pagado */}
        <Card style={[sc.paidCard, { backgroundColor: scheme === 'dark' ? '#0f2330' : '#e0f2fe' }]}>
          <Text style={[sc.paidLabel, { color: scheme === 'dark' ? '#7dd3fc' : '#0369a1' }]}>
            Total pagado (registrado)
          </Text>
          <Text style={[sc.paidValue, { color: scheme === 'dark' ? '#38bdf8' : '#0c4a6e' }]}>
            {fmt(summary.total_payments)}
          </Text>
        </Card>

        {/* ── 2. Gastos por estado ─────────────────────────────────────────── */}
        {r.by_status.length > 0 && (
          <>
            <SectionHeader title="Gastos por estado" subtitle="Monto total por estado del flujo" />
            <Card>
              {r.by_status.map((s) => (
                <BarRow
                  key={s.status}
                  label={STATUS_LABEL[s.status] ?? s.status}
                  value={s.total}
                  total={totalExpenses}
                  color={STATUS_COLOR[s.status] ?? '#94a3b8'}
                  right={`${fmt(s.total)} · ${s.count}`}
                />
              ))}
            </Card>
          </>
        )}

        {/* ── 3. Gastos por categoría ───────────────────────────────────────── */}
        {r.by_category.length > 0 && (
          <>
            <SectionHeader title="Gastos por categoría" subtitle="Top 8 por monto" />
            <Card>
              {r.by_category.map((c, i) => {
                const dotColor = c.color ?? PIE_COLORS[i % PIE_COLORS.length];
                const pct = totalExpenses > 0 ? Math.round((c.total / totalExpenses) * 100) : 0;
                return (
                  <View key={c.name} style={sc.catRow}>
                    <ColorDot color={dotColor} />
                    <Text
                      style={[sc.catName, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                    <Text style={[sc.catPct, { color: colors.icon }]}>{pct}%</Text>
                    <Text style={[sc.catAmt, { color: colors.text }]}>
                      {fmtShort(c.total)}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* ── 4. Por disciplina / destino ─────────────────────────────────── */}
        {r.by_disciplina.length > 0 && (
          <>
            <SectionHeader title="Por disciplina / destino" subtitle="Top 10 por monto" />
            <Card>
              {r.by_disciplina.map((d, i) => (
                <BarRow
                  key={d.disciplina}
                  label={d.disciplina}
                  value={d.total}
                  total={r.by_disciplina[0].total}
                  color={PIE_COLORS[i % PIE_COLORS.length]}
                  right={fmtShort(d.total)}
                />
              ))}
            </Card>
          </>
        )}

        {/* ── 5. Métodos de pago ───────────────────────────────────────────── */}
        {r.by_payment_method.length > 0 && (
          <>
            <SectionHeader title="Métodos de pago" />
            <Card>
              {r.by_payment_method.map((m, i) => {
                const totalPaid = r.by_payment_method.reduce((s, x) => s + x.total, 0);
                const pct = totalPaid > 0 ? Math.round((m.total / totalPaid) * 100) : 0;
                return (
                  <View key={m.method} style={sc.methodRow}>
                    <View style={[sc.methodDot, { backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }]} />
                    <Text style={[sc.methodName, { color: colors.text }]}>
                      {METHOD_LABEL[m.method] ?? m.method}
                    </Text>
                    <Text style={[sc.methodPct, { color: colors.icon }]}>{pct}%</Text>
                    <View style={sc.methodRight}>
                      <Text style={[sc.methodAmt, { color: colors.text }]}>{fmt(m.total)}</Text>
                      <Text style={[sc.methodCount, { color: colors.icon }]}>
                        {m.count} pago{m.count !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* ── 6. Top 10 gastos ────────────────────────────────────────────── */}
        {r.top_expenses.length > 0 && (
          <>
            <SectionHeader
              title={`Top ${r.top_expenses.length} gastos`}
              subtitle="Por monto — todos los estados"
            />
            <Card>
              {r.top_expenses.map((e, i) => {
                const maxAmt = r.top_expenses[0].amount;
                const pct    = maxAmt > 0 ? Math.round((e.amount / maxAmt) * 100) : 0;
                const dotColor = e.category_color ?? PIE_COLORS[i % PIE_COLORS.length];
                return (
                  <View key={e.id} style={sc.expenseRow}>
                    <Text style={[sc.expenseRank, { color: colors.icon }]}>{i + 1}</Text>
                    <View style={sc.expenseBody}>
                      <View style={sc.expenseTitleRow}>
                        <ColorDot color={dotColor} size={8} />
                        <Text
                          style={[sc.expenseTitle, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {e.title}
                        </Text>
                        <Text style={[sc.expenseAmt, { color: colors.text }]}>
                          {fmtShort(e.amount)}
                        </Text>
                      </View>
                      <View style={sc.expenseMeta}>
                        {e.disciplina && (
                          <Text style={[sc.expenseTag, { color: PRIMARY, backgroundColor: PRIMARY + '15' }]}>
                            {e.disciplina}
                          </Text>
                        )}
                        <Text style={[sc.expenseStatus, { color: STATUS_COLOR[e.status] ?? '#94a3b8' }]}>
                          {STATUS_LABEL[e.status] ?? e.status}
                        </Text>
                      </View>
                      {/* mini progress bar relative to the top expense */}
                      <View style={[sc.expenseTrack, { backgroundColor: scheme === 'dark' ? '#2a2d2f' : '#f1f5f9' }]}>
                        <View
                          style={[
                            sc.expenseFill,
                            { width: `${pct}%` as never, backgroundColor: dotColor },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* ── Footer timestamp ────────────────────────────────────────────── */}
        <Text style={[sc.timestamp, { color: colors.icon }]}>
          Actualizado: {fmtDate(r.fetched_at)}
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sc = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },

  // Section headers
  sectionHeader: { marginTop: 20, marginBottom: 10 },
  sectionTitle:  { fontSize: 16, fontWeight: '700' },
  sectionSub:    { fontSize: 12, marginTop: 2 },

  // KPI cards
  kpiRow:   { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard:  { flex: 1 },
  kpiLabel: { fontSize: 11, marginBottom: 4 },
  kpiValue: { fontSize: 22, fontWeight: '800' },
  kpiSub:   { fontSize: 11, marginTop: 2 },

  // Execution bar card
  execCard:    { marginBottom: 10 },
  execHeader:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  execTitle:   { fontSize: 13, fontWeight: '600' },
  execPct:     { fontSize: 15, fontWeight: '800' },
  execTrack:   { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  execFill:    { height: 8, borderRadius: 4 },
  execFooter:  { flexDirection: 'row', justifyContent: 'space-between' },
  execFooterText: { fontSize: 11 },

  // Total paid card
  paidCard:  { marginBottom: 4, paddingVertical: 12 },
  paidLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  paidValue: { fontSize: 24, fontWeight: '800' },

  // Bar rows (status / discipline)
  barRow:     { marginBottom: 12 },
  barLabelRow:{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel:   { fontSize: 13, flex: 1, marginRight: 8 },
  barRight:   { fontSize: 12 },
  barTrack:   { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill:    { height: 6, borderRadius: 3, minWidth: 4 },

  // Category rows
  catRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  catName: { flex: 1, fontSize: 13, marginRight: 8 },
  catPct:  { fontSize: 12, marginRight: 8, minWidth: 30, textAlign: 'right' },
  catAmt:  { fontSize: 13, fontWeight: '600', minWidth: 52, textAlign: 'right' },

  // Payment method rows
  methodRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  methodDot:   { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  methodName:  { flex: 1, fontSize: 14 },
  methodPct:   { fontSize: 12, marginRight: 12 },
  methodRight: { alignItems: 'flex-end' },
  methodAmt:   { fontSize: 14, fontWeight: '700' },
  methodCount: { fontSize: 11, marginTop: 1 },

  // Top expenses
  expenseRow:      { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  expenseRank:     { width: 20, fontSize: 12, fontWeight: '700', paddingTop: 1 },
  expenseBody:     { flex: 1 },
  expenseTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  expenseTitle:    { flex: 1, fontSize: 13, fontWeight: '500', marginRight: 8 },
  expenseAmt:      { fontSize: 13, fontWeight: '700' },
  expenseMeta:     { flexDirection: 'row', gap: 6, marginBottom: 6 },
  expenseTag:      {
    fontSize: 10, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  expenseStatus:   { fontSize: 11, fontWeight: '500', paddingTop: 2 },
  expenseTrack:    { height: 3, borderRadius: 2, overflow: 'hidden' },
  expenseFill:     { height: 3, borderRadius: 2 },

  // Timestamp
  timestamp: { fontSize: 11, textAlign: 'center', marginTop: 16 },

  // Access denied / error
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  accessTitle:  { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  accessSub:    { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  retryBtn:     { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

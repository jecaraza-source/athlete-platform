/**
 * app/app/(tabs)/approvals.tsx
 *
 * Expense approval queue for staff with `approve_finances` permission.
 *
 * Two tabs:
 *   "Por aprobar"  — expenses in 'submitted' status → Aprobar / Rechazar
 *   "Aprobados"    — expenses in 'approved' status  → Marcar pagado / Rechazar
 *
 * Rejection notes are required and shown inline under the card.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme,
  RefreshControl, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { EmptyView } from '@/components/ui/empty-view';
import { useAuthStore } from '@/store';
import {
  listExpensesForApproval,
  processExpenseApproval,
  notifyFinanceApprovers,
  type ExpenseForApproval,
  type ApprovalAction,
} from '@/services/finance-approvals';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIE_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899',
  '#8b5cf6', '#14b8a6', '#ef4444', '#f97316', '#6b7280',
];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmt(v: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(v);
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Access denied view
// ---------------------------------------------------------------------------

function AccessDenied() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  return (
    <View style={ap.centered}>
      <Ionicons name="lock-closed-outline" size={44} color={colors.icon} />
      <Text style={[ap.accessTitle, { color: colors.text }]}>Acceso restringido</Text>
      <Text style={[ap.accessSub, { color: colors.icon }]}>
        Necesitas el permiso{' '}
        <Text style={{ fontWeight: '700' }}>approve_finances</Text> para autorizar gastos.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Expense card with inline action buttons
// ---------------------------------------------------------------------------

function ExpenseCard({
  expense,
  performedBy,
  performedByName,
  colorIndex,
  onActioned,
}: {
  expense:         ExpenseForApproval;
  performedBy:     string;
  performedByName: string;
  colorIndex:      number;
  onActioned:      () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [processing,   setProcessing]   = useState(false);
  const [showReject,   setShowReject]   = useState(false);
  const [rejectNotes,  setRejectNotes]  = useState('');
  const rejectInputRef = useRef<TextInput>(null);

  const dotColor = expense.category_color ?? PIE_COLORS[colorIndex % PIE_COLORS.length];
  const isSubmitted = expense.status === 'submitted';

  async function act(action: ApprovalAction, notes?: string) {
    setProcessing(true);
    try {
      const { error } = await processExpenseApproval(
        expense.id, action, performedBy, notes,
      );
      if (error) {
        Alert.alert('Error', `No se pudo procesar: ${error}`);
      } else {
        setShowReject(false);
        setRejectNotes('');
        // Fire-and-forget: email all other finance approvers about the action.
        // This never blocks the UI — errors are swallowed inside the function.
        notifyFinanceApprovers(
          expense, action, performedBy, performedByName, notes,
        ).catch(console.warn);
        onActioned();
      }
    } catch {
      Alert.alert('Error', 'Ocurrió un error inesperado.');
    } finally {
      setProcessing(false);
    }
  }

  function handleApprove() {
    Alert.alert(
      isSubmitted ? 'Aprobar gasto' : 'Marcar como pagado',
      `¿Confirmas la acción sobre "${expense.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: isSubmitted ? 'Aprobar' : 'Marcar pagado',
          style: 'default',
          onPress: () => act(isSubmitted ? 'approved' : 'paid'),
        },
      ]
    );
  }

  function handleRejectToggle() {
    setShowReject((v) => {
      if (!v) setTimeout(() => rejectInputRef.current?.focus(), 100);
      return !v;
    });
    setRejectNotes('');
  }

  function handleRejectConfirm() {
    if (!rejectNotes.trim()) {
      Alert.alert('Nota requerida', 'Escribe el motivo del rechazo antes de continuar.');
      return;
    }
    Alert.alert(
      'Rechazar gasto',
      `¿Rechazas "${expense.title}"?\n\nMotivo: ${rejectNotes.trim()}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: () => act('rejected', rejectNotes),
        },
      ]
    );
  }

  return (
    <Card style={ap.card}>
      {/* Header: colour dot + category + amount */}
      <View style={ap.cardHeader}>
        <View style={ap.headerLeft}>
          <View style={[ap.dot, { backgroundColor: dotColor }]} />
          <Text style={[ap.categoryText, { color: colors.icon }]}>
            {expense.category_name}
          </Text>
          {expense.disciplina && (
            <View style={[ap.tag, { backgroundColor: PRIMARY + '15' }]}>
              <Text style={[ap.tagText, { color: PRIMARY }]}>{expense.disciplina}</Text>
            </View>
          )}
        </View>
        <Text style={[ap.amount, { color: colors.text }]}>{fmt(expense.amount)}</Text>
      </View>

      {/* Title */}
      <Text style={[ap.title, { color: colors.text }]} numberOfLines={2}>
        {expense.title}
      </Text>

      {/* Meta row: date + invoice */}
      <View style={ap.metaRow}>
        <Ionicons name="calendar-outline" size={12} color={colors.icon} />
        <Text style={[ap.metaText, { color: colors.icon }]}>
          {fmtDate(expense.expense_date)}
        </Text>
        {expense.invoice_number && (
          <>
            <Text style={[ap.metaDot, { color: colors.icon }]}>·</Text>
            <Text style={[ap.metaText, { color: colors.icon }]}>
              {expense.invoice_number}
            </Text>
          </>
        )}
      </View>

      {/* Supplier */}
      {expense.supplier_name && (
        <View style={ap.metaRow}>
          <Ionicons name="business-outline" size={12} color={colors.icon} />
          <Text style={[ap.metaText, { color: colors.icon }]} numberOfLines={1}>
            {expense.supplier_name}
          </Text>
        </View>
      )}

      {/* Description */}
      {expense.description && (
        <Text style={[ap.description, { color: colors.icon }]} numberOfLines={2}>
          {expense.description}
        </Text>
      )}

      {/* ── Action buttons ─────────────────────────────────────────────── */}
      {!showReject && (
        <View style={ap.actions}>
          {/* Reject */}
          <TouchableOpacity
            onPress={handleRejectToggle}
            disabled={processing}
            style={[ap.actionBtn, ap.rejectBtn]}
          >
            <Ionicons name="close-outline" size={16} color="#dc2626" />
            <Text style={[ap.actionBtnText, { color: '#dc2626' }]}>Rechazar</Text>
          </TouchableOpacity>

          {/* Approve / Mark paid */}
          <TouchableOpacity
            onPress={handleApprove}
            disabled={processing}
            style={[
              ap.actionBtn,
              isSubmitted ? ap.approveBtn : ap.payBtn,
              processing && ap.disabledBtn,
            ]}
          >
            {processing ? (
              <Text style={ap.primaryBtnText}>Procesando…</Text>
            ) : isSubmitted ? (
              <>
                <Ionicons name="checkmark-outline" size={16} color="#fff" />
                <Text style={ap.primaryBtnText}>Aprobar</Text>
              </>
            ) : (
              <>
                <Ionicons name="cash-outline" size={16} color="#fff" />
                <Text style={ap.primaryBtnText}>Marcar pagado</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Rejection notes (inline) ───────────────────────────────────── */}
      {showReject && (
        <View style={ap.rejectPanel}>
          <Text style={[ap.rejectLabel, { color: colors.text }]}>
            Motivo del rechazo{' '}
            <Text style={{ color: '#dc2626' }}>*</Text>
          </Text>
          <TextInput
            ref={rejectInputRef}
            style={[ap.rejectInput, {
              color: colors.text,
              borderColor: scheme === 'dark' ? '#374151' : '#e2e8f0',
              backgroundColor: scheme === 'dark' ? '#1e2022' : '#f8fafc',
            }]}
            placeholder="Describe el motivo del rechazo…"
            placeholderTextColor={colors.icon}
            value={rejectNotes}
            onChangeText={setRejectNotes}
            multiline
            numberOfLines={3}
          />
          <View style={ap.rejectActions}>
            <TouchableOpacity
              onPress={handleRejectToggle}
              style={ap.cancelRejectBtn}
              disabled={processing}
            >
              <Text style={[ap.cancelRejectText, { color: colors.icon }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRejectConfirm}
              disabled={processing || !rejectNotes.trim()}
              style={[
                ap.confirmRejectBtn,
                (!rejectNotes.trim() || processing) && ap.disabledBtn,
              ]}
            >
              <Text style={ap.confirmRejectText}>
                {processing ? 'Procesando…' : 'Confirmar rechazo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

type Tab = 'submitted' | 'approved';

export default function ApprovalsScreen() {
  const scheme  = useColorScheme() ?? 'light';
  const colors  = Colors[scheme];

  const hasPermission  = useAuthStore((s) => s.permissions.has('approve_finances'));
  const profileId      = useAuthStore((s) => s.profile?.id ?? '');
  const performerName  = useAuthStore((s) => {
    const p = s.profile;
    return p ? `${p.first_name} ${p.last_name}`.trim() : 'Desconocido';
  });

  const [activeTab,   setActiveTab]   = useState<Tab>('submitted');
  const [expenses,    setExpenses]    = useState<ExpenseForApproval[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listExpensesForApproval(activeTab);
      setExpenses(data);
    } catch (e) {
      setError('No se pudo cargar la lista. Verifica tu conexión.');
      console.warn('[approvals] load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!hasPermission) { setLoading(false); return; }
    setLoading(true);
    load();
  }, [load, hasPermission]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleActioned = () => {
    // Remove the actioned expense optimistically and refresh in background
    load();
  };

  // ── Permission guard ────────────────────────────────────────────────────
  if (!hasPermission) return <AccessDenied />;
  if (loading) return <Loading fullScreen />;

  const submittedLabel = `Por aprobar${activeTab === 'submitted' && expenses.length > 0 ? ` (${expenses.length})` : ''}`;
  const approvedLabel  = `Aprobados${activeTab === 'approved'  && expenses.length > 0 ? ` (${expenses.length})` : ''}`;

  return (
    <SafeAreaView style={[ap.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* ── Tab pills ────────────────────────────────────────────────────── */}
      <View style={[ap.tabBar, { backgroundColor: colors.background, borderBottomColor: scheme === 'dark' ? '#1e2022' : '#e2e8f0' }]}>
        {([['submitted', submittedLabel], ['approved', approvedLabel]] as [Tab, string][]).map(
          ([tab, label]) => (
            <TouchableOpacity
              key={tab}
              onPress={() => { setActiveTab(tab); setLoading(true); }}
              style={[
                ap.tabPill,
                activeTab === tab && { backgroundColor: PRIMARY },
              ]}
            >
              <Text
                style={[
                  ap.tabPillText,
                  { color: activeTab === tab ? '#fff' : colors.icon },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <View style={ap.errorBanner}>
          <Ionicons name="wifi-outline" size={16} color="#dc2626" />
          <Text style={ap.errorText} numberOfLines={2}>{error}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }}>
            <Text style={[ap.retryText, { color: PRIMARY }]}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── List ─────────────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={ap.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {expenses.length === 0 ? (
          <EmptyView
            title={activeTab === 'submitted' ? 'Sin gastos pendientes' : 'Sin gastos aprobados'}
            subtitle={
              activeTab === 'submitted'
                ? 'Todos los gastos están al día. Jala para actualizar.'
                : 'No hay gastos aprobados esperando pago. Jala para actualizar.'
            }
          />
        ) : (
          expenses.map((e, i) => (
            <ExpenseCard
              key={e.id}
              expense={e}
              performedBy={profileId}
              performedByName={performerName}
              colorIndex={i}
              onActioned={handleActioned}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ap = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },

  // Tab bar
  tabBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  tabPillText: { fontSize: 13, fontWeight: '600' },

  // Error banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, padding: 12, borderRadius: 10, backgroundColor: '#fee2e2',
  },
  errorText: { flex: 1, fontSize: 13, color: '#dc2626' },
  retryText: { fontSize: 13, fontWeight: '600' },

  // Expense card
  card: { marginBottom: 12 },

  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 6,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6, flexWrap: 'wrap' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  categoryText: { fontSize: 12 },
  tag: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  tagText: { fontSize: 10, fontWeight: '600' },
  amount: { fontSize: 18, fontWeight: '800', marginLeft: 8 },

  title: { fontSize: 15, fontWeight: '600', marginBottom: 8, lineHeight: 20 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  metaText: { fontSize: 12 },
  metaDot: { fontSize: 12 },

  description: { fontSize: 12, lineHeight: 17, fontStyle: 'italic', marginTop: 4 },

  // Action buttons
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10,
  },
  rejectBtn:  { backgroundColor: '#fee2e2' },
  approveBtn: { backgroundColor: '#16a34a' },
  payBtn:     { backgroundColor: '#1d4ed8' },
  disabledBtn: { opacity: 0.5 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  primaryBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Rejection notes panel
  rejectPanel: { marginTop: 12 },
  rejectLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  rejectInput: {
    borderWidth: 1, borderRadius: 10,
    padding: 12, fontSize: 13, minHeight: 72, textAlignVertical: 'top',
  },
  rejectActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8,
  },
  cancelRejectBtn: { paddingHorizontal: 14, paddingVertical: 9 },
  cancelRejectText: { fontSize: 13 },
  confirmRejectBtn: {
    backgroundColor: '#dc2626', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
  },
  confirmRejectText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Access denied
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  accessTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  accessSub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

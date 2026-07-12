/**
 * components/finance/ApprovalsSection.tsx
 *
 * Collapsible "Gastos por Autorizar" panel embedded at the top of the
 * Finanzas screen.
 *
 * - Returns null when the user lacks `approve_finances` permission.
 * - Returns null when there are no expenses in 'submitted' or 'approved' status.
 * - Renders a tappable header that expands/collapses the full approvals UI.
 * - Supports sub-tabs "Por aprobar" (submitted) and "Aprobados" (approved).
 * - Disappears automatically once all expenses are actioned.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, useColorScheme,
  TouchableOpacity, TextInput, Alert,
  Platform, UIManager, LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/store';
import {
  listExpensesForApproval,
  processExpenseApproval,
  notifyFinanceApprovers,
  type ExpenseForApproval,
  type ApprovalAction,
} from '@/services/finance-approvals';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

const PIE_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899',
  '#8b5cf6', '#14b8a6', '#ef4444', '#f97316', '#6b7280',
];

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
// ExpenseCard — inline action card
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

  const [processing,  setProcessing]  = useState(false);
  const [showReject,  setShowReject]  = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const rejectInputRef = useRef<TextInput>(null);

  const dotColor    = expense.category_color ?? PIE_COLORS[colorIndex % PIE_COLORS.length];
  const isSubmitted = expense.status === 'submitted';

  async function act(action: ApprovalAction, notes?: string) {
    setProcessing(true);
    try {
      const { error } = await processExpenseApproval(expense.id, action, performedBy, notes);
      if (error) {
        Alert.alert('Error', `No se pudo procesar: ${error}`);
      } else {
        setShowReject(false);
        setRejectNotes('');
        notifyFinanceApprovers(expense, action, performedBy, performedByName, notes).catch(console.warn);
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
        { text: 'Rechazar', style: 'destructive', onPress: () => act('rejected', rejectNotes) },
      ]
    );
  }

  return (
    <Card style={sc.card}>
      {/* Header: colour dot + category + amount */}
      <View style={sc.cardHeader}>
        <View style={sc.headerLeft}>
          <View style={[sc.dot, { backgroundColor: dotColor }]} />
          <Text style={[sc.categoryText, { color: colors.icon }]}>{expense.category_name}</Text>
          {expense.disciplina && (
            <View style={[sc.tag, { backgroundColor: PRIMARY + '15' }]}>
              <Text style={[sc.tagText, { color: PRIMARY }]}>{expense.disciplina}</Text>
            </View>
          )}
        </View>
        <Text style={[sc.amount, { color: colors.text }]}>{fmt(expense.amount)}</Text>
      </View>

      <Text style={[sc.title, { color: colors.text }]} numberOfLines={2}>{expense.title}</Text>

      <View style={sc.metaRow}>
        <Ionicons name="calendar-outline" size={12} color={colors.icon} />
        <Text style={[sc.metaText, { color: colors.icon }]}>{fmtDate(expense.expense_date)}</Text>
        {expense.invoice_number && (
          <>
            <Text style={[sc.metaDot, { color: colors.icon }]}>·</Text>
            <Text style={[sc.metaText, { color: colors.icon }]}>{expense.invoice_number}</Text>
          </>
        )}
      </View>

      {expense.supplier_name && (
        <View style={sc.metaRow}>
          <Ionicons name="business-outline" size={12} color={colors.icon} />
          <Text style={[sc.metaText, { color: colors.icon }]} numberOfLines={1}>{expense.supplier_name}</Text>
        </View>
      )}

      {expense.description && (
        <Text style={[sc.description, { color: colors.icon }]} numberOfLines={2}>{expense.description}</Text>
      )}

      {/* Action buttons */}
      {!showReject && (
        <View style={sc.actions}>
          <TouchableOpacity onPress={handleRejectToggle} disabled={processing} style={[sc.actionBtn, sc.rejectBtn]}>
            <Ionicons name="close-outline" size={16} color="#dc2626" />
            <Text style={[sc.actionBtnText, { color: '#dc2626' }]}>Rechazar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleApprove}
            disabled={processing}
            style={[sc.actionBtn, isSubmitted ? sc.approveBtn : sc.payBtn, processing && sc.disabledBtn]}
          >
            {processing ? (
              <Text style={sc.primaryBtnText}>Procesando…</Text>
            ) : isSubmitted ? (
              <>
                <Ionicons name="checkmark-outline" size={16} color="#fff" />
                <Text style={sc.primaryBtnText}>Aprobar</Text>
              </>
            ) : (
              <>
                <Ionicons name="cash-outline" size={16} color="#fff" />
                <Text style={sc.primaryBtnText}>Marcar pagado</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Rejection panel */}
      {showReject && (
        <View style={sc.rejectPanel}>
          <Text style={[sc.rejectLabel, { color: colors.text }]}>
            Motivo del rechazo <Text style={{ color: '#dc2626' }}>*</Text>
          </Text>
          <TextInput
            ref={rejectInputRef}
            style={[sc.rejectInput, {
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
          <View style={sc.rejectActions}>
            <TouchableOpacity onPress={handleRejectToggle} style={sc.cancelRejectBtn} disabled={processing}>
              <Text style={[sc.cancelRejectText, { color: colors.icon }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRejectConfirm}
              disabled={processing || !rejectNotes.trim()}
              style={[sc.confirmRejectBtn, (!rejectNotes.trim() || processing) && sc.disabledBtn]}
            >
              <Text style={sc.confirmRejectText}>{processing ? 'Procesando…' : 'Confirmar rechazo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type ApprovalsTab = 'submitted' | 'approved';

export default function ApprovalsSection() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const hasPermission  = useAuthStore((s) => s.permissions.has('approve_finances'));
  const profileId      = useAuthStore((s) => s.profile?.id ?? '');
  const performerName  = useAuthStore((s) => {
    const p = s.profile;
    return p ? `${p.first_name} ${p.last_name}`.trim() : 'Desconocido';
  });

  const [open,               setOpen]               = useState(false);
  const [activeTab,          setActiveTab]           = useState<ApprovalsTab>('submitted');
  const [submittedExpenses,  setSubmittedExpenses]  = useState<ExpenseForApproval[]>([]);
  const [approvedExpenses,   setApprovedExpenses]   = useState<ExpenseForApproval[]>([]);
  const [initialLoading,     setInitialLoading]     = useState(true);

  const reload = useCallback(async () => {
    const [sub, appr] = await Promise.all([
      listExpensesForApproval('submitted'),
      listExpensesForApproval('approved'),
    ]);
    setSubmittedExpenses(sub);
    setApprovedExpenses(appr);
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    if (!hasPermission) { setInitialLoading(false); return; }
    reload();
  }, [reload, hasPermission]);

  // ── All hooks above this line ──────────────────────────────────────────
  if (!hasPermission || initialLoading) return null;

  const totalCount = submittedExpenses.length + approvedExpenses.length;
  if (totalCount === 0) return null;

  const currentExpenses = activeTab === 'submitted' ? submittedExpenses : approvedExpenses;

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  }

  function handleActioned() { reload(); }

  const submittedLabel = `Por aprobar${submittedExpenses.length > 0 ? ` (${submittedExpenses.length})` : ''}`;
  const approvedLabel  = `Aprobados${approvedExpenses.length > 0 ? ` (${approvedExpenses.length})` : ''}`;

  return (
    <View style={[sc.wrapper, { borderColor: '#d97706' + '40', backgroundColor: scheme === 'dark' ? '#1a1200' : '#fffbeb' }]}>

      {/* ── Collapsible header ─────────────────────────────────────────── */}
      <TouchableOpacity onPress={toggle} style={sc.header} activeOpacity={0.8}>
        <View style={sc.headerLeft}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#d97706" />
          <Text style={[sc.headerTitle, { color: colors.text }]}>Gastos por Autorizar</Text>
          <View style={sc.badge}>
            <Text style={sc.badgeText}>{totalCount}</Text>
          </View>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.icon} />
      </TouchableOpacity>

      {/* ── Expanded content ──────────────────────────────────────────── */}
      {open && (
        <View style={sc.content}>
          {/* Sub-tabs */}
          <View style={[sc.tabBar, { borderBottomColor: scheme === 'dark' ? '#1e2022' : '#e2e8f0' }]}>
            {([['submitted', submittedLabel], ['approved', approvedLabel]] as [ApprovalsTab, string][]).map(
              ([tab, label]) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[sc.tabPill, activeTab === tab && { backgroundColor: PRIMARY }]}
                >
                  <Text style={[sc.tabPillText, { color: activeTab === tab ? '#fff' : colors.icon }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>

          {/* Expense cards */}
          {currentExpenses.length === 0 ? (
            <Text style={[sc.emptyText, { color: colors.icon }]}>
              {activeTab === 'submitted'
                ? 'Sin gastos pendientes de aprobación.'
                : 'Sin gastos aprobados esperando pago.'}
            </Text>
          ) : (
            currentExpenses.map((e, i) => (
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
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sc = StyleSheet.create({
  wrapper: {
    borderWidth: 1.5, borderRadius: 14,
    marginBottom: 20, overflow: 'hidden',
  },

  // Header row
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 14, fontWeight: '700' },
  badge: {
    backgroundColor: '#d97706', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2, minWidth: 22, alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Expanded area
  content: { paddingHorizontal: 12, paddingBottom: 12 },

  // Sub-tabs
  tabBar: {
    flexDirection: 'row', gap: 8, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 10,
  },
  tabPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#e2e8f0',
  },
  tabPillText: { fontSize: 13, fontWeight: '600' },

  emptyText: { textAlign: 'center', fontSize: 13, fontStyle: 'italic', paddingVertical: 12 },

  // Expense card
  card: { marginBottom: 10 },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 6,
  },
  headerLeft2: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6, flexWrap: 'wrap' },
  dot:          { width: 10, height: 10, borderRadius: 5 },
  categoryText: { fontSize: 12 },
  tag:          { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText:      { fontSize: 10, fontWeight: '600' },
  amount:       { fontSize: 18, fontWeight: '800', marginLeft: 8 },
  title:        { fontSize: 15, fontWeight: '600', marginBottom: 8, lineHeight: 20 },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  metaText:     { fontSize: 12 },
  metaDot:      { fontSize: 12 },
  description:  { fontSize: 12, lineHeight: 17, fontStyle: 'italic', marginTop: 4 },

  // Action buttons
  actions:    { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn:  {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10,
  },
  rejectBtn:     { backgroundColor: '#fee2e2' },
  approveBtn:    { backgroundColor: '#16a34a' },
  payBtn:        { backgroundColor: '#1d4ed8' },
  disabledBtn:   { opacity: 0.5 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  primaryBtnText:{ fontSize: 13, fontWeight: '700', color: '#fff' },

  // Rejection panel
  rejectPanel:  { marginTop: 12 },
  rejectLabel:  { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  rejectInput:  {
    borderWidth: 1, borderRadius: 10,
    padding: 12, fontSize: 13, minHeight: 72, textAlignVertical: 'top',
  },
  rejectActions:    { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  cancelRejectBtn:  { paddingHorizontal: 14, paddingVertical: 9 },
  cancelRejectText: { fontSize: 13 },
  confirmRejectBtn: {
    backgroundColor: '#dc2626', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
  },
  confirmRejectText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

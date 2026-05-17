'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  createPayrollEntry, updatePayrollEntry, deletePayrollEntry, submitPayrollEntry,
  type PayrollEntry, type PayrollStaff,
} from '@/lib/finance/payroll-actions';
import { ExpenseStatusBadge } from '@/components/finances/expense-status-badge';
import type { ExpenseStatus } from '@/lib/types/finance';

const fmt = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

const ROLE_LABEL: Record<string, string> = {
  coach: 'Entrenador', staff: 'Staff', physio: 'Fisioterapeuta',
  nutritionist: 'Nutricionista', psychologist: 'Psicólogo',
  medic: 'Médico', program_director: 'Director de Programa',
  admin: 'Admin', super_admin: 'Super Admin', finance_admin: 'Admin Financiero',
};

// ─── Form ─────────────────────────────────────────────────────────────────────
function PayrollForm({
  staff, entry, onSuccess, onCancel,
}: {
  staff: PayrollStaff[];
  entry?: PayrollEntry;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('finances.payroll');
  const tApproval = useTranslations('finances.approval');
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [sendForReview, setSendForReview] = useState(false);
  const isEditing = !!entry;

  const today = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().split('T')[0];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (!isEditing) fd.set('send_to_review', sendForReview ? 'true' : 'false');

    startTransition(async () => {
      const res = isEditing
        ? await updatePayrollEntry(entry.id, fd)
        : await createPayrollEntry(fd);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        formRef.current?.reset();
        setSendForReview(false);
        setTimeout(() => { setSuccess(false); onSuccess?.(); }, 800);
      }
    });
  }

  const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500';

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error   && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
        {sendForReview && !isEditing ? t('form.createdAndSent') : t('form.savedSuccess')}
      </div>}

      {!isEditing && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('form.staffLabel')} <span className="text-red-500">*</span>
          </label>
          <select name="profile_id" required className={inputClass}>
            <option value="">{t('form.selectPerson')}</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
                {s.roles[0] ? ` — ${ROLE_LABEL[s.roles[0].code] ?? s.roles[0].name}` : ''}
              </option>
            ))}
          </select>
          {staff.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">{t('form.noStaff')}</p>
          )}
        </div>
      )}
      {isEditing && (
        <div className="rounded-md bg-violet-50 border border-violet-200 p-3">
          <p className="text-sm font-semibold text-violet-900">
            {entry.profile?.first_name} {entry.profile?.last_name}
          </p>
          <p className="text-xs text-violet-600">{entry.profile?.role ?? '—'}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('form.periodLabel')} <span className="text-red-500">*</span>
        </label>
        <input name="period_label" type="text" required defaultValue={entry?.period_label}
          placeholder={t('form.periodPlaceholder')} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('form.startDateLabel')} <span className="text-red-500">*</span>
          </label>
          <input name="period_start" type="date" required
            defaultValue={entry?.period_start ?? firstOfMonth} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('form.endDateLabel')} <span className="text-red-500">*</span>
          </label>
          <input name="period_end" type="date" required
            defaultValue={entry?.period_end ?? lastOfMonth} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('form.grossAmountLabel')} <span className="text-red-500">*</span>
        </label>
        <input name="gross_amount" type="number" required min={0.01} step="0.01"
          defaultValue={entry?.gross_amount} placeholder="0.00" className={inputClass} />
        <p className="text-xs text-gray-400 mt-1">{t('form.grossAmountHint')}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.notesLabel')}</label>
        <textarea name="notes" rows={2} defaultValue={entry?.notes ?? ''}
          placeholder={t('form.notesPlaceholder')} className={inputClass} />
      </div>

      {!isEditing && (
        <div
          className={`rounded-lg border-2 p-4 cursor-pointer transition-colors ${
            sendForReview ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => setSendForReview(v => !v)}
        >
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendForReview}
              onChange={e => { e.stopPropagation(); setSendForReview(e.target.checked); }}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-400"
            />
            <div>
              <span className="text-sm font-semibold text-gray-800">{t('form.sendForAuthLabel')}</span>
              <p className="text-xs text-gray-500 mt-0.5">{t('form.sendForAuthHint')}</p>
            </div>
          </label>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            {tApproval('cancel')}
          </button>
        )}
        <button type="submit" disabled={isPending}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${
            sendForReview && !isEditing ? 'bg-violet-600 hover:bg-violet-700' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}>
          {isPending
            ? t('form.saving')
            : isEditing
              ? t('form.edit')
              : sendForReview
                ? t('form.createAndSend')
                : t('form.create')
          }
        </button>
      </div>
    </form>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────
function PayrollRow({ entry, staff, canManage }: {
  entry: PayrollEntry;
  staff: PayrollStaff[];
  canManage: boolean;
}) {
  const t = useTranslations('finances.payroll');
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(t('deleteConfirm', { name: `${entry.profile?.first_name} ${entry.profile?.last_name}` }))) return;
    startTransition(async () => {
      const res = await deletePayrollEntry(entry.id);
      if (res.error) setError(res.error);
    });
  }

  function handleSubmit() {
    if (!confirm(t('submitConfirm', { name: `${entry.profile?.first_name} ${entry.profile?.last_name}` }))) return;
    startTransition(async () => {
      const res = await submitPayrollEntry(entry.id);
      if (res.error) setError(res.error);
    });
  }

  const canEdit   = canManage && entry.status === 'draft';
  const canDelete = canManage && entry.status === 'draft';
  const canSubmit = canManage && entry.status === 'draft';
  const displayStatus = (entry.expense?.status ?? entry.status) as ExpenseStatus;

  if (mode === 'edit') {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-4 bg-violet-50 border-b border-violet-100">
          <PayrollForm
            staff={staff}
            entry={entry}
            onSuccess={() => setMode('view')}
            onCancel={() => setMode('view')}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">
          {entry.profile?.first_name} {entry.profile?.last_name}
        </p>
        {entry.profile?.role && (
          <p className="text-xs text-gray-400">{ROLE_LABEL[entry.profile.role] ?? entry.profile.role}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-gray-700">{entry.period_label}</p>
        <p className="text-xs text-gray-400">{entry.period_start} → {entry.period_end}</p>
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
        {fmt(entry.gross_amount)}
      </td>
      <td className="px-4 py-3">
        <ExpenseStatusBadge status={displayStatus} />
      </td>
      <td className="px-4 py-3 text-xs">
        {entry.expense_id ? (
          <span className="text-indigo-600 font-mono">{entry.expense_id.slice(0, 8)}…</span>
        ) : (
          <span className="text-gray-400 italic">{t('noExpenseLinked')}</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px] truncate">
        {entry.notes ?? '—'}
      </td>
      <td className="px-4 py-3">
        {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
        <div className="flex justify-end gap-1 flex-wrap">
          {canSubmit && (
            <button onClick={handleSubmit} disabled={isPending}
              className="px-2.5 py-1 text-xs font-medium bg-violet-100 text-violet-700 rounded hover:bg-violet-200 disabled:opacity-50">
              {t('authorizeBtn')}
            </button>
          )}
          {canEdit && (
            <button onClick={() => setMode('edit')} disabled={isPending}
              className="px-2.5 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 disabled:opacity-50">
              {t('editBtn')}
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} disabled={isPending}
              className="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50">
              {isPending ? '…' : t('deleteBtn')}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PayrollClient({
  entries,
  staff,
  canManage,
  summary,
}: {
  entries: PayrollEntry[];
  staff: PayrollStaff[];
  canManage: boolean;
  summary: { total_payroll: number; count: number; pending: number; pendingAmount: number };
}) {
  const t = useTranslations('finances.payroll');
  const tStatus = useTranslations('finances.status');
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const filtered = filterStatus
    ? entries.filter(e => (e.expense?.status ?? e.status) === filterStatus)
    : entries;

  const fmtShort = (v: number) =>
    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` :
    v >= 1_000 ? `$${(v / 1_000).toFixed(0)}K` : fmt(v);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-medium text-violet-700">{t('kpiTotal')}</p>
          <p className="text-xl font-bold text-violet-900">{fmtShort(summary.total_payroll)}</p>
          <p className="text-xs text-violet-500">{t('records', { count: summary.count })}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700">{t('kpiPending')}</p>
          <p className="text-xl font-bold text-amber-900">{summary.pending}</p>
          <p className="text-xs text-amber-500">{fmtShort(summary.pendingAmount)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">{t('kpiRegistered')}</p>
          <p className="text-xl font-bold text-gray-900">
            {new Set(entries.map(e => e.profile_id)).size}
          </p>
          <p className="text-xs text-gray-400">{t('kpiUniqueProfiles')}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">{t('kpiAverage')}</p>
          <p className="text-xl font-bold text-gray-900">
            {summary.count > 0 ? fmtShort(summary.total_payroll / summary.count) : '$0'}
          </p>
          <p className="text-xs text-gray-400">{t('kpiPerRecord')}</p>
        </div>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-500">{t('filterLabel')}</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
          >
            <option value="">{t('filterAll', { count: entries.length })}</option>
            <option value="draft">{tStatus('draft')}</option>
            <option value="submitted">{tStatus('submitted')}</option>
            <option value="approved">{tStatus('approved')}</option>
            <option value="paid">{tStatus('paid')}</option>
            <option value="cancelled">{tStatus('cancelled')}</option>
          </select>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(!showForm)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              showForm ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-violet-600 text-white hover:bg-violet-700'
            }`}
          >
            {showForm ? t('cancelNewPayroll') : t('newPayrollBtn')}
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border border-violet-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-violet-800 mb-4">{t('registerTitle')}</h3>
          <PayrollForm
            staff={staff}
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
          <p className="text-gray-500 text-sm">
            {filterStatus ? t('noPayrollFiltered') : t('noPayroll')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colStaff')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colPeriod')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colAmount')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colStatus')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colExpenseId')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colNotes')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map(e => (
                <PayrollRow key={e.id} entry={e} staff={staff} canManage={canManage} />
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-gray-700 text-right">{t('total')}</td>
                <td className="px-4 py-2 text-sm font-bold text-gray-900 text-right">
                  {fmt(filtered.reduce((s, e) => s + e.gross_amount, 0))}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Flow info */}
      <div className="rounded-md bg-violet-50 border border-violet-200 p-4 text-xs text-violet-700 space-y-1">
        <p className="font-semibold">{t('flowTitle')}</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li dangerouslySetInnerHTML={{ __html: t('flowStep1', {
            draft: `<strong>${tStatus('draft')}</strong>`,
            category: 'Nóminas'
          })}} />
          <li dangerouslySetInnerHTML={{ __html: t('flowStep2', {
            underReview: `<strong>${tStatus('submitted')}</strong>`
          })}} />
          <li dangerouslySetInnerHTML={{ __html: t('flowStep3', {
            approved: `<strong>${tStatus('approved')}</strong>`
          })}} />
          <li dangerouslySetInnerHTML={{ __html: t('flowStep4', {
            paid: `<strong>${tStatus('paid')}</strong>`
          })}} />
        </ol>
      </div>
    </div>
  );
}

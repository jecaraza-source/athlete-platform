'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { deleteExpense, updateExpense, submitExpense, processApproval,
  listFinanceAttachments, uploadFinanceAttachment, deleteFinanceAttachment,
  getFinanceAttachmentSignedUrl } from '@/lib/finance/actions';
import { ExpenseStatusBadge } from '@/components/finances/expense-status-badge';
import { ExpenseForm } from '@/components/finances/expense-form';
import { InlineAttachments } from '@/components/finances/inline-attachments';
import type {
  FinanceExpense,
  FinanceExpenseCategory,
  FinanceSupplier,
  FinanceBudgetItem,
} from '@/lib/types/finance';

type Athlete = { id: string; first_name: string; last_name: string };

const fmt = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Partial edit form ─────────────────────────────────────────────────────────
function PartialEditForm({ expense, onSuccess, onCancel }: {
  expense: FinanceExpense; onSuccess: () => void; onCancel: () => void;
}) {
  const t = useTranslations('finances.expenses');
  const tApproval = useTranslations('finances.approval');
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputClass = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateExpense(expense.id, new FormData(e.currentTarget));
      if (res.error) setError(res.error);
      else onSuccess();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
        {t('partialEditWarning', { status: expense.status })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('titleFieldLabel')}</label>
          <input name="title" required defaultValue={expense.title} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('invoiceLabel')}</label>
          <input name="invoice_number" defaultValue={expense.invoice_number ?? ''} className={inputClass} placeholder="FAC-0001" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('descLabel')}</label>
          <textarea name="description" rows={2} defaultValue={expense.description ?? ''} className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('internalNotesLabel')}</label>
          <textarea name="notes" rows={2} defaultValue={expense.notes ?? ''} className={inputClass} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">
          {tApproval('cancel')}
        </button>
        <button type="submit" disabled={isPending}
          className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
          {isPending ? t('form.saving') : t('form.edit')}
        </button>
      </div>
    </form>
  );
}

// ── Approval actions in table row ─────────────────────────────────────────────
function ApprovalActions({
  expense, canApprove, canManage,
}: { expense: FinanceExpense; canApprove: boolean; canManage: boolean }) {
  const t = useTranslations('finances.expenses');
  const tApproval = useTranslations('finances.approval');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const LABEL: Record<string, string> = {
    submitted: t('actionSubmit'),
    approved:  t('actionApprove'),
    rejected:  t('actionReject'),
    paid:      t('actionMarkPaid'),
    cancelled: t('actionCancel'),
  };
  const COLOR: Record<string, string> = {
    submitted: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
    approved:  'bg-green-100 text-green-800 hover:bg-green-200',
    rejected:  'bg-red-100 text-red-800 hover:bg-red-200',
    paid:      'bg-blue-100 text-blue-800 hover:bg-blue-200',
    cancelled: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  };

  const available: string[] = [];
  if (canManage && expense.status === 'draft') available.push('submitted');
  if (canApprove && expense.status === 'submitted') available.push('approved', 'rejected');
  if (canApprove && expense.status === 'approved') available.push('paid', 'rejected');
  if (canManage && ['draft','submitted','approved','rejected'].includes(expense.status)) available.push('cancelled');

  function run(action: string) {
    setError(null);
    startTransition(async () => {
      const res = action === 'submitted'
        ? await submitExpense(expense.id)
        : await processApproval({ expense_id: expense.id, action: action as 'approved'|'rejected'|'paid'|'cancelled', notes: notes || undefined });
      if (res.error) setError(res.error);
      else { setConfirmAction(null); setNotes(''); }
    });
  }

  if (available.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-1.5">
        {available.map(a => (
          <button key={a} type="button" disabled={isPending}
            onClick={() => a === 'submitted' ? run(a) : setConfirmAction(a)}
            className={`px-2.5 py-1 text-xs font-medium rounded disabled:opacity-50 ${COLOR[a]}`}>
            {LABEL[a]}
          </button>
        ))}
      </div>
      {confirmAction && (
        <div className="bg-gray-50 rounded p-3 space-y-2 border border-gray-200">
          <p className="text-xs font-medium text-gray-700">
            {t('actionNotePrompt', { action: LABEL[confirmAction] })}
          </p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none"
            placeholder={t('notePlaceholder')} />
          <div className="flex gap-2">
            <button type="button" disabled={isPending} onClick={() => run(confirmAction)}
              className={`px-3 py-1 text-xs font-medium rounded disabled:opacity-50 ${COLOR[confirmAction]}`}>
              {isPending ? tApproval('processing') : t('confirmBtn')}
            </button>
            <button type="button" onClick={() => { setConfirmAction(null); setNotes(''); }}
              className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
              {tApproval('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single expense row ─────────────────────────────────────────────────────────
function ExpenseRow({
  expense, categories, suppliers, athletes, canManage, canApprove,
}: {
  expense: FinanceExpense;
  categories: FinanceExpenseCategory[];
  suppliers: FinanceSupplier[];
  athletes: Athlete[];
  canManage: boolean;
  canApprove: boolean;
}) {
  const t = useTranslations('finances.expenses');
  const tApproval = useTranslations('finances.approval');
  const [mode, setMode] = useState<'collapsed' | 'view' | 'edit'>('collapsed');
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEdit   = canManage;
  const isFullEdit = ['draft', 'rejected'].includes(expense.status);
  const canDelete = canManage && ['draft', 'cancelled'].includes(expense.status);

  function handleDelete() {
    if (!confirm(t('deleteConfirm', { title: expense.title }))) return;
    startTransition(async () => {
      const res = await deleteExpense(expense.id);
      if (res.error) setDeleteError(res.error);
    });
  }

  return (
    <>
      <tr className={`transition-colors ${mode !== 'collapsed' ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{expense.title}</p>
          {expense.invoice_number && (
            <p className="text-xs text-gray-400">{expense.invoice_number}</p>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">
          {expense.category ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: expense.category.color ?? '#9ca3af' }} />
              {expense.category.name}
            </span>
          ) : '—'}
        </td>
        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{fmt(expense.amount)}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(expense.expense_date)}</td>
        <td className="px-4 py-3"><ExpenseStatusBadge status={expense.status} /></td>
        <td className="px-4 py-3">
          {deleteError && <p className="text-xs text-red-500 mb-1">{deleteError}</p>}
          <div className="flex justify-end gap-1 flex-wrap">
            <button
              onClick={() => setMode(mode === 'view' ? 'collapsed' : 'view')}
              className={`px-2.5 py-1 text-xs rounded font-medium ${
                mode === 'view' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {mode === 'view' ? t('hideBtn') : t('viewBtn')}
            </button>
            {canEdit && (
              <button
                onClick={() => setMode(mode === 'edit' ? 'collapsed' : 'edit')}
                className={`px-2.5 py-1 text-xs rounded font-medium ${
                  mode === 'edit' ? 'bg-indigo-200 text-indigo-800' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                }`}>
                {mode === 'edit' ? t('closeEditBtn') : t('editBtn')}
              </button>
            )}
            {canDelete && (
              <button onClick={handleDelete} disabled={isPending}
                className="px-2.5 py-1 text-xs rounded font-medium bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50">
                {isPending ? '…' : t('deleteBtn')}
              </button>
            )}
          </div>
        </td>
      </tr>

      {mode === 'view' && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-indigo-50 border-b border-indigo-100">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-gray-500 font-medium">{t('supplier')}</p><p className="text-gray-800">{expense.supplier?.name ?? '—'}</p></div>
              <div><p className="text-xs text-gray-500 font-medium">{t('linkedAthlete')}</p>
                <p className="text-gray-800">
                  {expense.athlete ? `${expense.athlete.first_name} ${expense.athlete.last_name}` : '—'}
                </p>
              </div>
              <div><p className="text-xs text-gray-500 font-medium">{t('createdBy')}</p>
                <p className="text-gray-800">
                  {expense.creator ? `${expense.creator.first_name} ${expense.creator.last_name}` : '—'}
                </p>
              </div>
              {expense.description && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-gray-500 font-medium">{t('description')}</p>
                  <p className="text-gray-800">{expense.description}</p>
                </div>
              )}
              {expense.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-gray-500 font-medium">{t('notes')}</p>
                  <p className="text-gray-800">{expense.notes}</p>
                </div>
              )}
            </div>
            <ApprovalActions expense={expense} canApprove={canApprove} canManage={canManage} />
            <div className="mt-3 border-t border-indigo-100 pt-3">
              <InlineAttachments
                label={t('documentsLabel')}
                color="indigo"
                canManage={canManage}
                listFn={() => listFinanceAttachments(expense.id)}
                uploadFn={(fd) => uploadFinanceAttachment(expense.id, fd)}
                deleteFn={deleteFinanceAttachment}
                signedUrlFn={getFinanceAttachmentSignedUrl}
              />
            </div>
          </td>
        </tr>
      )}

      {mode === 'edit' && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-white border-b border-indigo-100">
            {isFullEdit ? (
              <ExpenseForm
                expense={expense}
                categories={categories}
                suppliers={suppliers}
                athletes={athletes}
                onSuccess={() => setMode('collapsed')}
                onCancel={() => setMode('collapsed')}
              />
            ) : (
              <PartialEditForm
                expense={expense}
                onSuccess={() => setMode('collapsed')}
                onCancel={() => setMode('collapsed')}
              />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function ExpensesTableClient({
  expenses, categories, suppliers, athletes, canManage, canApprove,
}: {
  expenses: FinanceExpense[];
  categories: FinanceExpenseCategory[];
  suppliers: FinanceSupplier[];
  athletes: Athlete[];
  canManage: boolean;
  canApprove: boolean;
}) {
  const t = useTranslations('finances.expenses');
  const tStatus = useTranslations('finances.status');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDisc, setFilterDisc] = useState('');
  const [search, setSearch] = useState('');

  const allDiscs = useMemo(() =>
    [...new Set(expenses.map(e => e.disciplina).filter(Boolean) as string[])].sort(),
    [expenses]
  );

  const filtered = useMemo(() => {
    let list = expenses;
    if (filterStatus)   list = list.filter(e => e.status === filterStatus);
    if (filterCategory) list = list.filter(e => e.category_id === filterCategory);
    if (filterDisc)     list = list.filter(e => e.disciplina === filterDisc);
    if (search)         list = list.filter(e =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.invoice_number ?? '').toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [expenses, filterStatus, filterCategory, filterDisc, search]);

  const hasFilters = !!(filterStatus || filterCategory || filterDisc || search);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end bg-gray-50 rounded-lg border border-gray-200 p-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('filterSearch')}</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('filterSearchPlaceholder')}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none w-40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('filterStatus')}</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none">
            <option value="">{t('filterAllStatuses')}</option>
            <option value="draft">{tStatus('draft')}</option>
            <option value="submitted">{tStatus('submitted')}</option>
            <option value="approved">{tStatus('approved')}</option>
            <option value="rejected">{tStatus('rejected')}</option>
            <option value="paid">{tStatus('paid')}</option>
            <option value="cancelled">{tStatus('cancelled')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('filterCategory')}</label>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none min-w-[140px]">
            <option value="">{t('filterAllCategories')}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {allDiscs.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('filterDiscipline')}</label>
            <select value={filterDisc} onChange={e => setFilterDisc(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none min-w-[140px]">
              <option value="">{t('filterAllDisciplines')}</option>
              {allDiscs.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-end gap-2 ml-auto">
          {hasFilters && (
            <button onClick={() => { setFilterStatus(''); setFilterCategory(''); setFilterDisc(''); setSearch(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 underline pb-2">
              {t('filterClear')}
            </button>
          )}
          <span className="text-xs text-gray-500 pb-2">
            {filtered.length} / {expenses.length} · <strong>{fmt(filtered.reduce((s, e) => s + e.amount, 0))}</strong>
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
          <p className="text-gray-500 text-sm">
            {hasFilters ? t('noExpensesFiltered') : t('noExpenses')}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colTitle')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colCategory')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colAmount')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colDate')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colStatus')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map(e => (
                <ExpenseRow
                  key={e.id}
                  expense={e}
                  categories={categories}
                  suppliers={suppliers}
                  athletes={athletes}
                  canManage={canManage}
                  canApprove={canApprove}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

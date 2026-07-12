'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createPayment, updatePayment, deletePayment, processApproval,
  listPaymentAttachments, uploadPaymentAttachment,
  deletePaymentAttachment, getPaymentAttachmentSignedUrl } from '@/lib/finance/actions';
import { InlineAttachments } from '@/components/finances/inline-attachments';
import type { FinancePayment, FinanceExpense, PaymentMethod } from '@/lib/types/finance';

const fmt = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

// ---------------------------------------------------------------------------
// New payment form
// ---------------------------------------------------------------------------
function NewPaymentForm({
  approvedExpenses,
  onSuccess,
  onCancel,
}: {
  approvedExpenses: FinanceExpense[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('finances.payments');
  const tApproval = useTranslations('finances.approval');
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedExpenseId, setSelectedExpenseId] = useState('');

  const METHOD_OPTIONS = [
    { value: 'transfer' as PaymentMethod, label: t('methodTransfer') },
    { value: 'check'    as PaymentMethod, label: t('methodCheck') },
    { value: 'cash'     as PaymentMethod, label: t('methodCash') },
    { value: 'card'     as PaymentMethod, label: t('methodCard') },
    { value: 'other'    as PaymentMethod, label: t('methodOther') },
  ];

  const selectedExpense = approvedExpenses.find(e => e.id === selectedExpenseId) ?? null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createPayment(fd);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        formRef.current?.reset();
        setSelectedExpenseId('');
        setTimeout(() => { setSuccess(false); onSuccess(); }, 1200);
      }
    });
  }

  const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500';

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {t('paymentRegistered')}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('expenseLabel')} <span className="text-red-500">*</span>
        </label>
        {approvedExpenses.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {t('noApprovedExpenses')}
          </div>
        ) : (
          <>
            <select
              name="expense_id"
              required
              value={selectedExpenseId}
              onChange={e => setSelectedExpenseId(e.target.value)}
              className={inputClass}
            >
              <option value="">{t('selectExpense')}</option>
              {approvedExpenses.map(e => (
                <option key={e.id} value={e.id}>
                  {e.title}
                  {e.disciplina ? ` [${e.disciplina}]` : ''}
                  {' — '}
                  {fmt(e.amount)}
                  {e.supplier ? ` · ${e.supplier.name}` : ''}
                </option>
              ))}
            </select>

            {selectedExpense && (
              <div className="mt-2 rounded-md bg-sky-50 border border-sky-200 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-sky-900">{selectedExpense.title}</p>
                  <span className="text-sm font-bold text-sky-700">{fmt(selectedExpense.amount)}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-sky-700">
                  {selectedExpense.disciplina && <span>📌 {selectedExpense.disciplina}</span>}
                  {selectedExpense.supplier && <span>🏢 {selectedExpense.supplier.name}</span>}
                  {selectedExpense.athlete && (
                    <span>🏃 {selectedExpense.athlete.first_name} {selectedExpense.athlete.last_name}</span>
                  )}
                  <span>📅 {fmtDate(selectedExpense.expense_date)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {approvedExpenses.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('amountLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                name="amount"
                type="number"
                required
                min={0.01}
                step="0.01"
                defaultValue={selectedExpense?.amount ?? ''}
                key={selectedExpense?.id ?? 'empty'}
                className={inputClass}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('paymentDateLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                name="payment_date"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('methodLabel')} <span className="text-red-500">*</span>
            </label>
            <select name="payment_method" required defaultValue="transfer" className={inputClass}>
              {METHOD_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('referenceLabel')}
              </label>
              <input name="reference" type="text" className={inputClass} placeholder={t('referencePlaceholder')} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('notesLabel')}</label>
              <input name="notes" type="text" className={inputClass} placeholder={t('notesPlaceholder')} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              {tApproval('cancel')}
            </button>
            <button type="submit" disabled={isPending || !selectedExpenseId}
              className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 disabled:opacity-50">
              {isPending ? t('registering') : t('registerBtn')}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Payment row
// ---------------------------------------------------------------------------
function PaymentRow({ payment, expenseMap, canManage, canApprove }: {
  payment: FinancePayment;
  expenseMap: Map<string, FinanceExpense>;
  canManage: boolean;
  canApprove: boolean;
}) {
  const t = useTranslations('finances.payments');
  const tApproval = useTranslations('finances.approval');
  const expense = expenseMap.get(payment.expense_id);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [showDocs, setShowDocs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const editRef = useRef<HTMLFormElement>(null);

  const METHOD_LABELS: Record<string, string> = {
    transfer: t('methodTransferShort'),
    check:    t('methodCheck'),
    cash:     t('methodCash'),
    card:     t('methodCard'),
    other:    t('methodOther'),
  };

  const METHOD_OPTIONS = [
    { value: 'transfer', label: t('methodTransfer') },
    { value: 'check',    label: t('methodCheck') },
    { value: 'cash',     label: t('methodCash') },
    { value: 'card',     label: t('methodCard') },
    { value: 'other',    label: t('methodOther') },
  ];

  function handleMarkPaid() {
    if (!expense) return;
    if (!confirm(t('markPaidConfirm', { title: expense.title }))) return;
    setError(null);
    startTransition(async () => {
      const res = await processApproval({ expense_id: payment.expense_id, action: 'paid' });
      if (res.error) setError(res.error);
    });
  }

  function handleDelete() {
    if (!confirm(t('deletePaymentConfirm'))) return;
    setError(null);
    startTransition(async () => {
      const res = await deletePayment(payment.id);
      if (res.error) setError(res.error);
    });
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('expense_id', payment.expense_id);
    startTransition(async () => {
      const res = await updatePayment(payment.id, fd);
      if (res.error) setError(res.error);
      else setMode('view');
    });
  }

  const expenseIsApproved = expense?.status === 'approved';

  return (
    <>
      <tr className={`transition-colors ${mode === 'edit' || showDocs ? 'bg-sky-50' : 'hover:bg-gray-50'}`}>
        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
          {fmtDate(payment.payment_date)}
        </td>
        <td className="px-4 py-3">
          {expense ? (
            <div>
              <p className="text-sm font-medium text-gray-900">{expense.title}</p>
              <div className="flex flex-wrap gap-2 mt-0.5">
                {expense.disciplina && (
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                    {expense.disciplina}
                  </span>
                )}
                {expense.supplier && (
                  <span className="text-xs text-gray-500">{expense.supplier.name}</span>
                )}
                {expense.athlete && (
                  <span className="text-xs text-teal-600">
                    {expense.athlete.first_name} {expense.athlete.last_name}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-xs text-gray-400 font-mono">{payment.expense_id.slice(0, 8)}…</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{fmt(payment.amount)}</td>
        <td className="px-4 py-3 text-sm text-gray-600">
          {METHOD_LABELS[payment.payment_method] ?? payment.payment_method}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">{payment.reference ?? '—'}</td>
        <td className="px-4 py-3">
          {error && <p className="text-xs text-red-500 mb-1 text-right">{error}</p>}
          <div className="flex justify-end gap-1 flex-wrap">
            {canApprove && expenseIsApproved && (
              <button
                onClick={handleMarkPaid}
                disabled={isPending}
                className="px-2.5 py-1 text-xs rounded font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                title={t('markPaidTitle')}
              >
                {t('markPaidBtn')}
              </button>
            )}
            {canManage && (
              <button
                onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  mode === 'edit' ? 'bg-indigo-200 text-indigo-800' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                }`}
              >
                {mode === 'edit' ? '←' : tApproval('approve') === 'Approve' ? 'Edit' : 'Editar'}
              </button>
            )}
            {canManage && (
              <button onClick={handleDelete} disabled={isPending}
                className="px-2.5 py-1 text-xs rounded font-medium bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50">
                {isPending ? '…' : '🗑'}
              </button>
            )}
            <button
              onClick={() => setShowDocs(v => !v)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                showDocs ? 'bg-sky-200 text-sky-800' : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
              }`}
              title={t('receiptsLabel')}
            >
              📎 {showDocs ? '▲' : '▼'}
            </button>
          </div>
        </td>
      </tr>

      {mode === 'edit' && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-indigo-50 border-b border-indigo-100">
            <form ref={editRef} onSubmit={handleEdit} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <input type="hidden" name="expense_id" value={payment.expense_id} />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('editAmountLabel')}</label>
                <input name="amount" type="number" required min={0.01} step="0.01"
                  defaultValue={payment.amount}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('editDateLabel')}</label>
                <input name="payment_date" type="date" required defaultValue={payment.payment_date}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('editMethodLabel')}</label>
                <select name="payment_method" required defaultValue={payment.payment_method}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none">
                  {METHOD_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('editReferenceLabel')}</label>
                <input name="reference" type="text" defaultValue={payment.reference ?? ''}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
                  placeholder={t('editReferencePlaceholder')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('editNotesLabel')}</label>
                <input name="notes" type="text" defaultValue={payment.notes ?? ''}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none" />
              </div>
              <div className="flex items-end gap-2">
                <button type="button" onClick={() => { setMode('view'); setError(null); }}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 flex-1">
                  {tApproval('cancel')}
                </button>
                <button type="submit" disabled={isPending}
                  className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex-1">
                  {isPending ? '…' : tApproval('approve') === 'Approve' ? 'Save' : 'Guardar'}
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}

      {showDocs && (
        <tr>
          <td colSpan={6} className="px-4 py-3 bg-sky-50 border-b border-sky-100">
            <InlineAttachments
              label={t('receiptsLabel')}
              color="sky"
              canManage={canManage}
              listFn={() => listPaymentAttachments(payment.id)}
              uploadFn={(fd) => uploadPaymentAttachment(payment.id, fd)}
              deleteFn={deletePaymentAttachment}
              signedUrlFn={getPaymentAttachmentSignedUrl}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function PaymentsClient({
  payments,
  approvedExpenses,
  canManage,
  canApprove = false,
}: {
  payments: FinancePayment[];
  approvedExpenses: FinanceExpense[];
  canManage: boolean;
  canApprove?: boolean;
}) {
  const t = useTranslations('finances.payments');
  const tApproval = useTranslations('finances.approval');
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterDisc, setFilterDisc] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const expenseMap = new Map(approvedExpenses.map(e => [e.id, e]));

  const allDiscs = useMemo(() =>
    [...new Set(
      payments.map(p => expenseMap.get(p.expense_id)?.disciplina).filter(Boolean) as string[]
    )].sort(),
    [payments, expenseMap]
  );

  const METHOD_OPTIONS = [
    { value: 'transfer', label: t('methodTransfer') },
    { value: 'check',    label: t('methodCheck') },
    { value: 'cash',     label: t('methodCash') },
    { value: 'card',     label: t('methodCard') },
    { value: 'other',    label: t('methodOther') },
  ];

  const filtered = useMemo(() => {
    let list = payments;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => {
        const exp = expenseMap.get(p.expense_id);
        return (
          exp?.title.toLowerCase().includes(q) ||
          (p.reference ?? '').toLowerCase().includes(q) ||
          (p.notes ?? '').toLowerCase().includes(q)
        );
      });
    }
    if (filterMethod) list = list.filter(p => p.payment_method === filterMethod);
    if (filterDisc) {
      list = list.filter(p => expenseMap.get(p.expense_id)?.disciplina === filterDisc);
    }
    if (filterDateFrom) list = list.filter(p => p.payment_date >= filterDateFrom);
    if (filterDateTo)   list = list.filter(p => p.payment_date <= filterDateTo);
    return list;
  }, [payments, expenseMap, search, filterMethod, filterDisc, filterDateFrom, filterDateTo]);

  const hasFilters = !!(search || filterMethod || filterDisc || filterDateFrom || filterDateTo);
  const filteredTotal = filtered.reduce((s, p) => s + p.amount, 0);
  const totalAll = payments.reduce((s, p) => s + p.amount, 0);

  function clearFilters() {
    setSearch(''); setFilterMethod(''); setFilterDisc('');
    setFilterDateFrom(''); setFilterDateTo('');
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {payments.length} {payments.length !== 1 ? t('colDate').toLowerCase() : ''} — {t('totalLabel')}: <strong>{fmt(totalAll)}</strong>
        </p>
        {canManage && (
          <button
            onClick={() => setShowForm(!showForm)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              showForm
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-sky-600 text-white hover:bg-sky-700'
            }`}
          >
            {showForm ? t('cancelNewPayment') : t('newPaymentBtn')}
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border border-sky-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-sky-800 mb-4">{t('newPaymentTitle')}</h3>
          <NewPaymentForm
            approvedExpenses={approvedExpenses}
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {payments.length > 0 && (
        <div className="flex flex-wrap gap-2 items-end bg-gray-50 rounded-lg border border-gray-200 p-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('filterSearch')}</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('filterSearchPlaceholder')}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none w-40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('filterMethod')}</label>
            <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none">
              <option value="">{t('filterAllMethods')}</option>
              {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('filterFrom')}</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('filterTo')}</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none" />
          </div>
          <div className="flex items-end gap-2 ml-auto">
            {hasFilters && (
              <button onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-700 underline pb-2">
                {t('filterClear')}
              </button>
            )}
            <span className="text-xs text-gray-500 pb-2">
              {filtered.length} / {payments.length} · <strong>{fmt(filteredTotal)}</strong>
            </span>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center space-y-2">
          <p className="text-gray-500 text-sm">{t('noPayments')}</p>
          {canManage && approvedExpenses.length > 0 && (
            <p className="text-xs text-gray-400">
              {t('readyToPay', { count: approvedExpenses.length })}
            </p>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-gray-500 text-sm">{t('noPaymentsFiltered')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colDate')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colExpense')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colAmount')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colMethod')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colReference')}</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map(p => (
                <PaymentRow key={p.id} payment={p} expenseMap={expenseMap} canManage={canManage} canApprove={canApprove} />
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-gray-700 text-right">
                  {hasFilters ? t('totalFiltered') : t('totalLabel')}
                </td>
                <td className="px-4 py-2 text-sm font-bold text-gray-900 text-right">{fmt(filteredTotal)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  updateBudget, cancelBudget, deleteBudget,
  createBudgetItem, updateBudgetItem, deleteBudgetItem,
} from '@/lib/finance/actions';
import { BudgetForm } from '@/components/finances/budget-form';
import type { FinanceBudget, FinanceBudgetItem, FinanceExpenseCategory } from '@/lib/types/finance';

const fmt = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

// ── Item row ──────────────────────────────────────────────────────────────────
function ItemRow({
  item, categories, budgetId, canManage,
}: {
  item: FinanceBudgetItem;
  categories: FinanceExpenseCategory[];
  budgetId: string;
  canManage: boolean;
}) {
  const t = useTranslations('finances.budgets.detail');
  const tApproval = useTranslations('finances.approval');
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('budget_id', budgetId);
    startTransition(async () => {
      const res = await updateBudgetItem(item.id, fd);
      if (res.error) setError(res.error);
      else setMode('view');
    });
  }

  function handleDelete() {
    if (!confirm(t('deleteItemConfirm', { name: item.name }))) return;
    startTransition(async () => {
      const res = await deleteBudgetItem(item.id, budgetId);
      if (res.error) setError(res.error);
    });
  }

  if (mode === 'edit') {
    return (
      <tr>
        <td colSpan={5} className="px-4 py-4 bg-indigo-50">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <form onSubmit={handleEdit} className="grid grid-cols-2 gap-3">
            <input type="hidden" name="budget_id" value={budgetId} />
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('itemNameLabel')}</label>
              <input name="name" required defaultValue={item.name}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('itemCategoryLabel')}</label>
              <select name="category_id" defaultValue={item.category_id ?? ''}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none">
                <option value="">{t('noCategoryOption')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('itemAmountLabel')}</label>
              <input name="amount" type="number" required min={0} step="0.01" defaultValue={item.amount}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('itemDescLabel')}</label>
              <input name="description" defaultValue={item.description ?? ''}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none" />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => { setMode('view'); setError(null); }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50">
                {tApproval('cancel')}
              </button>
              <button type="submit" disabled={isPending}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                {isPending ? tApproval('processing') : tApproval('confirm').startsWith('C') ? 'Save' : 'Guardar'}
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {item.category ? (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.category.color ?? '#9ca3af' }} />
            {item.category.name}
          </span>
        ) : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{item.description ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{fmt(item.amount)}</td>
      {canManage && (
        <td className="px-4 py-3 text-right">
          {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
          <div className="flex justify-end gap-1">
            <button onClick={() => setMode('edit')}
              className="px-2.5 py-1 text-xs text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100">
              {tApproval('approve') === 'Approve' ? 'Edit' : 'Editar'}
            </button>
            <button onClick={handleDelete} disabled={isPending}
              className="px-2.5 py-1 text-xs text-red-600 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50">
              {isPending ? '…' : tApproval('approve') === 'Approve' ? 'Delete' : 'Eliminar'}
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

// ── Add item form ─────────────────────────────────────────────────────────────
function AddItemForm({ budgetId, categories, onDone }: {
  budgetId: string; categories: FinanceExpenseCategory[]; onDone: () => void;
}) {
  const t = useTranslations('finances.budgets.detail');
  const tApproval = useTranslations('finances.approval');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('budget_id', budgetId);
    startTransition(async () => {
      const res = await createBudgetItem(fd);
      if (res.error) setError(res.error);
      else { e.currentTarget.reset(); onDone(); }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 bg-indigo-50 p-4 rounded-lg">
      <input type="hidden" name="budget_id" value={budgetId} />
      <h4 className="col-span-2 text-sm font-semibold text-indigo-800">{t('newItemTitle')}</h4>
      {error && <p className="col-span-2 text-xs text-red-600">{error}</p>}
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('itemNameLabel')}</label>
        <input name="name" required className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('itemCategoryLabel')}</label>
        <select name="category_id" className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none">
          <option value="">{t('noCategoryOption')}</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('itemAmountLabel')}</label>
        <input name="amount" type="number" required min={0} step="0.01"
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none" />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('itemDescLabel')}</label>
        <input name="description" className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none" />
      </div>
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onDone}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
          {tApproval('cancel')}
        </button>
        <button type="submit" disabled={isPending}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
          {isPending ? tApproval('processing') : t('addItemSubmit')}
        </button>
      </div>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function BudgetDetailClient({
  budget, items, categories, canManage,
}: {
  budget: FinanceBudget;
  items: FinanceBudgetItem[];
  categories: FinanceExpenseCategory[];
  canManage: boolean;
}) {
  const t = useTranslations('finances.budgets');
  const tDetail = useTranslations('finances.budgets.detail');
  const tApproval = useTranslations('finances.approval');
  const router = useRouter();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [showAddItem, setShowAddItem] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalItems = items.reduce((s, i) => s + i.amount, 0);
  const diff = budget.total_amount - totalItems;

  const STATUS_COLOR: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700',
    closed: 'bg-blue-100 text-blue-700', cancelled: 'bg-red-100 text-red-600',
  };
  const STATUS_LABEL: Record<string, string> = {
    draft: t('statusDraft'), active: t('statusActive'),
    closed: t('statusClosed'), cancelled: t('statusCancelled'),
  };

  function handleCancel() {
    if (!confirm(tDetail('cancelBudgetConfirm'))) return;
    startTransition(async () => {
      const res = await cancelBudget(budget.id);
      if (res.error) setCancelError(res.error);
    });
  }

  function handleDelete() {
    if (!confirm(tDetail('deleteBudgetConfirm', { name: budget.name }))) return;
    startTransition(async () => {
      const res = await deleteBudget(budget.id);
      if (res.error) { setCancelError(res.error); return; }
      router.push('/finances/budgets');
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-gray-900">{budget.name}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[budget.status] ?? ''}`}>
                {STATUS_LABEL[budget.status] ?? budget.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {tDetail('year', { year: budget.fiscal_year })} · {budget.start_date} → {budget.end_date}
            </p>
            {budget.description && (
              <p className="text-sm text-gray-600 mt-1">{budget.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-indigo-900">{fmt(budget.total_amount)}</p>
            <p className="text-xs text-gray-400">{tDetail('totalBudgeted')}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded bg-gray-50 p-2">
            <p className="text-xs text-gray-500">{tDetail('assignedItems')}</p>
            <p className="font-semibold text-gray-900">{fmt(totalItems)}</p>
          </div>
          <div className={`rounded p-2 ${diff < 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
            <p className="text-xs text-gray-500">{tDetail('difference')}</p>
            <p className={`font-semibold ${diff < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(diff)}</p>
          </div>
          <div className="rounded bg-gray-50 p-2">
            <p className="text-xs text-gray-500">{tDetail('numItems')}</p>
            <p className="font-semibold text-gray-900">{items.length}</p>
          </div>
        </div>

        {canManage && (
          <div className="mt-4 flex gap-2 flex-wrap">
            {budget.status !== 'cancelled' && (
              <>
                <button onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">
                  {mode === 'edit' ? tDetail('cancelEditBtn') : tDetail('editBudgetBtn')}
                </button>
                <button onClick={handleCancel} disabled={isPending}
                  className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50">
                  {isPending ? tDetail('processingBtn') : tDetail('cancelBudgetBtn')}
                </button>
              </>
            )}
            {budget.status === 'cancelled' && (
              <button onClick={handleDelete} disabled={isPending}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 font-medium">
                {isPending ? tDetail('deletingBtn') : tDetail('deleteBudgetBtn')}
              </button>
            )}
          </div>
        )}
        {cancelError && <p className="text-sm text-red-600 mt-2">{cancelError}</p>}

        {mode === 'edit' && (
          <div className="mt-4 border-t pt-4">
            <BudgetForm budget={budget} onSuccess={() => setMode('view')} onCancel={() => setMode('view')} />
          </div>
        )}
      </div>

      {/* Budget items table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">{tDetail('itemsTitle')}</h3>
          {canManage && budget.status !== 'cancelled' && (
            <button onClick={() => setShowAddItem(!showAddItem)}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              {showAddItem ? tDetail('hideItemsBtn') : tDetail('addItemBtn')}
            </button>
          )}
        </div>

        {showAddItem && (
          <div className="p-4 border-b border-gray-200">
            <AddItemForm budgetId={budget.id} categories={categories} onDone={() => setShowAddItem(false)} />
          </div>
        )}

        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {tDetail('noItems')}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tDetail('itemColName')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tDetail('itemColCategory')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tDetail('itemColDesc')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{tDetail('itemColAmount')}</th>
                {canManage && <th className="px-4 py-3 w-24"></th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map(item => (
                <ItemRow key={item.id} item={item} categories={categories} budgetId={budget.id} canManage={canManage} />
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-3 text-sm text-gray-700" colSpan={3}>{tDetail('totalItems')}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-900">{fmt(totalItems)}</td>
                {canManage && <td />}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

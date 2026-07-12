'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateBudget, cancelBudget, deleteBudget } from '@/lib/finance/actions';
import { BudgetForm } from '@/components/finances/budget-form';
import { Link } from '@/i18n/navigation';
import type { FinanceBudget } from '@/lib/types/finance';

const fmt = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

function BudgetRow({ budget, canManage }: { budget: FinanceBudget; canManage: boolean }) {
  const t = useTranslations('finances.budgets');
  const tApproval = useTranslations('finances.approval');
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const STATUS_LABEL: Record<string, string> = {
    draft: t('statusDraft'), active: t('statusActive'),
    closed: t('statusClosed'), cancelled: t('statusCancelled'),
  };
  const STATUS_COLOR: Record<string, string> = {
    draft:     'bg-gray-100 text-gray-600',
    active:    'bg-green-100 text-green-700',
    closed:    'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-600',
  };

  function handleCancel() {
    if (!confirm(t('cancelConfirm', { name: budget.name }))) return;
    startTransition(async () => {
      const res = await cancelBudget(budget.id);
      if (res.error) setError(res.error);
    });
  }

  function handleDelete() {
    if (!confirm(t('deleteConfirm', { name: budget.name }))) return;
    startTransition(async () => {
      const res = await deleteBudget(budget.id);
      if (res.error) setError(res.error);
    });
  }

  return (
    <>
      <tr className={`transition-colors ${mode === 'edit' ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
        <td className="px-4 py-3 text-sm font-medium text-gray-900">{budget.name}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{budget.fiscal_year}</td>
        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
          {fmt(budget.total_amount)}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[budget.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[budget.status] ?? budget.status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">
          {budget.start_date} → {budget.end_date}
        </td>
        <td className="px-4 py-3 text-right">
          {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
          <div className="flex justify-end gap-1 items-center flex-wrap">
            <Link
              href={`/finances/budgets/${budget.id}` as Parameters<typeof Link>[0]['href']}
              className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              {t('viewBtn')}
            </Link>
            {canManage && budget.status !== 'cancelled' && (
              <button
                onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
                disabled={isPending}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 ${
                  mode === 'edit' ? 'bg-indigo-200 text-indigo-800' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                }`}
              >
                {mode === 'edit' ? t('closeBtn') : t('editBtn')}
              </button>
            )}
            {canManage && budget.status !== 'cancelled' && (
              <button onClick={handleCancel} disabled={isPending}
                className="px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50">
                {isPending ? '…' : t('cancelBtn')}
              </button>
            )}
            {canManage && budget.status === 'cancelled' && (
              <button onClick={handleDelete} disabled={isPending}
                className="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50">
                {isPending ? '…' : t('deleteBtn')}
              </button>
            )}
          </div>
        </td>
      </tr>
      {mode === 'edit' && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-indigo-50 border-b border-indigo-100">
            <BudgetForm
              budget={budget}
              onSuccess={() => { setMode('view'); setError(null); }}
              onCancel={() => setMode('view')}
            />
          </td>
        </tr>
      )}
    </>
  );
}

export function BudgetsListClient({
  budgets,
  canManage,
}: {
  budgets: FinanceBudget[];
  canManage: boolean;
}) {
  const t = useTranslations('finances.budgets');
  const cancelledCount = budgets.filter(b => b.status === 'cancelled').length;

  return (
    <div className="space-y-3">
      {cancelledCount > 0 && canManage && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          {t('cancelledNotice', { count: cancelledCount })}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colName')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colYear')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colAmount')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colStatus')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colValidity')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {budgets.map(b => (
              <BudgetRow key={b.id} budget={b} canManage={canManage} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

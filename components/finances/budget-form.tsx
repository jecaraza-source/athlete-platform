'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createBudget, updateBudget } from '@/lib/finance/actions';
import type { FinanceBudget, BudgetStatus } from '@/lib/types/finance';

export function BudgetForm({
  budget,
  onSuccess,
  onCancel,
}: {
  budget?: FinanceBudget;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('finances.budgets.form');
  const tBudgets = useTranslations('finances.budgets');
  const tApproval = useTranslations('finances.approval');
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEditing = !!budget;

  const STATUS_OPTIONS: { value: BudgetStatus; label: string }[] = [
    { value: 'draft',     label: tBudgets('statusDraft') },
    { value: 'active',   label: tBudgets('statusActive') },
    { value: 'closed',   label: tBudgets('statusClosed') },
    { value: 'cancelled', label: tBudgets('statusCancelled') },
  ];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isEditing
        ? await updateBudget(budget.id, formData)
        : await createBudget(formData);
      if (result.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        onSuccess?.();
      }
    });
  }

  const today = new Date().toISOString().split('T')[0];
  const inputCls = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('nameLabel')} <span className="text-red-500">*</span>
        </label>
        <input name="name" type="text" required defaultValue={budget?.name}
          className={inputCls} placeholder={t('namePlaceholder')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('fiscalYearLabel')} <span className="text-red-500">*</span>
          </label>
          <input name="fiscal_year" type="number" required min={2000} max={2100}
            defaultValue={budget?.fiscal_year ?? new Date().getFullYear()} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('totalAmountLabel')} <span className="text-red-500">*</span>
          </label>
          <input name="total_amount" type="number" required min={0} step="0.01"
            defaultValue={budget?.total_amount} className={inputCls} placeholder="0.00" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('startDateLabel')} <span className="text-red-500">*</span>
          </label>
          <input name="start_date" type="date" required
            defaultValue={budget?.start_date ?? today} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('endDateLabel')} <span className="text-red-500">*</span>
          </label>
          <input name="end_date" type="date" required
            defaultValue={budget?.end_date} className={inputCls} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('statusLabel')}</label>
        <select name="status" defaultValue={budget?.status ?? 'active'} className={inputCls}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('descLabel')}</label>
        <textarea name="description" rows={2} defaultValue={budget?.description ?? ''}
          className={inputCls} placeholder={t('descPlaceholder')} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('notesLabel')}</label>
        <textarea name="notes" rows={2} defaultValue={budget?.notes ?? ''}
          className={inputCls} placeholder={t('notesPlaceholder')} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            {tApproval('cancel')}
          </button>
        )}
        <button type="submit" disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
          {isPending ? t('submitting') : isEditing ? t('submitEdit') : t('submit')}
        </button>
      </div>
    </form>
  );
}

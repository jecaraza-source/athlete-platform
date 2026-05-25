'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { processApproval, submitExpense } from '@/lib/finance/actions';
import { ExpenseStatusBadge } from './expense-status-badge';
import type { FinanceApproval, ExpenseStatus } from '@/lib/types/finance';

export function ApprovalPanel({
  expenseId,
  currentStatus,
  approvals,
  canApprove,
  canManage,
}: {
  expenseId: string;
  currentStatus: ExpenseStatus;
  approvals: FinanceApproval[];
  canApprove: boolean;
  canManage: boolean;
}) {
  const t = useTranslations('finances.approval');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const ACTION_LABELS: Record<string, { label: string; confirmLabel: string; color: string }> = {
    approved:  { label: t('approve'),    confirmLabel: t('confirmApproval'),     color: 'bg-green-600 hover:bg-green-700 text-white' },
    rejected:  { label: t('reject'),     confirmLabel: t('confirmRejection'),    color: 'bg-red-600 hover:bg-red-700 text-white' },
    paid:      { label: t('markPaid'),   confirmLabel: t('confirmPayment'),      color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    cancelled: { label: t('cancel'),     confirmLabel: t('confirmCancellation'), color: 'bg-gray-600 hover:bg-gray-700 text-white' },
  };

  function handleSubmit(action: string) {
    setError(null);
    startTransition(async () => {
      let result: { error: string | null };
      if (action === 'submitted') {
        result = await submitExpense(expenseId);
      } else {
        result = await processApproval({
          expense_id: expenseId,
          action: action as 'approved' | 'rejected' | 'paid' | 'cancelled',
          notes: notes || undefined,
        });
      }
      if (result.error) {
        setError(result.error);
      } else {
        setConfirmAction(null);
        setNotes('');
      }
    });
  }

  const actions: string[] = [];
  if (canManage && currentStatus === 'draft') actions.push('submitted');
  if (canApprove && currentStatus === 'submitted') actions.push('approved', 'rejected');
  if (canApprove && currentStatus === 'approved') actions.push('paid', 'rejected');
  if (canManage && ['draft', 'submitted', 'approved', 'rejected'].includes(currentStatus)) {
    actions.push('cancelled');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">{t('currentStatus')}</span>
        <ExpenseStatusBadge status={currentStatus} />
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const cfg = ACTION_LABELS[action];
            if (!cfg) return null;
            const isSubmit = action === 'submitted';
            return (
              <button
                key={action}
                type="button"
                disabled={isPending}
                onClick={() => (isSubmit ? handleSubmit(action) : setConfirmAction(action))}
                className={`px-3 py-1.5 text-sm font-medium rounded-md disabled:opacity-50 transition-colors ${cfg?.color ?? 'bg-gray-600 text-white'}`}
              >
                {isSubmit ? t('sendForReview') : cfg.label}
              </button>
            );
          })}
        </div>
      )}

      {confirmAction && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-800">
            {ACTION_LABELS[confirmAction]?.confirmLabel}
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('notesPlaceholder')}
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleSubmit(confirmAction)}
              className={`px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 ${ACTION_LABELS[confirmAction]?.color}`}
            >
              {isPending ? t('processing') : t('confirm')}
            </button>
            <button
              type="button"
              onClick={() => { setConfirmAction(null); setNotes(''); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {approvals.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('historyTitle')}</h4>
          <ul className="space-y-2">
            {approvals.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <ExpenseStatusBadge status={a.action as ExpenseStatus} />
                <div className="flex-1 min-w-0">
                  <span className="text-gray-700">
                    {a.performer
                      ? `${a.performer.first_name} ${a.performer.last_name}`
                      : t('system')}
                  </span>
                  {a.notes && (
                    <p className="text-xs text-gray-500 mt-0.5">{a.notes}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(a.created_at).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

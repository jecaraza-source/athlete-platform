'use client';

import { useTranslations } from 'next-intl';
import type { ExpenseStatus } from '@/lib/types/finance';

const STATUS_CLASSES: Record<ExpenseStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  submitted: 'bg-yellow-100 text-yellow-800',
  approved:  'bg-green-100 text-green-800',
  rejected:  'bg-red-100 text-red-800',
  paid:      'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const t = useTranslations('finances.status');
  const classes = STATUS_CLASSES[status] ?? STATUS_CLASSES.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {t(status)}
    </span>
  );
}

import { requirePermission, hasPermission } from '@/lib/rbac/server';
import { listPayments, listExpenses } from '@/lib/finance/actions';
import { PaymentsClient } from './payments-client';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export default async function PaymentsPage() {
  await requirePermission('view_finances');

  const [payments, approvedExpenses, allExpenses, canManage, canApprove, t] = await Promise.all([
    listPayments(),
    listExpenses({ status: 'approved' }),
    listExpenses(),
    hasPermission('manage_finances'),
    hasPermission('approve_finances'),
    getTranslations('finances'),
  ]);

  const paidExpenses = allExpenses.filter(e => e.status === 'paid');
  const allRelevantExpenses = [
    ...approvedExpenses,
    ...paidExpenses.filter(pe => !approvedExpenses.find(ae => ae.id === pe.id)),
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/finances" className="text-sm text-indigo-600 hover:underline">
          ← {t('title')}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{t('payments.title')}</h1>
        {approvedExpenses.length > 0 && canManage && (
          <p className="text-sm text-amber-600 font-medium mt-1">
            {t('payments.approvedPending', { count: approvedExpenses.length })}
          </p>
        )}
      </div>

      <PaymentsClient
        payments={payments}
        approvedExpenses={allRelevantExpenses}
        canManage={canManage}
        canApprove={canApprove}
      />
    </div>
  );
}

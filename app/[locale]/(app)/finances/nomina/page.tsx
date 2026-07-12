import { requirePermission, hasPermission } from '@/lib/rbac/server';
import { listPayroll, listPayrollStaff } from '@/lib/finance/payroll-actions';
import { PayrollClient } from './payroll-client';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export default async function NominaPage() {
  await requirePermission('view_finances');

  const [entries, staff, canManage, t] = await Promise.all([
    listPayroll(),
    listPayrollStaff(),
    hasPermission('manage_finances'),
    getTranslations('finances'),
  ]);

  const total_payroll = entries.reduce((s, e) => s + e.gross_amount, 0);
  const pendingEntries = entries.filter(e => (e.expense?.status ?? e.status) === 'submitted');
  const summary = {
    total_payroll,
    count: entries.length,
    pending: pendingEntries.length,
    pendingAmount: pendingEntries.reduce((s, e) => s + e.gross_amount, 0),
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/finances" className="text-sm text-indigo-600 hover:underline">
            ← {t('title')}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{t('payroll.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('payroll.description', { category: 'Nóminas' })}
          </p>
        </div>
        {summary.pending > 0 && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800 shrink-0">
            {t('payroll.pendingBanner', { count: summary.pending })}
          </div>
        )}
      </div>

      <PayrollClient
        entries={entries}
        staff={staff}
        canManage={canManage}
        summary={summary}
      />
    </div>
  );
}

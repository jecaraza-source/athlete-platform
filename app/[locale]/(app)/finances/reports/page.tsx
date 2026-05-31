import { requirePermission } from '@/lib/rbac/server';
import { getFinanceReportData } from '@/lib/finance/actions';
import { FinanceReportsCharts } from './finance-reports-charts';
import { FinancePeriodReport } from './finance-period-report';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import ReportsTabs from './reports-tabs';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  await requirePermission('view_finance_reports');

  const [data, t] = await Promise.all([
    getFinanceReportData(),
    getTranslations('finances'),
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/finances" className="text-sm text-indigo-600 hover:underline">
            ← {t('title')}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('reports.subtitle')}</p>
        </div>
        <span className="text-xs text-gray-400">
          {t('reports.updatedAt')}{' '}
          {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Tabs */}
      <ReportsTabs
        globalTab={<FinanceReportsCharts data={data} />}
        periodicTab={<FinancePeriodReport data={data} />}
      />
    </div>
  );
}

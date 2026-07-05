// Server Component — auth guard + initial data fetch happen server-side.
// Access is restricted to super_admin, admin, coordinador.
import { requireReportAccess }  from '@/lib/rbac/server';
import { getReportPeriodRange }  from '@/lib/periods';
import { fetchReportData }       from '@/lib/adminReportQueries';
import ReportesClient            from './ReportesClient';

export const dynamic = 'force-dynamic';

export default async function ReportesPage() {
  await requireReportAccess();

  const DEFAULT_PERIOD = 'month' as const;
  const meta           = getReportPeriodRange(DEFAULT_PERIOD);
  const initialData    = await fetchReportData(meta.from, meta.to);

  return (
    <ReportesClient
      defaultPeriod={DEFAULT_PERIOD}
      initialMeta={meta}
      initialData={initialData}
    />
  );
}

// Server Component — auth guard + initial data fetch happen on the server.
// The interactive shell (period picker, drawer, realtime alerts) lives in
// AdminConsoleClient which is a separate Client Component.
import { requireAdminAccess }       from '@/lib/rbac/server';
import { getPeriodRange, getPreviousPeriodRange } from '@/lib/periods';
import {
  fetchKpis, fetchServiceStats, fetchRecentAppointments,
  fetchHeatmapData, fetchSpecialistRanking,
} from '@/lib/adminQueries';
import AdminConsoleClient            from './AdminConsoleClient';

export const dynamic = 'force-dynamic';

export default async function AdminConsolePage() {
  // ── Auth guard (server-side redirect if not admin) ───────────────────────
  const adminUser = await requireAdminAccess();

  const initialUser = {
    id:        adminUser.profile!.id,
    email:     adminUser.profile!.email ?? '',
    full_name: `${adminUser.profile!.first_name} ${adminUser.profile!.last_name}`.trim(),
  };
  const initialRole = adminUser.roles[0]?.code ?? '';

  // ── Pre-fetch default period data (server-side, bypasses RLS via supabaseAdmin) ─
  const DEFAULT_PERIOD = 'month' as const;
  const periodRange    = getPeriodRange(DEFAULT_PERIOD);
  const prevRange      = getPreviousPeriodRange(DEFAULT_PERIOD);

  const [kpis, services, recentApts, heatmap, specialists] = await Promise.all([
    fetchKpis(periodRange.from, periodRange.to, prevRange.from, prevRange.to),
    fetchServiceStats(periodRange.from, periodRange.to, prevRange.from, prevRange.to),
    fetchRecentAppointments(periodRange.from, periodRange.to),
    fetchHeatmapData(periodRange.from, periodRange.to),
    fetchSpecialistRanking(periodRange.from, periodRange.to),
  ]);

  return (
    <AdminConsoleClient
      initialUser={initialUser}
      initialRole={initialRole}
      defaultPeriod={DEFAULT_PERIOD}
      initialData={{ kpis, services, recentApts, heatmap, specialists }}
    />
  );
}

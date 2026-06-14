'use client';

// ---------------------------------------------------------------------------
// AdminConsoleClient
// ---------------------------------------------------------------------------
// Handles all interactive UI state for the Admin Console:
//   - Period picker  (today / week / month / 3months)
//   - Data refetch when period changes (via Server Actions from adminQueries)
//   - Appointments drawer
//   - Realtime alerts subscription
//   - Logout button
//
// Auth is handled upstream by the Server Component (page.tsx) which calls
// requireAdminAccess() before rendering this component. No client-side auth
// hook is needed here.
// ---------------------------------------------------------------------------

import { useState, useEffect }  from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useRealtimeAlerts }    from '@/hooks/useRealtimeAlerts';
import { AdminHeader }          from '@/components/admin/AdminHeader';
import { KpiCards }             from '@/components/admin/KpiCards';
import { ServicesChart }        from '@/components/admin/ServicesChart';
import { AppointmentsTable }    from '@/components/admin/AppointmentsTable';
import { AppointmentsDrawer }   from '@/components/admin/AppointmentsDrawer';
import { OperativeIndicators }  from '@/components/admin/OperativeIndicators';
import { AlertsPanel }          from '@/components/admin/AlertsPanel';
import { PlatformMetrics }      from '@/components/admin/PlatformMetrics';
import { getPeriodRange, getPreviousPeriodRange } from '@/lib/periods';
import {
  fetchKpis,
  fetchServiceStats,
  fetchRecentAppointments,
  fetchHeatmapData,
  fetchSpecialistRanking,
} from '@/lib/adminQueries';
import type {
  PeriodKey, KpiSet, ServiceStat,
  Appointment, HeatmapCell, SpecialistLoad,
} from '@/lib/types/admin';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type AdminUser = {
  id:        string;
  email:     string;
  full_name: string;
};

type InitialData = {
  kpis:        KpiSet;
  services:    ServiceStat[];
  recentApts:  Appointment[];
  heatmap:     HeatmapCell[];
  specialists: SpecialistLoad[];
};

type Props = {
  initialUser:   AdminUser;
  initialRole:   string;
  defaultPeriod: PeriodKey;
  initialData:   InitialData;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminConsoleClient({
  initialUser,
  initialRole,
  defaultPeriod,
  initialData,
}: Props) {
  const { alerts, dismissAlert } = useRealtimeAlerts();

  const [period, setPeriod]           = useState<PeriodKey>(defaultPeriod);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [kpis, setKpis]               = useState<KpiSet | null>(initialData.kpis);
  const [services, setServices]       = useState<ServiceStat[]>(initialData.services);
  const [recentApts, setRecentApts]   = useState<Appointment[]>(initialData.recentApts);
  const [heatmap, setHeatmap]         = useState<HeatmapCell[]>(initialData.heatmap);
  const [specialists, setSpecialists] = useState<SpecialistLoad[]>(initialData.specialists);

  const periodRange = getPeriodRange(period);
  const prevRange   = getPreviousPeriodRange(period);

  // Refetch data whenever the user changes the period.
  // Server Actions from adminQueries are called directly — they run on the
  // server using supabaseAdmin so no RLS or anon-key concerns.
  useEffect(() => {
    // Skip on mount: initial data is already loaded by the Server Component.
    // We track whether it's the first render via the period matching default.
    // (Using a ref would also work, but checking equality is simpler here.)
    if (period === defaultPeriod) return;

    setKpis(null);
    setServices([]);
    setRecentApts([]);

    const load = async () => {
      const [k, sv, ra, hm, sp] = await Promise.all([
        fetchKpis(periodRange.from, periodRange.to, prevRange.from, prevRange.to),
        fetchServiceStats(periodRange.from, periodRange.to, prevRange.from, prevRange.to),
        fetchRecentAppointments(periodRange.from, periodRange.to),
        fetchHeatmapData(periodRange.from, periodRange.to),
        fetchSpecialistRanking(periodRange.from, periodRange.to),
      ]);
      setKpis(k);
      setServices(sv);
      setRecentApts(ra);
      setHeatmap(hm);
      setSpecialists(sp);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const handleLogout = async () => {
    // Logout must use the browser client so it clears the session cookie.
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const attendanceData = kpis
    ? [
        {
          name:  'Atendió',
          value: Math.round((kpis.attendanceRate.value / 100) * kpis.totalAppointments.value),
          color: '#10B981',
        },
        {
          name:  'No Atendió',
          value: kpis.totalAppointments.value
            - Math.round((kpis.attendanceRate.value / 100) * kpis.totalAppointments.value),
          color: '#EF4444',
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#0F1117]">
      {/* Nodo oculto usado por triggerPrint() */}
      <div id="print-root" style={{ display: 'none' }} />

      {/* Header fijo */}
      <AdminHeader
        userName={initialUser.full_name || initialUser.email}
        role={initialRole}
        period={period}
        onPeriodChange={setPeriod}
        onLogout={handleLogout}
      />

      {/* Contenido principal */}
      <main className="pt-20 px-4 md:px-6 pb-12 max-w-screen-2xl mx-auto">
        <div className="space-y-6">

          {/* ── KPIs ─────────────────────────────────────────────────────── */}
          <section aria-label="KPIs generales">
            {kpis ? (
              <KpiCards
                kpis={kpis}
                periodLabel={periodRange.label}
                onOpenDrawer={() => setDrawerOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-[#1A1D27] rounded-xl border border-[#2A2D3A] p-5 h-32 animate-pulse" />
                ))}
              </div>
            )}
          </section>

          {/* ── Servicios utilizados ──────────────────────────────────────── */}
          <section aria-label="Servicios utilizados">
            {services.length > 0 ? (
              <ServicesChart data={services} />
            ) : (
              <div className="bg-[#1A1D27] rounded-xl border border-[#2A2D3A] h-80 animate-pulse" />
            )}
          </section>

          {/* ── Citas recientes (resumen) ──────────────────────────────────── */}
          <section aria-label="Citas recientes">
            <AppointmentsTable
              data={recentApts}
              onOpenDrawer={() => setDrawerOpen(true)}
            />
          </section>

          {/* ── Indicadores operativos ────────────────────────────────────── */}
          <section aria-label="Indicadores operativos">
            <OperativeIndicators
              attendanceData={attendanceData}
              attendanceRate={kpis?.attendanceRate.value ?? 0}
              heatmap={heatmap}
              specialists={specialists}
            />
          </section>

          {/* ── Alertas + Métricas ────────────────────────────────────────── */}
          <section aria-label="Alertas y métricas" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <AlertsPanel alerts={alerts} onDismiss={dismissAlert} />
            </div>
            <div>
              <PlatformMetrics />
            </div>
          </section>

        </div>
      </main>

      {/* Drawer de detalle completo */}
      <AppointmentsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        from={periodRange.from}
        to={periodRange.to}
        periodLabel={periodRange.label}
        currentUserId={initialUser.id}
      />
    </div>
  );
}

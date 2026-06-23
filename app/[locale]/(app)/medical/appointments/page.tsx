import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentUser } from '@/lib/rbac/server';
import BackButton from '@/components/back-button';
import { Suspense } from 'react';
import AppointmentsFilters from './appointments-filters';
import { todayInMX, TZ } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

const MEDICAL_ROLE_CODES = [
  'medic', 'psychologist', 'nutritionist', 'physio',
  'admin', 'super_admin', 'program_director', 'event_coordinator',
];

const STATUS_PILL: Record<string, string> = {
  scheduled:      'bg-blue-100 text-blue-700',
  show:           'bg-emerald-100 text-emerald-700',
  no_show:        'bg-red-100 text-red-700',
  no_show_remote: 'bg-orange-100 text-orange-700',
  rescheduled:    'bg-amber-100 text-amber-700',
  cancelled:      'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<string, string> = {
  scheduled:      'Programada',
  show:           'Atendida',
  no_show:        'No asistió',
  no_show_remote: 'Llamada/Mensaje',
  rescheduled:    'Reagendada',
  cancelled:      'Cancelada',
};

type EventRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: string;
  event_participants: { participant_id: string }[];
};

type AthleteStub = { id: string; first_name: string; last_name: string };

const MONTH_LABELS: Record<string, string> = {
  '6':'Junio','7':'Julio','8':'Agosto','9':'Septiembre',
  '10':'Octubre','11':'Noviembre','12':'Diciembre',
};

export default async function AppointmentsListPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; service?: string; status?: string }>;
}) {
  const locale = await getLocale();
  const { month: monthParam = 'all', service: serviceParam = 'all', status: statusParam = 'all' } =
    await searchParams;

  const user = await getCurrentUser();
  if (!user?.profile) redirect(`/${locale}/login`);

  const userRoleCodes = user.roles.map((r) => r.code);
  if (!userRoleCodes.some((c) => MEDICAL_ROLE_CODES.includes(c))) {
    redirect(`/${locale}/dashboard`);
  }

  const isAdmin = userRoleCodes.some((c) =>
    ['admin', 'super_admin', 'program_director', 'event_coordinator'].includes(c),
  );

  // Date range: full program Jun 2026 → Dec 2026 (including past appointments)
  const todayMX      = todayInMX();           // 'YYYY-MM-DD' in Mexico City
  const PROGRAM_START = '2026-06-01T00:00:00'; // Start of the program
  const PROGRAM_END   = '2026-12-31T23:59:59';

  // Month filter overrides range start/end
  let filterStart = PROGRAM_START;
  let filterEnd   = PROGRAM_END;
  if (monthParam !== 'all') {
    const mo = parseInt(monthParam, 10);
    const lastDay = new Date(2026, mo, 0).getDate();
    filterStart = `2026-${String(mo).padStart(2, '0')}-01T00:00:00`;
    filterEnd   = `2026-${String(mo).padStart(2, '0')}-${lastDay}T23:59:59`;
  }

  // Build query — ascending order, full program period
  let query = supabaseAdmin
    .from('events')
    .select('id, title, start_at, end_at, status, event_participants(participant_id)')
    .eq('event_type', 'medical')
    .gte('start_at', filterStart)
    .lte('start_at', filterEnd)
    .order('start_at', { ascending: true })
    .limit(500);

  if (!isAdmin) {
    query = query.eq('created_by_profile_id', user.profile.id);
  }

  // Service filter (title contains keyword)
  if (serviceParam !== 'all') {
    query = query.ilike('title', `%${serviceParam}%`);
  }

  // Status filter
  if (statusParam !== 'all') {
    query = query.eq('status', statusParam);
  }

  const { data, error } = await query;
  const events = (data ?? []) as unknown as EventRow[];

  // Step 2: batch-fetch athlete names
  const athleteIds = [...new Set(
    events.flatMap((ev) => ev.event_participants.map((ep) => ep.participant_id))
  )].filter(Boolean);

  const athleteMap = new Map<string, AthleteStub>();
  if (athleteIds.length > 0) {
    const { data: athletes } = await supabaseAdmin
      .from('athletes')
      .select('id, first_name, last_name')
      .in('id', athleteIds);
    (athletes ?? []).forEach((a) => athleteMap.set(a.id, a as AthleteStub));
  }

  // Group events by date (MX timezone)
  const grouped = new Map<string, EventRow[]>();
  for (const ev of events) {
    const dayKey = new Date(ev.start_at).toLocaleDateString('sv-SE', { timeZone: TZ }); // YYYY-MM-DD
    if (!grouped.has(dayKey)) grouped.set(dayKey, []);
    grouped.get(dayKey)!.push(ev);
  }

  function renderEvent(ev: EventRow, isPast: boolean) {
    const pid = ev.event_participants?.[0]?.participant_id;
    const athlete = pid ? athleteMap.get(pid) : undefined;
    const athleteName = athlete
      ? `${athlete.first_name} ${athlete.last_name}`
      : 'Atleta no asignado';
    const needsAction = ev.status === 'scheduled' && !isPast;
    const isProcessed = ['show', 'no_show', 'no_show_remote', 'rescheduled'].includes(ev.status);

    return (
      <li key={ev.id}>
        <Link
          href={`/medical/appointments/${ev.id}`}
          className={`flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors group ${
            isPast && !isProcessed ? 'opacity-70' : ''
          }`}
        >
          {/* Time */}
          <div className="w-14 shrink-0 text-center">
            <p className={`text-sm font-bold ${
              isPast ? 'text-gray-400' : 'text-gray-700'
            }`}>
              {new Date(ev.start_at).toLocaleTimeString('es-MX', {
                timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
              })}
            </p>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-semibold truncate ${
                isPast ? 'text-gray-500' : 'text-gray-800'
              }`}>{athleteName}</p>
              {needsAction && (
                <span className="shrink-0 w-2 h-2 rounded-full bg-cyan-500" title="Pendiente" />
              )}
              {isPast && !isProcessed && ev.status === 'scheduled' && (
                <span className="shrink-0 text-[10px] font-medium text-red-500 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                  Pendiente de registrar
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{ev.title}</p>
          </div>

          {/* Status pill */}
          <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
            STATUS_PILL[ev.status] ?? 'bg-gray-100 text-gray-600'
          }`}>
            {STATUS_LABEL[ev.status] ?? ev.status}
          </span>

          <span className="text-gray-300 group-hover:text-gray-500 text-sm">›</span>
        </Link>
      </li>
    );
  }

  const monthLabel = monthParam === 'all'
    ? 'Programa completo Jun–Dic 2026'
    : `${MONTH_LABELS[monthParam] ?? monthParam} 2026`;

  // Pending-to-register count: past scheduled appointments
  const pendingPast = events.filter(
    (ev) => ev.status === 'scheduled' &&
    new Date(ev.start_at).toLocaleDateString('sv-SE', { timeZone: TZ }) < todayMX
  ).length;

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <BackButton href="/dashboard" label="Volver al dashboard" />

      <h1 className="mt-5 text-2xl font-bold text-gray-900">Mis Citas</h1>
      <p className="text-sm text-gray-500 mt-0.5 mb-3">
        {isAdmin ? 'Todas las citas del sistema' : 'Citas asignadas a tu perfil'}
        {' — '}{monthLabel}
      </p>

      {/* Alert: past appointments pending to register */}
      {pendingPast > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-800">
              {pendingPast} cita{pendingPast > 1 ? 's' : ''} pasada{pendingPast > 1 ? 's' : ''} pendiente{pendingPast > 1 ? 's' : ''} de registrar
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Ingresa a cada cita para marcar asistencia, no-show o llamada.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <Suspense>
        <AppointmentsFilters
          currentMonth={monthParam}
          currentService={serviceParam}
          currentStatus={statusParam}
          totalCount={events.length}
        />
      </Suspense>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Error al cargar las citas: {error.message}
        </div>
      )}

      {grouped.size === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
          <p className="text-base">Sin citas para los filtros seleccionados.</p>
          <p className="text-sm mt-1">Prueba cambiando el mes o removiendo filtros.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([dayKey, dayEvents]) => {
            const dayDate  = new Date(dayKey + 'T12:00:00');
            const dayLabel = dayDate.toLocaleDateString('es-MX', {
              weekday: 'long', day: 'numeric', month: 'long',
            });
            const isToday  = dayKey === todayMX;
            const isPast   = dayKey < todayMX;

            // Count unregistered past appointments
            const unregistered = isPast
              ? dayEvents.filter((e) => e.status === 'scheduled').length
              : 0;

            return (
              <section key={dayKey}>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className={`text-sm font-semibold uppercase tracking-wide capitalize ${
                    isToday ? 'text-cyan-700' : isPast ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {isToday
                      ? `● Hoy — ${dayLabel}`
                      : isPast
                      ? `✓ ${dayLabel}`
                      : dayLabel
                    }
                  </h2>
                  <span className="text-xs text-gray-400">
                    {dayEvents.length} {dayEvents.length === 1 ? 'cita' : 'citas'}
                  </span>
                  {unregistered > 0 && (
                    <span className="text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                      {unregistered} sin registrar
                    </span>
                  )}
                </div>
                <div className={`rounded-xl border overflow-hidden shadow-sm ${
                  isPast ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'
                }`}>
                  <ul className="divide-y divide-gray-100">
                    {dayEvents.map((ev) => renderEvent(ev, isPast))}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

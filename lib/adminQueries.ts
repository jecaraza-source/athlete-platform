'use server';
// =============================================================================
// lib/adminQueries.ts
// Admin console data queries — reads from the EVENTS + EVENT_PARTICIPANTS tables.
//
// The platform stores appointments as `events` (2,900+ rows) with participants
// in `event_participants`. The legacy `appointments` table is empty and unused.
//
// events schema: id, title, event_type, start_at, end_at, status, description,
//               created_by_profile_id, created_at
// events.status: 'scheduled' (=confirmed), 'show', 'no_show', 'rescheduled'
//
// event_participants: id, event_id, participant_id, participant_type,
//                     attendance_status, notes
// =============================================================================

import { supabaseAdmin }    from '@/lib/supabase-admin';
import { requireAdminAccess } from '@/lib/rbac/server';
import { calcTrend }        from '@/lib/periods';
import { todayInMX }        from '@/lib/timezone';
import type {
  Appointment, AppointmentFilters, HeatmapCell,
  KpiSet, ServiceStat, SpecialistLoad, ServiceType,
} from '@/lib/types/admin';

// ─── Internal types ──────────────────────────────────────────────────────────────────────────────────

type RawProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

type RawParticipant = {
  participant_id: string;
  participant_type: string;
  athlete: RawProfile | RawProfile[] | null;
};

type RawEventRow = {
  id: string;
  start_at: string;
  status: string;
  description: string | null;
  title: string | null;
  creator: RawProfile | RawProfile[] | null;
  event_participants: RawParticipant[] | null;
};

type RawCreatorRow = {
  created_by_profile_id: string | null;
  creator: Pick<RawProfile, 'id' | 'first_name' | 'last_name' | 'role'>
    | Pick<RawProfile, 'id' | 'first_name' | 'last_name' | 'role'>[] | null;
};

// Normalise Supabase FK join (may return single object or array)
function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// ─── Service type helpers ────────────────────────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<ServiceType, string> = {
  medico: 'Consulta Médica',
  nutricion: 'Nutrición',
  fisioterapia: 'Fisioterapia',
  psicologia: 'Psicología',
  evaluacion: 'Evaluación de Rendimiento',
  entrenamiento: 'Plan de Entrenamiento',
};

// Derives the service type from the event title (e.g. "FISIOTERAPIA 1" → 'fisioterapia')
const SERVICE_KEYWORDS: [string, ServiceType][] = [
  ['fisio', 'fisioterapia'],
  ['psicol', 'psicologia'],
  ['nutri', 'nutricion'],
  ['entrena', 'entrenamiento'],
  ['evalua', 'evaluacion'],
];

function titleToServiceType(title: string): ServiceType {
  const t = (title || '').toLowerCase();
  for (const [keyword, type] of SERVICE_KEYWORDS) {
    if (t.includes(keyword)) return type;
  }
  return 'medico';
}

// Maps events.status to the Appointment.status union
function mapEventStatus(status: string): Appointment['status'] {
  if (status === 'scheduled')     return 'confirmed';
  if (status === 'show')          return 'show';
  if (status === 'no_show')       return 'no_show';
  if (status === 'no_show_remote') return 'no_show_remote';
  if (status === 'rescheduled')   return 'rescheduled';
  if (status === 'cancelled')     return 'cancelled';
  return 'confirmed';
}

// ISO datetime range helpers (events use TIMESTAMPTZ, not DATE)
function fromISO(date: string): string { return `${date}T00:00:00`; }
function toISO(date: string): string   { return `${date}T23:59:59`; }

// ─── Select fragment ───────────────────────────────────────────────────────────────────────────────
// event_participants.participant_id has no registered FK in PostgREST’s schema cache,
// so we fetch participant_id only and resolve athlete in a separate query per batch.
const EVENT_SELECT = `
  id, start_at, status, description, title,
  creator:profiles!created_by_profile_id(id, first_name, last_name, role),
  event_participants(participant_id, participant_type)
`;

// Fetches athlete names for a list of athlete IDs in one round-trip
async function fetchAthleteMap(
  ids: string[],
): Promise<Map<string, Pick<RawProfile, 'id' | 'first_name' | 'last_name' | 'email'>>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabaseAdmin
    .from('athletes')
    .select('id, first_name, last_name, email')
    .in('id', ids);
  const map = new Map<string, Pick<RawProfile, 'id' | 'first_name' | 'last_name' | 'email'>>();
  (data ?? []).forEach((a) => map.set(a.id, a as Pick<RawProfile, 'id' | 'first_name' | 'last_name' | 'email'>));
  return map;
}

function toAppointment(
  raw: RawEventRow,
  athleteMap: Map<string, Pick<RawProfile, 'id' | 'first_name' | 'last_name' | 'email'>>,
): Appointment {
  const creator     = one(raw.creator);
  const athletePart = (raw.event_participants ?? [])
    .find((p) => p.participant_type === 'athlete');
  const athlete = athletePart ? athleteMap.get(athletePart.participant_id) ?? null : null;

  const dt   = new Date(raw.start_at);
  // Extract date and time in Mexico City timezone
  const date = dt.toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' }); // YYYY-MM-DD
  const time = dt.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const athleteName    = [athlete?.first_name, athlete?.last_name].filter(Boolean).join(' ')
    || athlete?.email || '';
  const specialistName = [creator?.first_name, creator?.last_name].filter(Boolean).join(' ') || '';

  return {
    id:                      raw.id,
    date,
    time,
    status:                  mapEventStatus(raw.status),
    notes:                   raw.description,
    service_type:            titleToServiceType(raw.title ?? ''),
    original_date:           null,
    original_appointment_id: null,
    confirmed_by:            null,
    confirmed_at:            null,
    no_show_reason:          null,
    reschedule_reason:       null,
    athlete: {
      id:         athlete?.id ?? '',
      full_name:  athleteName,
      email:      athlete?.email ?? '',
      avatar_url: null,   // athletes table has no avatar_url
    },
    specialist: {
      id:        creator?.id ?? '',
      full_name: specialistName,
      specialty: creator?.role ?? '',
    },
  };
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────────────────────────

export async function fetchKpis(
  from: string, to: string,
  prevFrom: string, prevTo: string,
): Promise<KpiSet> {
  await requireAdminAccess();

  // Use Mexico City date so 'today' correctly reflects the local date (not UTC)
  const todayISO = todayInMX();

  const [
    { count: totalCurrent },
    { count: totalPrev },
    { count: showsCurrent },
    { count: showsPrev },
    { count: activeAthletes },
    { count: newCurrent },
    { count: newPrev },
    { count: scheduledCount },
    { count: noShowCurrent },
    { count: noShowPrev },
    // Training sessions completed (seguimientos) in each period
    { count: trainingDoneCurrent },
    { count: trainingDonePrev },
  ] = await Promise.all([
    // Total events in current period
    supabaseAdmin.from('events').select('*', { count: 'exact', head: true })
      .gte('start_at', fromISO(from)).lte('start_at', toISO(to)),
    // Total events in previous period
    supabaseAdmin.from('events').select('*', { count: 'exact', head: true })
      .gte('start_at', fromISO(prevFrom)).lte('start_at', toISO(prevTo)),
    // Attended (show) in current period
    supabaseAdmin.from('events').select('*', { count: 'exact', head: true })
      .eq('status', 'show')
      .gte('start_at', fromISO(from)).lte('start_at', toISO(to)),
    // Attended (show) in previous period
    supabaseAdmin.from('events').select('*', { count: 'exact', head: true })
      .eq('status', 'show')
      .gte('start_at', fromISO(prevFrom)).lte('start_at', toISO(prevTo)),
    // Active athletes (global, not period-filtered)
    supabaseAdmin.from('athletes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    // New athletes registered in current period
    supabaseAdmin.from('athletes').select('*', { count: 'exact', head: true })
      .eq('status', 'active').gte('created_at', fromISO(from)).lte('created_at', toISO(to)),
    // New athletes registered in previous period
    supabaseAdmin.from('athletes').select('*', { count: 'exact', head: true })
      .eq('status', 'active').gte('created_at', fromISO(prevFrom)).lte('created_at', toISO(prevTo)),
    // Upcoming scheduled events from today (global — not period-filtered)
    supabaseAdmin.from('events').select('*', { count: 'exact', head: true })
      .eq('status', 'scheduled').gte('start_at', fromISO(todayISO)),
    // No-shows (presencial + remote) in current period
    supabaseAdmin.from('events').select('*', { count: 'exact', head: true })
      .in('status', ['no_show', 'no_show_remote'])
      .gte('start_at', fromISO(from)).lte('start_at', toISO(to)),
    // No-shows (presencial + remote) in previous period
    supabaseAdmin.from('events').select('*', { count: 'exact', head: true })
      .in('status', ['no_show', 'no_show_remote'])
      .gte('start_at', fromISO(prevFrom)).lte('start_at', toISO(prevTo)),
    // Seguimientos: training sessions marked done (is_done=true) in current period
    supabaseAdmin.from('training_sessions').select('*', { count: 'exact', head: true })
      .eq('is_done', true)
      .gte('session_date', from).lte('session_date', to),
    // Seguimientos: training sessions marked done in previous period
    supabaseAdmin.from('training_sessions').select('*', { count: 'exact', head: true })
      .eq('is_done', true)
      .gte('session_date', prevFrom).lte('session_date', prevTo),
  ]);

  const tc  = totalCurrent ?? 0;
  const tp  = totalPrev    ?? 0;
  const sc  = showsCurrent ?? 0;
  const sp  = showsPrev    ?? 0;
  const nc  = newCurrent   ?? 0;
  const np  = newPrev      ?? 0;
  const nsc = noShowCurrent ?? 0;
  const nsp = noShowPrev    ?? 0;
  const tdc = trainingDoneCurrent ?? 0; // seguimientos asistidos
  const tdp = trainingDonePrev    ?? 0;

  // attendedCount = events asistidos + seguimientos completados
  const attendedCurrent = sc + tdc;
  const attendedPrev    = sp + tdp;

  // Attendance rate denominator = only events with a known outcome (show + no_show*).
  // Excluding 'scheduled' (future) events avoids artificially deflating the rate.
  const completedCurrent = attendedCurrent + nsc;
  const completedPrev    = attendedPrev    + nsp;

  const attendanceRateCurrent = completedCurrent > 0 ? Math.round((attendedCurrent / completedCurrent) * 100) : 0;
  const attendanceRatePrev    = completedPrev    > 0 ? Math.round((attendedPrev    / completedPrev)    * 100) : 0;

  return {
    totalAppointments:     { value: tc,  previousValue: tp,  ...calcTrend(tc, tp) },
    attendanceRate:        { value: attendanceRateCurrent, previousValue: attendanceRatePrev, ...calcTrend(attendanceRateCurrent, attendanceRatePrev) },
    activeAthletes:        { value: activeAthletes ?? 0, previousValue: 0, trend: 'neutral', trendPercent: 0 },
    newRegistrations:      { value: nc,  previousValue: np,  ...calcTrend(nc, np) },
    scheduledAppointments: { value: scheduledCount ?? 0, previousValue: 0, trend: 'neutral', trendPercent: 0 },
    noShowAppointments:    { value: nsc, previousValue: nsp, ...calcTrend(nsc, nsp) },
    attendedCount:         { value: attendedCurrent, previousValue: attendedPrev, ...calcTrend(attendedCurrent, attendedPrev) },
  };
}

// ─── SERVICIOS ──────────────────────────────────────────────────────────────────────────────────────────

export async function fetchServiceStats(
  from: string, to: string,
  prevFrom: string, prevTo: string,
): Promise<ServiceStat[]> {
  await requireAdminAccess();

  const [{ data: current }, { data: prev }] = await Promise.all([
    supabaseAdmin.from('events').select('title')
      .gte('start_at', fromISO(from)).lte('start_at', toISO(to)),
    supabaseAdmin.from('events').select('title')
      .gte('start_at', fromISO(prevFrom)).lte('start_at', toISO(prevTo)),
  ]);

  const countBy = (rows: { title: string | null }[]) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      const st = titleToServiceType(r.title ?? '');
      return { ...acc, [st]: (acc[st] ?? 0) + 1 };
    }, {});

  const currCounts = countBy(current ?? []);
  const prevCounts = countBy(prev ?? []);
  const total = Object.values(currCounts).reduce((a, b) => a + b, 0);

  return (Object.keys(SERVICE_LABELS) as ServiceType[]).map(st => {
    const count        = currCounts[st] ?? 0;
    const previousCount = prevCounts[st] ?? 0;
    const { trend }    = calcTrend(count, previousCount);
    return {
      service_type: st,
      label:        SERVICE_LABELS[st],
      count,
      percentage:   total > 0 ? Math.round((count / total) * 100) : 0,
      previousCount,
      trend,
    };
  }).sort((a, b) => b.count - a.count);
}

// ─── CITAS RECIENTES (resumen en página, últimas 20) ───────────────────────────────────────────────

export async function fetchRecentAppointments(from: string, to: string): Promise<Appointment[]> {
  await requireAdminAccess();

  const { data } = await supabaseAdmin
    .from('events')
    .select(EVENT_SELECT)
    .gte('start_at', fromISO(from)).lte('start_at', toISO(to))
    .order('start_at', { ascending: false })
    .limit(20);

  const rows = (data ?? []) as unknown as RawEventRow[];
  const ids  = rows.flatMap(r => r.event_participants?.map(p => p.participant_id) ?? []);
  const aMap = await fetchAthleteMap([...new Set(ids)]);
  return rows.map((r) => toAppointment(r, aMap));
}

// ─── CITAS FILTRADAS (drawer con paginación) ─────────────────────────────────────────────────────

export async function fetchFilteredAppointments(
  from: string,
  to: string,
  filters: AppointmentFilters,
  page: number,
  pageSize = 20,
): Promise<{ data: Appointment[]; total: number }> {
  await requireAdminAccess();

  let query = supabaseAdmin
    .from('events')
    .select(EVENT_SELECT, { count: 'exact' })
    .gte('start_at', fromISO(filters.dateFrom || from))
    .lte('start_at', toISO(filters.dateTo || to))
    .order('start_at', { ascending: false });

  // Map AppointmentStatus back to events.status
  if (filters.status !== 'all') {
    const evStatus = filters.status === 'confirmed' ? 'scheduled' : filters.status;
    query = query.eq('status', evStatus);
  }

  const offset = page * pageSize;
  query = query.range(offset, offset + pageSize - 1);

  const { data, count } = await query;

  const rows = (data ?? []) as unknown as RawEventRow[];
  const ids  = rows.flatMap(r => r.event_participants?.map(p => p.participant_id) ?? []);
  const aMap = await fetchAthleteMap([...new Set(ids)]);
  let results = rows.map((r) => toAppointment(r, aMap));

  // Service type filter is applied client-side (derived from title)
  if (filters.serviceType !== 'all') {
    results = results.filter(a => a.service_type === filters.serviceType);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(a =>
      a.athlete.full_name.toLowerCase().includes(q) ||
      a.specialist.full_name.toLowerCase().includes(q)
    );
  }

  return { data: results, total: count ?? 0 };
}

// ─── CITAS PARA EXPORTACIÓN ──────────────────────────────────────────────────────────────────────────────────

export async function fetchAllAppointmentsForExport(
  from: string,
  to: string,
  filters: AppointmentFilters,
): Promise<Appointment[]> {
  await requireAdminAccess();

  let query = supabaseAdmin
    .from('events')
    .select(EVENT_SELECT)
    .gte('start_at', fromISO(filters.dateFrom || from))
    .lte('start_at', toISO(filters.dateTo || to))
    .order('start_at', { ascending: false });

  if (filters.status !== 'all') {
    const evStatus = filters.status === 'confirmed' ? 'scheduled' : filters.status;
    query = query.eq('status', evStatus);
  }

  const { data } = await query;
  const rows2 = (data ?? []) as unknown as RawEventRow[];
  const ids2  = rows2.flatMap(r => r.event_participants?.map(p => p.participant_id) ?? []);
  const aMap2 = await fetchAthleteMap([...new Set(ids2)]);
  let results = rows2.map((r) => toAppointment(r, aMap2));

  if (filters.serviceType !== 'all') {
    results = results.filter(a => a.service_type === filters.serviceType);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(a =>
      a.athlete.full_name.toLowerCase().includes(q) ||
      a.specialist.full_name.toLowerCase().includes(q)
    );
  }

  return results;
}

// ─── HEATMAP ─────────────────────────────────────────────────────────────────────────────────────

export async function fetchHeatmapData(from: string, to: string): Promise<HeatmapCell[]> {
  await requireAdminAccess();

  const { data } = await supabaseAdmin
    .from('events')
    .select('start_at')
    .gte('start_at', fromISO(from)).lte('start_at', toISO(to));

  const cells: Record<string, number> = {};
  (data ?? []).forEach(({ start_at }: { start_at: string }) => {
    const d = new Date(start_at);
    // Use Mexico City local day/hour for the heatmap
    const mxStr = d.toLocaleString('en-US', { timeZone: 'America/Mexico_City', weekday: 'short', hour: 'numeric', hour12: false });
    const mxDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    const day  = (mxDate.getDay() + 6) % 7; // 0=Lun, 6=Dom
    const hour = mxDate.getHours();
    void mxStr;
    const key  = `${day}-${hour}`;
    cells[key] = (cells[key] ?? 0) + 1;
  });

  const result: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 7; hour <= 22; hour++) {
      result.push({ day, hour, count: cells[`${day}-${hour}`] ?? 0 });
    }
  }
  return result;
}

// ─── RANKING DE ESPECIALISTAS ──────────────────────────────────────────────────────────────────────────────────

export async function fetchSpecialistRanking(from: string, to: string): Promise<SpecialistLoad[]> {
  await requireAdminAccess();

  const { data } = await supabaseAdmin
    .from('events')
    .select('created_by_profile_id, creator:profiles!created_by_profile_id(id, first_name, last_name, role)')
    .gte('start_at', fromISO(from)).lte('start_at', toISO(to));

  const counts: Record<string, { full_name: string; specialty: string; count: number }> = {};
  (data ?? []).forEach((row: RawCreatorRow) => {
    const id = row.created_by_profile_id;
    if (!id) return;
    const sp = one(row.creator);
    if (!counts[id]) {
      const name = [sp?.first_name, sp?.last_name].filter(Boolean).join(' ') || '';
      counts[id] = { full_name: name, specialty: sp?.role ?? '', count: 0 };
    }
    counts[id].count++;
  });

  return Object.entries(counts)
    .map(([id, info]) => ({
      id,
      full_name:          info.full_name,
      specialty:          info.specialty,
      appointmentCount:   info.count,
      capacity:           40,
      utilizationPercent: Math.round((info.count / 40) * 100),
    }))
    .sort((a, b) => b.appointmentCount - a.appointmentCount)
    .slice(0, 5);
}

// ─── ACTUALIZAR ESTADO DE CITA ─────────────────────────────────────────────────────────────────────────────

export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'show' | 'no_show',
  extras?: { notes?: string; no_show_reason?: string },
) {
  await requireAdminAccess();

  // Update events.status
  const { error } = await supabaseAdmin
    .from('events')
    .update({
      status,
      ...(extras?.notes && { description: extras.notes }),
    })
    .eq('id', appointmentId);

  if (error) throw error;

  // Sync event_participants.attendance_status
  await supabaseAdmin
    .from('event_participants')
    .update({ attendance_status: status })
    .eq('event_id', appointmentId);
}

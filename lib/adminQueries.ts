'use server';

import { supabaseAdmin }    from '@/lib/supabase-admin';
import { requireAdminAccess } from '@/lib/rbac/server';
import { calcTrend }        from '@/lib/periods';
import type {
  Appointment, AppointmentFilters, HeatmapCell,
  KpiSet, ServiceStat, SpecialistLoad, ServiceType,
} from '@/lib/types/admin';

// ─── Internal types for raw Supabase rows ─────────────────────────────────────

type RawProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

type RawAppointmentRow = {
  id: string;
  date: string;
  time: string;
  status: string;
  notes: string | null;
  service_type: string;
  original_date: string | null;
  original_appointment_id: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  no_show_reason: string | null;
  reschedule_reason: string | null;
  athlete: RawProfile | RawProfile[] | null;
  specialist: RawProfile | RawProfile[] | null;
};

type RawSpecialistRow = {
  specialist_id: string;
  specialist: Pick<RawProfile, 'id' | 'first_name' | 'last_name' | 'role'>
    | Pick<RawProfile, 'id' | 'first_name' | 'last_name' | 'role'>[]  | null;
};

// ─── Select fragments ─────────────────────────────────────────────────────────
const APPOINTMENT_SELECT = `
  id, date, time, status, notes, service_type,
  original_date, original_appointment_id,
  confirmed_by, confirmed_at, no_show_reason, reschedule_reason,
  athlete:profiles!athlete_id(id, first_name, last_name, email, avatar_url),
  specialist:profiles!specialist_id(id, first_name, last_name, role)
`;

// Supabase may return the FK join as an array (when using !foreign_key notation)
// or as a single object. This helper normalises both.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function toAppointment(raw: RawAppointmentRow): Appointment {
  const athlete     = one(raw.athlete);
  const specialist  = one(raw.specialist);

  const athleteName    = [athlete?.first_name, athlete?.last_name].filter(Boolean).join(' ')
    || athlete?.email || '';
  const specialistName = [specialist?.first_name, specialist?.last_name].filter(Boolean).join(' ') || '';

  // Construct explicitly — avoids spread merging RawAppointmentRow fields into Appointment
  const appointment: Appointment = {
    id:                      raw.id,
    date:                    raw.date,
    time:                    raw.time,
    // Cast status string to the typed union — values come from our own DB enum.
    status:                  raw.status as Appointment['status'],
    notes:                   raw.notes,
    service_type:            raw.service_type as Appointment['service_type'],
    original_date:           raw.original_date,
    original_appointment_id: raw.original_appointment_id,
    confirmed_by:            raw.confirmed_by,
    confirmed_at:            raw.confirmed_at,
    no_show_reason:          raw.no_show_reason,
    reschedule_reason:       raw.reschedule_reason,
    athlete: {
      id:         athlete?.id ?? '',
      full_name:  athleteName,
      email:      athlete?.email ?? '',
      avatar_url: athlete?.avatar_url ?? null,
    },
    specialist: {
      id:        specialist?.id ?? '',
      full_name: specialistName,
      specialty: specialist?.role ?? '',
    },
  };
  return appointment;
}

const SERVICE_LABELS: Record<ServiceType, string> = {
  medico: 'Consulta Médica',
  nutricion: 'Nutrición',
  fisioterapia: 'Fisioterapia',
  psicologia: 'Psicología',
  evaluacion: 'Evaluación de Rendimiento',
  entrenamiento: 'Plan de Entrenamiento',
};

// ─── KPIs ───────────────────────────────────────────────────────────────────────────────────

export async function fetchKpis(
  from: string, to: string,
  prevFrom: string, prevTo: string,
): Promise<KpiSet> {
  await requireAdminAccess();

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

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
  ] = await Promise.all([
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).gte('date', from).lte('date', to),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).gte('date', prevFrom).lte('date', prevTo),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'show').gte('date', from).lte('date', to),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'show').gte('date', prevFrom).lte('date', prevTo),
    // Count only athletes with status='active' (athletes table, not profiles)
    supabaseAdmin.from('athletes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('athletes').select('*', { count: 'exact', head: true }).eq('status', 'active').gte('created_at', from).lte('created_at', to),
    supabaseAdmin.from('athletes').select('*', { count: 'exact', head: true }).eq('status', 'active').gte('created_at', prevFrom).lte('created_at', prevTo),
    // Citas programadas: confirmed + future date (global — not period-filtered)
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'confirmed').gte('date', today),
    // No shows in current period
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'no_show').gte('date', from).lte('date', to),
    // No shows in previous period (for trend)
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'no_show').gte('date', prevFrom).lte('date', prevTo),
  ]);

  const tc  = totalCurrent ?? 0;
  const tp  = totalPrev    ?? 0;
  const sc  = showsCurrent ?? 0;
  const sp  = showsPrev    ?? 0;
  const nc  = newCurrent   ?? 0;
  const np  = newPrev      ?? 0;
  const nsc = noShowCurrent ?? 0;
  const nsp = noShowPrev    ?? 0;

  const attendanceRateCurrent = tc > 0 ? Math.round((sc / tc) * 100) : 0;
  const attendanceRatePrev    = tp > 0 ? Math.round((sp / tp) * 100) : 0;

  return {
    totalAppointments:     { value: tc,  previousValue: tp,  ...calcTrend(tc, tp) },
    attendanceRate:        { value: attendanceRateCurrent, previousValue: attendanceRatePrev, ...calcTrend(attendanceRateCurrent, attendanceRatePrev) },
    activeAthletes:        { value: activeAthletes ?? 0, previousValue: 0, trend: 'neutral', trendPercent: 0 },
    newRegistrations:      { value: nc,  previousValue: np,  ...calcTrend(nc, np) },
    scheduledAppointments: { value: scheduledCount ?? 0, previousValue: 0, trend: 'neutral', trendPercent: 0 },
    noShowAppointments:    { value: nsc, previousValue: nsp, ...calcTrend(nsc, nsp) },
  };
}

// ─── SERVICIOS ────────────────────────────────────────────────────────────────────────────

export async function fetchServiceStats(
  from: string, to: string,
  prevFrom: string, prevTo: string,
): Promise<ServiceStat[]> {
  await requireAdminAccess();

  const [{ data: current }, { data: prev }] = await Promise.all([
    supabaseAdmin.from('appointments').select('service_type').gte('date', from).lte('date', to),
    supabaseAdmin.from('appointments').select('service_type').gte('date', prevFrom).lte('date', prevTo),
  ]);

  const countBy = (rows: { service_type: string }[]) =>
    rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.service_type]: (acc[r.service_type] ?? 0) + 1 }), {});

  const currCounts = countBy(current ?? []);
  const prevCounts = countBy(prev ?? []);
  const total = Object.values(currCounts).reduce((a, b) => a + b, 0);

  return (Object.keys(SERVICE_LABELS) as ServiceType[]).map(st => {
    const count        = currCounts[st] ?? 0;
    const previousCount = prevCounts[st] ?? 0;
    const { trend }    = calcTrend(count, previousCount);
    return {
      service_type: st,
      label: SERVICE_LABELS[st],
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      previousCount,
      trend,
    };
  }).sort((a, b) => b.count - a.count);
}

// ─── CITAS RECIENTES (resumen en página, últimas 20) ────────────────────────────────────

export async function fetchRecentAppointments(from: string, to: string): Promise<Appointment[]> {
  await requireAdminAccess();

  const { data } = await supabaseAdmin
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .gte('date', from).lte('date', to)
    .order('date', { ascending: false })
    .limit(20);

  return (data ?? []).map((r) => toAppointment(r as unknown as RawAppointmentRow));
}

// ─── CITAS FILTRADAS (drawer con paginación) ──────────────────────────────────────────────

export async function fetchFilteredAppointments(
  from: string,
  to: string,
  filters: AppointmentFilters,
  page: number,
  pageSize = 20,
): Promise<{ data: Appointment[]; total: number }> {
  await requireAdminAccess();

  let query = supabaseAdmin
    .from('appointments')
    .select(APPOINTMENT_SELECT, { count: 'exact' })
    .gte('date', filters.dateFrom || from)
    .lte('date', filters.dateTo || to)
    .order('date', { ascending: false });

  if (filters.serviceType !== 'all') query = query.eq('service_type', filters.serviceType);
  if (filters.status !== 'all')      query = query.eq('status', filters.status);

  const offset = page * pageSize;
  query = query.range(offset, offset + pageSize - 1);

  const { data, count } = await query;

  let results = (data ?? []).map((r) => toAppointment(r as unknown as RawAppointmentRow));
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(a =>
      a.athlete.full_name.toLowerCase().includes(q) ||
      a.specialist.full_name.toLowerCase().includes(q)
    );
  }

  return { data: results, total: count ?? 0 };
}

// ─── CITAS PARA EXPORTACIÓN (todos los registros del filtro) ──────────────────────────────

export async function fetchAllAppointmentsForExport(
  from: string,
  to: string,
  filters: AppointmentFilters,
): Promise<Appointment[]> {
  await requireAdminAccess();

  let query = supabaseAdmin
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .gte('date', filters.dateFrom || from)
    .lte('date', filters.dateTo || to)
    .order('date', { ascending: false });

  if (filters.serviceType !== 'all') query = query.eq('service_type', filters.serviceType);
  if (filters.status !== 'all')      query = query.eq('status', filters.status);

  const { data } = await query;
  let results = (data ?? []).map((r) => toAppointment(r as unknown as RawAppointmentRow));

  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(a =>
      a.athlete.full_name.toLowerCase().includes(q) ||
      a.specialist.full_name.toLowerCase().includes(q)
    );
  }

  return results;
}

// ─── HEATMAP ────────────────────────────────────────────────────────────────────────────

export async function fetchHeatmapData(from: string, to: string): Promise<HeatmapCell[]> {
  await requireAdminAccess();

  const { data } = await supabaseAdmin
    .from('appointments')
    .select('date, time')
    .gte('date', from).lte('date', to);

  const cells: Record<string, number> = {};
  (data ?? []).forEach(({ date, time }: { date: string; time: string }) => {
    const d = new Date(`${date}T${time}`);
    const day  = (d.getDay() + 6) % 7; // 0=Lun, 6=Dom
    const hour = d.getHours();
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

// ─── RANKING DE ESPECIALISTAS ─────────────────────────────────────────────────────────────

export async function fetchSpecialistRanking(from: string, to: string): Promise<SpecialistLoad[]> {
  await requireAdminAccess();

  const { data } = await supabaseAdmin
    .from('appointments')
    .select('specialist_id, specialist:profiles!specialist_id(id, first_name, last_name, role)')
    .gte('date', from).lte('date', to);

  const counts: Record<string, { full_name: string; specialty: string; count: number }> = {};
  (data ?? []).forEach((row: RawSpecialistRow) => {
    const id  = row.specialist_id;
    const sp  = one(row.specialist);
    if (!counts[id]) {
      const name = [sp?.first_name, sp?.last_name].filter(Boolean).join(' ') || '';
      counts[id] = { full_name: name, specialty: sp?.role ?? '', count: 0 };
    }
    counts[id].count++;
  });

  return Object.entries(counts)
    .map(([id, info]) => ({
      id,
      full_name: info.full_name,
      specialty: info.specialty,
      appointmentCount: info.count,
      capacity: 40,
      utilizationPercent: Math.round((info.count / 40) * 100),
    }))
    .sort((a, b) => b.appointmentCount - a.appointmentCount)
    .slice(0, 5);
}

// ─── ACTUALIZAR ESTADO DE CITA ────────────────────────────────────────────

export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'show' | 'no_show',
  extras?: { notes?: string; no_show_reason?: string },
) {
  // Auth guard: only admin-level staff can confirm/update appointments
  const adminUser = await requireAdminAccess();
  const confirmedBy = adminUser.profile?.id ?? null;

  const { error } = await supabaseAdmin
    .from('appointments')
    .update({
      status,
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString(),
      ...(extras?.notes          && { notes: extras.notes }),
      ...(extras?.no_show_reason && { no_show_reason: extras.no_show_reason }),
    })
    .eq('id', appointmentId);

  if (error) throw error;
}

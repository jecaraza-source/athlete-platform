import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { calcTrend } from '@/lib/periods';
import type {
  Appointment, AppointmentFilters, HeatmapCell,
  KpiSet, ServiceStat, SpecialistLoad, ServiceType,
} from '@/lib/types/admin';

// ─── Select fragments ─────────────────────────────────────────────────────────
// profiles doesn't have full_name or specialty — use first_name/last_name/role
const APPOINTMENT_SELECT = `
  id, date, time, status, notes, service_type,
  original_date, original_appointment_id,
  confirmed_by, confirmed_at, no_show_reason, reschedule_reason,
  athlete:profiles!athlete_id(id, first_name, last_name, email, avatar_url),
  specialist:profiles!specialist_id(id, first_name, last_name, role)
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAppointment(raw: any): Appointment {
  const athleteName = [raw.athlete?.first_name, raw.athlete?.last_name].filter(Boolean).join(' ')
    || raw.athlete?.email || '';
  const specialistName = [raw.specialist?.first_name, raw.specialist?.last_name].filter(Boolean).join(' ') || '';
  return {
    ...raw,
    athlete: {
      id:         raw.athlete?.id ?? '',
      full_name:  athleteName,
      email:      raw.athlete?.email ?? '',
      avatar_url: raw.athlete?.avatar_url ?? null,
    },
    specialist: {
      id:        raw.specialist?.id ?? '',
      full_name: specialistName,
      specialty: raw.specialist?.role ?? '',
    },
  };
}

const SERVICE_LABELS: Record<ServiceType, string> = {
  medico: 'Consulta Médica',
  nutricion: 'Nutrición',
  fisioterapia: 'Fisioterapia',
  psicologia: 'Psicología',
  evaluacion: 'Evaluación de Rendimiento',
  entrenamiento: 'Plan de Entrenamiento',
};

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export async function fetchKpis(
  from: string, to: string,
  prevFrom: string, prevTo: string,
): Promise<KpiSet> {
  const supabase = createSupabaseBrowserClient();

  const [
    { count: totalCurrent },
    { count: totalPrev },
    { count: showsCurrent },
    { count: showsPrev },
    { count: activeAthletes },
    { count: newCurrent },
    { count: newPrev },
  ] = await Promise.all([
    supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('date', from).lte('date', to),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('date', prevFrom).lte('date', prevTo),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'show').gte('date', from).lte('date', to),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'show').gte('date', prevFrom).lte('date', prevTo),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'athlete'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'athlete').gte('created_at', from).lte('created_at', to),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'athlete').gte('created_at', prevFrom).lte('created_at', prevTo),
  ]);

  const tc = totalCurrent ?? 0;
  const tp = totalPrev ?? 0;
  const sc = showsCurrent ?? 0;
  const sp = showsPrev ?? 0;
  const nc = newCurrent ?? 0;
  const np = newPrev ?? 0;

  const attendanceRateCurrent = tc > 0 ? Math.round((sc / tc) * 100) : 0;
  const attendanceRatePrev    = tp > 0 ? Math.round((sp / tp) * 100) : 0;

  return {
    totalAppointments: { value: tc, previousValue: tp, ...calcTrend(tc, tp) },
    attendanceRate:    { value: attendanceRateCurrent, previousValue: attendanceRatePrev, ...calcTrend(attendanceRateCurrent, attendanceRatePrev) },
    activeAthletes:    { value: activeAthletes ?? 0, previousValue: 0, trend: 'neutral', trendPercent: 0 },
    newRegistrations:  { value: nc, previousValue: np, ...calcTrend(nc, np) },
  };
}

// ─── SERVICIOS ────────────────────────────────────────────────────────────────

export async function fetchServiceStats(
  from: string, to: string,
  prevFrom: string, prevTo: string,
): Promise<ServiceStat[]> {
  const supabase = createSupabaseBrowserClient();

  const [{ data: current }, { data: prev }] = await Promise.all([
    supabase.from('appointments').select('service_type').gte('date', from).lte('date', to),
    supabase.from('appointments').select('service_type').gte('date', prevFrom).lte('date', prevTo),
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

// ─── CITAS RECIENTES (resumen en página, últimas 20) ──────────────────────────

export async function fetchRecentAppointments(from: string, to: string): Promise<Appointment[]> {
  const supabase = createSupabaseBrowserClient();

  const { data } = await supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .gte('date', from).lte('date', to)
    .order('date', { ascending: false })
    .limit(20);

  return (data ?? []).map(toAppointment);
}

// ─── CITAS FILTRADAS (drawer con paginación) ──────────────────────────────────

export async function fetchFilteredAppointments(
  from: string,
  to: string,
  filters: AppointmentFilters,
  page: number,
  pageSize = 20,
): Promise<{ data: Appointment[]; total: number }> {
  const supabase = createSupabaseBrowserClient();

  let query = supabase
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

  let results = (data ?? []).map(toAppointment);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(a =>
      a.athlete.full_name.toLowerCase().includes(q) ||
      a.specialist.full_name.toLowerCase().includes(q)
    );
  }

  return { data: results, total: count ?? 0 };
}

// ─── CITAS PARA EXPORTACIÓN (todos los registros del filtro) ──────────────────

export async function fetchAllAppointmentsForExport(
  from: string,
  to: string,
  filters: AppointmentFilters,
): Promise<Appointment[]> {
  const supabase = createSupabaseBrowserClient();

  let query = supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .gte('date', filters.dateFrom || from)
    .lte('date', filters.dateTo || to)
    .order('date', { ascending: false });

  if (filters.serviceType !== 'all') query = query.eq('service_type', filters.serviceType);
  if (filters.status !== 'all')      query = query.eq('status', filters.status);

  const { data } = await query;
  let results = (data ?? []).map(toAppointment);

  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(a =>
      a.athlete.full_name.toLowerCase().includes(q) ||
      a.specialist.full_name.toLowerCase().includes(q)
    );
  }

  return results;
}

// ─── HEATMAP ──────────────────────────────────────────────────────────────────

export async function fetchHeatmapData(from: string, to: string): Promise<HeatmapCell[]> {
  const supabase = createSupabaseBrowserClient();

  const { data } = await supabase
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

// ─── RANKING DE ESPECIALISTAS ─────────────────────────────────────────────────

export async function fetchSpecialistRanking(from: string, to: string): Promise<SpecialistLoad[]> {
  const supabase = createSupabaseBrowserClient();

  const { data } = await supabase
    .from('appointments')
    .select('specialist_id, specialist:profiles!specialist_id(id, first_name, last_name, role)')
    .gte('date', from).lte('date', to);

  const counts: Record<string, { full_name: string; specialty: string; count: number }> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data ?? []).forEach((row: any) => {
    const id = row.specialist_id;
    if (!counts[id]) {
      const name = [row.specialist?.first_name, row.specialist?.last_name].filter(Boolean).join(' ') || '';
      counts[id] = { full_name: name, specialty: row.specialist?.role ?? '', count: 0 };
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

// ─── ACTUALIZAR ESTADO DE CITA ────────────────────────────────────────────────

export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'show' | 'no_show',
  currentUserId: string,
  extras?: { notes?: string; no_show_reason?: string },
) {
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase
    .from('appointments')
    .update({
      status,
      confirmed_by: currentUserId,
      confirmed_at: new Date().toISOString(),
      ...(extras?.notes           && { notes: extras.notes }),
      ...(extras?.no_show_reason  && { no_show_reason: extras.no_show_reason }),
    })
    .eq('id', appointmentId);

  if (error) throw error;
}

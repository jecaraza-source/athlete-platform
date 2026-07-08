'use server';
// =============================================================================
// lib/adminReportQueries.ts
// Data queries for the "Resumen Metas Plataforma" report.
//
// Sections:
//   1. Health services — counts events (by service type + status) and
//      follow-up session notes for Médico, Nutrición, Psicología, Fisioterapia.
//   2. Coaches — training_sessions + plans (type='training') per coach,
//      grouped by their discipline.
// =============================================================================

import { supabaseAdmin }      from '@/lib/supabase-admin';
import { requireReportAccess } from '@/lib/rbac/server';
import type {
  ReportData, ReportServiceRow, ReportCoachRow, ServiceType,
} from '@/lib/types/admin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fromISO(date: string): string { return `${date}T00:00:00`; }
function toISO(date: string):   string { return `${date}T23:59:59`; }

// Same keyword mapping as adminQueries.ts (not exported there, so duplicated here)
const SERVICE_KEYWORDS: [string, ServiceType][] = [
  ['fisio',    'fisioterapia'],
  ['psicol',   'psicologia'],
  ['nutri',    'nutricion'],
  ['entrena',  'entrenamiento'],
  ['evalua',   'evaluacion'],
];

function titleToServiceType(title: string): ServiceType {
  const t = (title || '').toLowerCase();
  for (const [kw, type] of SERVICE_KEYWORDS) {
    if (t.includes(kw)) return type;
  }
  return 'medico';
}

// ─── Main query ───────────────────────────────────────────────────────────────

export async function fetchReportData(
  from: string,
  to:   string,
): Promise<ReportData> {
  await requireReportAccess();

  // ── 1. Active athletes (global count, period-independent) ─────────────────
  const { count: activeAthletes } = await supabaseAdmin
    .from('athletes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  // ── 2. Events in period ───────────────────────────────────────────────────
  const { data: events } = await supabaseAdmin
    .from('events')
    .select('title, status')
    .gte('start_at', fromISO(from))
    .lte('start_at', toISO(to));

  // Tally by service type and status
  const HEALTH_SERVICES: ServiceType[] = ['medico', 'nutricion', 'psicologia', 'fisioterapia'];

  type Tally = { scheduled: number; show: number; show_remote: number; no_show: number };
  const tally: Record<ServiceType, Tally> = {} as Record<ServiceType, Tally>;
  HEALTH_SERVICES.forEach((s) => {
    tally[s] = { scheduled: 0, show: 0, show_remote: 0, no_show: 0 };
  });

  (events ?? []).forEach(({ title, status }: { title: string | null; status: string }) => {
    const st = titleToServiceType(title ?? '');
    if (!HEALTH_SERVICES.includes(st)) return; // skip entrenamiento / evaluacion
    tally[st].scheduled++;
    if (status === 'show')                                    tally[st].show++;
    else if (status === 'show_remote')                        tally[st].show_remote++;
    else if (status === 'no_show' || status === 'no_show_remote') tally[st].no_show++;
  });

  // ── 3. Follow-up notes per service (each table has its own date column) ───
  const [
    { count: medNotes },
    { count: nutrNotes },
    { count: psychNotes },
    { count: physioNotes },
  ] = await Promise.all([
    supabaseAdmin.from('medical_sessions').select('*', { count: 'exact', head: true })
      .gte('session_date', from).lte('session_date', to),
    supabaseAdmin.from('nutrition_checkins').select('*', { count: 'exact', head: true })
      .gte('checkin_date', from).lte('checkin_date', to),
    supabaseAdmin.from('psychology_sessions').select('*', { count: 'exact', head: true })
      .gte('session_date', from).lte('session_date', to),
    supabaseAdmin.from('physio_sessions').select('*', { count: 'exact', head: true })
      .gte('session_date', from).lte('session_date', to),
  ]);

  const services: ReportServiceRow[] = [
    {
      service:            'MÉDICO',
      scheduled:          tally.medico.scheduled,
      attendedPresential: tally.medico.show,
      attendedRemote:     tally.medico.show_remote,
      followUpNotes:      medNotes ?? 0,
      noShow:             tally.medico.no_show,
    },
    {
      service:            'NUTRICIÓN',
      scheduled:          tally.nutricion.scheduled,
      attendedPresential: tally.nutricion.show,
      attendedRemote:     tally.nutricion.show_remote,
      followUpNotes:      nutrNotes ?? 0,
      noShow:             tally.nutricion.no_show,
    },
    {
      service:            'PSICOLOGÍA',
      scheduled:          tally.psicologia.scheduled,
      attendedPresential: tally.psicologia.show,
      attendedRemote:     tally.psicologia.show_remote,
      followUpNotes:      psychNotes ?? 0,
      noShow:             tally.psicologia.no_show,
    },
    {
      service:            'FISIOTERAPIA',
      scheduled:          tally.fisioterapia.scheduled,
      attendedPresential: tally.fisioterapia.show,
      attendedRemote:     null, // NO APLICA — physio is presential only
      followUpNotes:      physioNotes ?? 0,
      noShow:             tally.fisioterapia.no_show,
    },
  ];

  // ── 4. Coaches section ─────────────────────────────────────────────────────────────
  //
  // Coach detection strategy (DB facts):
  //   • Coaches are stored in user_roles with role.code='coach' (role_id=3 in this DB)
  //   • Some also have profiles.role='trainer' (legacy column)
  //   • profiles.discipline does NOT exist; the specialty column is 'specialty'
  //   • plans.uploaded_by is NULL for all existing plans — plan count comes from athlete_plans
  //
  // Data sources:
  //   a) user_roles (RBAC)  + profiles.role IN ('coach','trainer') → canonical coach roster
  //   b) training_sessions (all-time) → all-time distinct athletes + notes per coach
  //   c) athlete_plans → plans assigned to athletes (count per plan uploader)

  // 4a. Parallel: coach role lookup + all-time sessions + training plans
  const [
    { data: coachRoleRows },
    { data: allTimeSessions },
    { data: trainingPlans },
  ] = await Promise.all([
    supabaseAdmin.from('roles').select('id').eq('code', 'coach'),
    supabaseAdmin.from('training_sessions').select('athlete_id, coach_profile_id'),
    supabaseAdmin.from('plans').select('id, uploaded_by').eq('type', 'training'),
  ]);

  // 4b. RBAC coach profile IDs
  const coachRoleIds = (coachRoleRows ?? []).map((r: { id: number }) => r.id);
  let rbacCoachIds: string[] = [];
  if (coachRoleIds.length > 0) {
    const { data: urRows } = await supabaseAdmin
      .from('user_roles')
      .select('profile_id')
      .in('role_id', coachRoleIds);
    rbacCoachIds = (urRows ?? []).map((r: { profile_id: string }) => r.profile_id);
  }

  // 4c. Legacy profile IDs (role='coach' or 'trainer' in profiles.role)
  const { data: legacyProfs } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('role', ['coach', 'trainer']);
  const legacyCoachIds = (legacyProfs ?? []).map((p: { id: string }) => p.id);

  // 4d. Sessions in period — for NOTAS DE SEGUIMIENTO count only
  const { data: periodSessions } = await supabaseAdmin
    .from('training_sessions')
    .select('coach_profile_id')
    .gte('session_date', from)
    .lte('session_date', to);

  // Per-coach notes (period)
  type SessionAgg = { notes: number };
  const sessionAgg: Record<string, SessionAgg> = {};
  (periodSessions ?? []).forEach((s: { coach_profile_id: string | null }) => {
    const cid = s.coach_profile_id;
    if (!cid) return;
    if (!sessionAgg[cid]) sessionAgg[cid] = { notes: 0 };
    sessionAgg[cid].notes++;
  });

  // Per-coach distinct athletes from ALL-TIME sessions
  const sessionAthletes: Record<string, Set<string>> = {};
  (allTimeSessions ?? []).forEach(
    (s: { coach_profile_id: string | null; athlete_id: string | null }) => {
      const cid = s.coach_profile_id;
      if (!cid || !s.athlete_id) return;
      if (!sessionAthletes[cid]) sessionAthletes[cid] = new Set();
      sessionAthletes[cid].add(s.athlete_id);
    },
  );

  // 4e. Athlete plan assignments (all-time) — count plans per uploader
  const planIds = (trainingPlans ?? []).map((p: { id: string }) => p.id);
  let athletePlanRows: { plan_id: string; athlete_id: string }[] = [];
  if (planIds.length > 0) {
    const { data: apRows } = await supabaseAdmin
      .from('athlete_plans')
      .select('plan_id, athlete_id')
      .in('plan_id', planIds);
    athletePlanRows = apRows ?? [];
  }

  const planToCoach: Record<string, string | null> = {};
  (trainingPlans ?? []).forEach((p: { id: string; uploaded_by: string | null }) => {
    planToCoach[p.id] = p.uploaded_by;
  });

  const plansWithAssignments = new Set(athletePlanRows.map((ap) => ap.plan_id));

  type PlanAgg = { planIds: Set<string> };
  const planAgg: Record<string, PlanAgg> = {};
  (trainingPlans ?? []).forEach((p: { id: string; uploaded_by: string | null }) => {
    if (!p.uploaded_by || !plansWithAssignments.has(p.id)) return;
    if (!planAgg[p.uploaded_by]) planAgg[p.uploaded_by] = { planIds: new Set() };
    planAgg[p.uploaded_by].planIds.add(p.id);
  });

  // 4f. Build final coach ID list (union of all sources)
  const allCoachIds = [
    ...new Set([
      ...rbacCoachIds,
      ...legacyCoachIds,
      ...Object.keys(sessionAgg),
      ...Object.keys(sessionAthletes),
    ]),
  ];

  let coaches: ReportCoachRow[] = [];

  if (allCoachIds.length > 0) {
    // Fetch profiles using 'specialty' (the correct column; 'discipline' does not exist in this DB)
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, specialty')
      .in('id', allCoachIds);

    coaches = (
      (profiles ?? []) as {
        id:         string;
        first_name: string;
        last_name:  string;
        specialty:  string | null;
      }[]
    )
      .map((p) => ({
        coachId:       p.id,
        coachName:     `${p.first_name} ${p.last_name}`.trim(),
        discipline:    p.specialty ?? 'Sin especialidad',
        totalAthletes: sessionAthletes[p.id]?.size ?? 0,
        totalPlans:    planAgg[p.id]?.planIds.size  ?? 0,
        totalNotes:    sessionAgg[p.id]?.notes       ?? 0,
      }))
      .sort((a, b) => a.discipline.localeCompare(b.discipline, 'es'));
  }

  return {
    activeAthletes: activeAthletes ?? 0,
    from,
    to,
    services,
    coaches,
  };
}

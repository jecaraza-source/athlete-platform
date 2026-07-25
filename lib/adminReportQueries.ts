'use server';
// =============================================================================
// lib/adminReportQueries.ts
// Data queries for the "Resumen Metas Plataforma" report.
//
// Sections:
//   1. Health services — event counts by service type + status + follow-up notes.
//   2. Coaches — training_sessions + plans per coach grouped by discipline.
//   3. Staff Médico — event counts per individual medical staff member.
//   4. Por Disciplina — athlete attendance and plan assignment per discipline.
// =============================================================================

import { supabaseAdmin }       from '@/lib/supabase-admin';
import { requireReportAccess }  from '@/lib/rbac/server';
import { DISCIPLINES }          from '@/lib/types/diagnostic';
import type {
  ReportData, ReportServiceRow, ReportCoachRow, ServiceType,
  ReportStaffMemberRow, ReportDisciplineRow,
} from '@/lib/types/admin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fromISO(date: string): string { return `${date}T00:00:00`; }
function toISO(date: string):   string { return `${date}T23:59:59`; }

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

const MEDICAL_STAFF_ROLES = ['medic', 'nutritionist', 'physio', 'psychologist'] as const;

const STAFF_ROLE_LABELS: Record<string, string> = {
  medic:        'Médico',
  nutritionist: 'Nutricionista',
  physio:       'Fisioterapeuta',
  psychologist: 'Psicólogo/a',
};

// ─── Main query ───────────────────────────────────────────────────────────────

export async function fetchReportData(
  from: string,
  to:   string,
): Promise<ReportData> {
  await requireReportAccess();

  // ── Round 1: All independent queries run in parallel ─────────────────────
  const [
    { count: activeAthletes },
    { data: events },
    { count: medNotes },
    { count: nutrNotes },
    { count: psychNotes },
    { count: physioNotes },
    { data: coachRoleRows },
    { data: allTimeSessions },
    { data: trainingPlans },
    { data: periodSessions },
    { data: legacyProfs },
    { data: medStaffProfiles },
    { data: allActiveAthletes },
    { data: allAthletePlans },
  ] = await Promise.all([
    // 0. Active athletes count (global)
    supabaseAdmin.from('athletes')
      .select('*', { count: 'exact', head: true }).eq('status', 'active'),
    // 1. Events in period — include id + creator + start_at for staff/upcoming logic
    supabaseAdmin.from('events')
      .select('id, title, status, created_by_profile_id, start_at')
      .gte('start_at', fromISO(from)).lte('start_at', toISO(to)),
    // 2-5. Follow-up session notes per service
    supabaseAdmin.from('medical_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('session_date', from).lte('session_date', to),
    supabaseAdmin.from('nutrition_checkins')
      .select('*', { count: 'exact', head: true })
      .gte('checkin_date', from).lte('checkin_date', to),
    supabaseAdmin.from('psychology_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('session_date', from).lte('session_date', to),
    supabaseAdmin.from('physio_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('session_date', from).lte('session_date', to),
    // 6-8. Coach detection sources
    supabaseAdmin.from('roles').select('id').eq('code', 'coach'),
    supabaseAdmin.from('training_sessions').select('athlete_id, coach_profile_id'),
    supabaseAdmin.from('plans').select('id, uploaded_by').eq('type', 'training'),
    // 9. Period training sessions (coach notes count)
    supabaseAdmin.from('training_sessions')
      .select('coach_profile_id')
      .gte('session_date', from).lte('session_date', to),
    // 10. Legacy coach profiles
    supabaseAdmin.from('profiles').select('id').in('role', ['coach', 'trainer']),
    // 11. Medical staff profiles (for staff section)
    supabaseAdmin.from('profiles')
      .select('id, first_name, last_name, role')
      .in('role', MEDICAL_STAFF_ROLES),
    // 12. Active athletes with discipline (for disciplines section)
    supabaseAdmin.from('athletes').select('id, discipline').eq('status', 'active'),
    // 13. All athlete plan assignments — used for both coaches and disciplines
    supabaseAdmin.from('athlete_plans').select('plan_id, athlete_id'),
  ]);

  // ── 1. Services section ───────────────────────────────────────────────────

  // nowUTC is used to classify events as upcoming vs past
  const nowUTC = new Date().toISOString();

  type RawEvent = { id: string; title: string | null; status: string; created_by_profile_id: string | null; start_at: string };

  const HEALTH_SERVICES: ServiceType[] = ['medico', 'nutricion', 'psicologia', 'fisioterapia'];
  type Tally = { scheduled: number; show: number; show_remote: number; no_show: number };
  const tally: Record<ServiceType, Tally> = {} as Record<ServiceType, Tally>;
  HEALTH_SERVICES.forEach((s) => {
    tally[s] = { scheduled: 0, show: 0, show_remote: 0, no_show: 0 };
  });

  (events ?? [] as RawEvent[]).forEach(({ title, status }) => {
    const st = titleToServiceType(title ?? '');
    if (!HEALTH_SERVICES.includes(st)) return;
    tally[st].scheduled++;
    if (status === 'show')                                          tally[st].show++;
    else if (status === 'show_remote')                              tally[st].show_remote++;
    else if (status === 'no_show' || status === 'no_show_remote')   tally[st].no_show++;
  });

  const services: ReportServiceRow[] = [
    { service: 'MÉDICO',       scheduled: tally.medico.scheduled,       attendedPresential: tally.medico.show,       attendedRemote: tally.medico.show_remote,       followUpNotes: medNotes   ?? 0, noShow: tally.medico.no_show },
    { service: 'NUTRICIÓN',    scheduled: tally.nutricion.scheduled,    attendedPresential: tally.nutricion.show,    attendedRemote: tally.nutricion.show_remote,    followUpNotes: nutrNotes  ?? 0, noShow: tally.nutricion.no_show },
    { service: 'PSICOLOGÍA',   scheduled: tally.psicologia.scheduled,   attendedPresential: tally.psicologia.show,   attendedRemote: tally.psicologia.show_remote,   followUpNotes: psychNotes ?? 0, noShow: tally.psicologia.no_show },
    { service: 'FISIOTERAPIA', scheduled: tally.fisioterapia.scheduled, attendedPresential: tally.fisioterapia.show, attendedRemote: null, followUpNotes: physioNotes ?? 0, noShow: tally.fisioterapia.no_show },
  ];

  // ── 2. Staff Médico section ────────────────────────────────────────────────
  //
  // Events are attributed to the staff member who created them (created_by_profile_id).
  // We tally all 5 statuses per medical staff member in the period.

  type MedStaffProfile = { id: string; first_name: string; last_name: string; role: string | null };
  const medStaffIdSet = new Set((medStaffProfiles ?? [] as MedStaffProfile[]).map((p) => p.id));

  type StaffTally = {
    scheduled: number; upcoming: number;
    show: number; show_remote: number; rescheduled: number; no_show: number;
  };
  const staffTally: Record<string, StaffTally> = {};

  (events ?? [] as RawEvent[]).forEach(({ status, created_by_profile_id, start_at }) => {
    const cid = created_by_profile_id;
    if (!cid || !medStaffIdSet.has(cid)) return;
    if (!staffTally[cid]) staffTally[cid] = { scheduled: 0, upcoming: 0, show: 0, show_remote: 0, rescheduled: 0, no_show: 0 };
    staffTally[cid].scheduled++;
    // Upcoming = still in the future and not yet given an outcome
    if (status === 'scheduled' && start_at > nowUTC)               staffTally[cid].upcoming++;
    else if (status === 'show')                                     staffTally[cid].show++;
    else if (status === 'show_remote')                              staffTally[cid].show_remote++;
    else if (status === 'rescheduled')                              staffTally[cid].rescheduled++;
    else if (status === 'no_show' || status === 'no_show_remote')   staffTally[cid].no_show++;
  });

  const staffMembers: ReportStaffMemberRow[] = (
    (medStaffProfiles ?? [] as MedStaffProfile[])
  )
    .filter((p) => staffTally[p.id] !== undefined)
    .map((p) => {
      const t = staffTally[p.id];
      // Attendance rate only counts events with a definitive outcome (show / no_show)
      const outcomeTotal = t.show + t.show_remote + t.no_show;
      return {
        staffId:            p.id,
        staffName:          `${p.first_name} ${p.last_name}`.trim(),
        roleLabel:          STAFF_ROLE_LABELS[p.role ?? ''] ?? p.role ?? '',
        scheduled:          t.scheduled,
        upcoming:           t.upcoming,
        attendedPresential: t.show,
        attendedRemote:     t.show_remote,
        rescheduled:        t.rescheduled,
        noShow:             t.no_show,
        attendanceRate:     outcomeTotal > 0
          ? Math.round(((t.show + t.show_remote) / outcomeTotal) * 100)
          : null,
      };
    })
    .sort((a, b) => a.roleLabel.localeCompare(b.roleLabel, 'es') || a.staffName.localeCompare(b.staffName, 'es'));

  // ── Round 2: RBAC coaches + event participants (parallel) ─────────────────

  const coachRoleIds  = (coachRoleRows ?? []).map((r: { id: number }) => r.id);
  const periodEventIds = (events ?? [] as RawEvent[]).map((e) => e.id);

  // Build EP chunk queries (avoids PostgREST URL-length limits on large .in() sets)
  const EP_CHUNK = 500;
  const epChunks: string[][] = [];
  for (let i = 0; i < periodEventIds.length; i += EP_CHUNK) {
    epChunks.push(periodEventIds.slice(i, i + EP_CHUNK));
  }

  // Parallel: RBAC coach lookup + event-participant chunks
  const [rbacUrRowsResult, ...epChunkResults] = await Promise.all([
    coachRoleIds.length > 0
      ? supabaseAdmin.from('user_roles').select('profile_id').in('role_id', coachRoleIds)
          .then((r) => r.data ?? [] as { profile_id: string }[])
      : Promise.resolve([] as { profile_id: string }[]),
    ...epChunks.map((chunk) =>
      supabaseAdmin.from('event_participants')
        .select('event_id, participant_id')
        .in('event_id', chunk)
        .eq('participant_type', 'athlete')
        .then((r) => r.data ?? [] as { event_id: string; participant_id: string }[])
    ),
  ]);

  const rbacCoachIds = (rbacUrRowsResult as { profile_id: string }[]).map((r) => r.profile_id);
  const eventParticipants = (epChunkResults as { event_id: string; participant_id: string }[][]).flat();

  // ── 3. Disciplines section ─────────────────────────────────────────────────
  //
  // Uses the DISCIPLINES constant (same values stored in athletes.discipline).
  // Per discipline, we count:
  //   • totalAthletes    — registered active athletes in this discipline
  //   • athletesAttended — distinct athletes with at least 1 show/show_remote
  //   • athletesNoShow   — distinct athletes with at least 1 no_show/no_show_remote
  //   • athletesWithPlans — distinct athletes with at least 1 plan (all-time)

  // Build athlete → event-statuses + event-start_at maps for discipline aggregation
  const eventStatusMap = new Map<string, string>();
  const eventStartMap  = new Map<string, string>();
  (events ?? [] as RawEvent[]).forEach((e) => {
    eventStatusMap.set(e.id, e.status);
    eventStartMap.set(e.id, e.start_at);
  });

  const athleteStatuses  = new Map<string, Set<string>>();
  const athleteHasUpcoming = new Set<string>(); // athletes with at least 1 future scheduled event
  eventParticipants.forEach(({ event_id, participant_id }) => {
    const evStatus  = eventStatusMap.get(event_id);
    const evStartAt = eventStartMap.get(event_id);
    if (!evStatus) return;
    if (!athleteStatuses.has(participant_id)) athleteStatuses.set(participant_id, new Set());
    athleteStatuses.get(participant_id)!.add(evStatus);
    if (evStatus === 'scheduled' && evStartAt && evStartAt > nowUTC) {
      athleteHasUpcoming.add(participant_id);
    }
  });

  // Athletes who have any medical appointment participant in the period (for coaches section)
  const athletesWithPeriodApts = new Set(eventParticipants.map((ep) => ep.participant_id));

  // Athletes who have at least 1 plan assigned (all-time)
  type AthletePlanRow = { plan_id: string; athlete_id: string };
  const athletesWithPlanSet = new Set(
    (allAthletePlans ?? [] as AthletePlanRow[]).map((ap) => ap.athlete_id)
  );

  // Group active athletes by discipline code
  type ActiveAthlete = { id: string; discipline: string | null };
  const discAthletes = new Map<string, Set<string>>();
  (allActiveAthletes ?? [] as ActiveAthlete[]).forEach(({ id, discipline }) => {
    const code = (discipline ?? '').toLowerCase().trim();
    if (!code) return;
    if (!discAthletes.has(code)) discAthletes.set(code, new Set());
    discAthletes.get(code)!.add(id);
  });

  const disciplines: ReportDisciplineRow[] = DISCIPLINES
    .map((d) => {
      const athleteIds = discAthletes.get(d.value) ?? new Set<string>();
      let athletesAttended  = 0;
      let athletesNoShow    = 0;
      let athletesWithPlans = 0;

      athleteIds.forEach((aid) => {
        const statuses = athleteStatuses.get(aid);
        if (statuses) {
          if (statuses.has('show') || statuses.has('show_remote'))         athletesAttended++;
          if (statuses.has('no_show') || statuses.has('no_show_remote'))   athletesNoShow++;
        }
        if (athletesWithPlanSet.has(aid)) athletesWithPlans++;
      });

      let athletesWithUpcomingApts = 0;
      athleteIds.forEach((aid) => {
        if (athleteHasUpcoming.has(aid)) athletesWithUpcomingApts++;
      });

      return {
        disciplineCode:          d.value,
        disciplineName:          d.label,
        disciplineBlock:         d.block,
        totalAthletes:           athleteIds.size,
        athletesAttended,
        athletesNoShow,
        athletesWithUpcomingApts,
        athletesWithPlans,
      };
    })
    .filter((d) => d.totalAthletes > 0);

  // ── 4. Coaches section ────────────────────────────────────────────────────
  //
  // Coach detection strategy:
  //   a) RBAC user_roles with role.code='coach'
  //   b) profiles.role IN ('coach','trainer') — legacy
  //   c) training_sessions.coach_profile_id — any coach who logged sessions

  const legacyCoachIds = (legacyProfs ?? []).map((p: { id: string }) => p.id);

  // Per-coach notes (period)
  type SessionAgg = { notes: number };
  const sessionAgg: Record<string, SessionAgg> = {};
  (periodSessions ?? []).forEach((s: { coach_profile_id: string | null }) => {
    const cid = s.coach_profile_id;
    if (!cid) return;
    if (!sessionAgg[cid]) sessionAgg[cid] = { notes: 0 };
    sessionAgg[cid].notes++;
  });

  // Per-coach distinct athletes (all-time sessions)
  const sessionAthletes: Record<string, Set<string>> = {};
  (allTimeSessions ?? []).forEach(
    (s: { coach_profile_id: string | null; athlete_id: string | null }) => {
      const cid = s.coach_profile_id;
      if (!cid || !s.athlete_id) return;
      if (!sessionAthletes[cid]) sessionAthletes[cid] = new Set();
      sessionAthletes[cid].add(s.athlete_id);
    },
  );

  // Athlete plan assignments for training plans only
  const planIds   = (trainingPlans ?? []).map((p: { id: string }) => p.id);
  const planIdSet = new Set(planIds);
  const athletePlanRows = (allAthletePlans ?? [] as AthletePlanRow[]).filter(
    (ap) => planIdSet.has(ap.plan_id)
  );

  const plansWithAssignments = new Set(athletePlanRows.map((ap) => ap.plan_id));

  type PlanAgg = { planIds: Set<string> };
  const planAgg: Record<string, PlanAgg> = {};
  (trainingPlans ?? []).forEach((p: { id: string; uploaded_by: string | null }) => {
    if (!p.uploaded_by || !plansWithAssignments.has(p.id)) return;
    if (!planAgg[p.uploaded_by]) planAgg[p.uploaded_by] = { planIds: new Set() };
    planAgg[p.uploaded_by].planIds.add(p.id);
  });

  // Union of all coach ID sources
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
    // Fetch role too so we can exclude athlete profiles that may have slipped in
    // via training_sessions.coach_profile_id being set incorrectly.
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, specialty, role')
      .in('id', allCoachIds);

    const ATHLETE_ROLES = new Set(['athlete']);

    coaches = (
      (profiles ?? []) as {
        id:         string;
        first_name: string;
        last_name:  string;
        specialty:  string | null;
        role:       string | null;
      }[]
    )
      .filter((p) => !ATHLETE_ROLES.has(p.role ?? ''))
      .map((p) => {
        // Count how many of this coach's athletes have any medical appointment in the period
        const coachAthleteIds = sessionAthletes[p.id];
        const athletesWithApts = coachAthleteIds
          ? [...coachAthleteIds].filter((aid) => athletesWithPeriodApts.has(aid)).length
          : 0;
        return {
          coachId:          p.id,
          coachName:        `${p.first_name} ${p.last_name}`.trim(),
          discipline:       p.specialty ?? 'Sin especialidad',
          totalAthletes:    coachAthleteIds?.size ?? 0,
          totalPlans:       planAgg[p.id]?.planIds.size  ?? 0,
          totalNotes:       sessionAgg[p.id]?.notes       ?? 0,
          athletesWithApts,
        };
      })
      .sort((a, b) => a.discipline.localeCompare(b.discipline, 'es'));
  }

  return {
    activeAthletes: activeAthletes ?? 0,
    from,
    to,
    services,
    coaches,
    staffMembers,
    disciplines,
  };
}

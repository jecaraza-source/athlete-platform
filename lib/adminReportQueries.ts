'use server';
// =============================================================================
// lib/adminReportQueries.ts
// Data queries for the "Resumen Metas Plataforma" report.
//
// Sections:
//   1. Health services — event counts by service type + status.
//   2. Training plans — plans per discipline.
//   3. Staff Médico — event counts per individual medical staff member.
//   4. Por Disciplina — athlete attendance and plan assignment per discipline.
// =============================================================================

import { supabaseAdmin }       from '@/lib/supabase-admin';
import { requireReportAccess }  from '@/lib/rbac/server';
import { DISCIPLINES }          from '@/lib/types/diagnostic';
import type {
  ReportData, ReportServiceRow, ReportTrainingDisciplineRow, ServiceType,
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
    { data: trainingPlans },
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
    // 2. All training plans (accumulated)
    supabaseAdmin.from('plans').select('id, uploaded_by').eq('type', 'training'),
    // 3. Medical staff profiles (for staff section)
    supabaseAdmin.from('profiles')
      .select('id, first_name, last_name, role')
      .in('role', MEDICAL_STAFF_ROLES),
    // 4. Active athletes with discipline and name
    supabaseAdmin.from('athletes').select('id, first_name, last_name, discipline').eq('status', 'active'),
    // 5. All athlete plan assignments — used for plans and disciplines
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
    if (status === 'show') {
      tally[st].show++;
    } else if (status === 'show_remote' || status === 'no_show_remote') {
      // `no_show_remote` means the athlete was attended by call/message.
      tally[st].show_remote++;
    } else if (status === 'no_show') {
      tally[st].no_show++;
    }
  });

  const services: ReportServiceRow[] = [
    { service: 'MÉDICO',       scheduled: tally.medico.scheduled,       attendedPresential: tally.medico.show,       attendedRemote: tally.medico.show_remote,       noShow: tally.medico.no_show },
    { service: 'NUTRICIÓN',    scheduled: tally.nutricion.scheduled,    attendedPresential: tally.nutricion.show,    attendedRemote: tally.nutricion.show_remote,    noShow: tally.nutricion.no_show },
    { service: 'PSICOLOGÍA',   scheduled: tally.psicologia.scheduled,   attendedPresential: tally.psicologia.show,   attendedRemote: tally.psicologia.show_remote,   noShow: tally.psicologia.no_show },
    { service: 'FISIOTERAPIA', scheduled: tally.fisioterapia.scheduled, attendedPresential: tally.fisioterapia.show, attendedRemote: null, noShow: tally.fisioterapia.no_show },
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
    else if (status === 'show_remote' || status === 'no_show_remote') staffTally[cid].show_remote++;
    else if (status === 'rescheduled')                              staffTally[cid].rescheduled++;
    else if (status === 'no_show')                                  staffTally[cid].no_show++;
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

  // ── Round 2: event participants ──────────────────────────────────────────
  const periodEventIds = (events ?? [] as RawEvent[]).map((e) => e.id);

  // Build EP chunk queries (avoids PostgREST URL-length limits on large .in() sets)
  const EP_CHUNK = 500;
  const epChunks: string[][] = [];
  for (let i = 0; i < periodEventIds.length; i += EP_CHUNK) {
    epChunks.push(periodEventIds.slice(i, i + EP_CHUNK));
  }

  const epChunkResults = await Promise.all(
    epChunks.map((chunk) =>
      supabaseAdmin.from('event_participants')
        .select('event_id, participant_id')
        .in('event_id', chunk)
        .eq('participant_type', 'athlete')
        .then((r) => r.data ?? [] as { event_id: string; participant_id: string }[])
    ),
  );

  const eventParticipants = (epChunkResults as { event_id: string; participant_id: string }[][]).flat();

  // ── 3. Disciplines section ─────────────────────────────────────────────────
  //
  // Uses the DISCIPLINES constant (same values stored in athletes.discipline).
  // Per discipline, we count:
  //   • totalAthletes    — registered active athletes in this discipline
  //   • athletesAttended — distinct athletes with at least 1 in-person or remote outcome
  //   • athletesNoShow   — distinct athletes with at least 1 no_show
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


  // Athletes who have at least 1 plan assigned (all-time)
  type AthletePlanRow = { plan_id: string; athlete_id: string };
  const athletesWithPlanSet = new Set(
    (allAthletePlans ?? [] as AthletePlanRow[]).map((ap) => ap.athlete_id)
  );

  // Group active athletes by discipline code.
  type ActiveAthlete = {
    id: string;
    first_name: string;
    last_name: string;
    discipline: string | null;
  };
  const activeAthleteById = new Map(
    (allActiveAthletes ?? [] as ActiveAthlete[]).map((athlete) => [athlete.id, athlete]),
  );
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
          if (statuses.has('show') || statuses.has('show_remote') || statuses.has('no_show_remote')) {
            athletesAttended++;
          }
          if (statuses.has('no_show')) athletesNoShow++;
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

  // ── 4. Training plans by discipline ──────────────────────────────────────

  // Training plan assignments are accumulated, regardless of the report period.
  const planIds   = (trainingPlans ?? []).map((p: { id: string }) => p.id);
  const planIdSet = new Set(planIds);
  const athletePlanRows = (allAthletePlans ?? [] as AthletePlanRow[]).filter(
    (ap) => planIdSet.has(ap.plan_id)
  );
  type TrainingDisciplineAgg = {
    athleteIds: Set<string>;
    planIds: Set<string>;
    assignments: number;
  };
  const trainingAgg = new Map<string, TrainingDisciplineAgg>();
  const getTrainingAgg = (discipline: string): TrainingDisciplineAgg => {
    let agg = trainingAgg.get(discipline);
    if (!agg) {
      agg = { athleteIds: new Set(), planIds: new Set(), assignments: 0 };
      trainingAgg.set(discipline, agg);
    }
    return agg;
  };

  athletePlanRows.forEach(({ plan_id, athlete_id }) => {
    const athlete = activeAthleteById.get(athlete_id);
    const discipline = athlete?.discipline?.toLowerCase().trim();
    if (!discipline) return;
    const agg = getTrainingAgg(discipline);
    agg.athleteIds.add(athlete_id);
    agg.planIds.add(plan_id);
    agg.assignments++;
  });


  const trainingDisciplines: ReportTrainingDisciplineRow[] = DISCIPLINES
    .map((discipline) => {
      const agg = trainingAgg.get(discipline.value);
      return {
        disciplineCode: discipline.value,
        disciplineName: discipline.label,
        disciplineBlock: discipline.block,
        athletesWithPlans: agg?.athleteIds.size ?? 0,
        trainingPlans: agg?.planIds.size ?? 0,
        planAssignments: agg?.assignments ?? 0,
      };
    })
    .filter((discipline) => {
      const activeAthletes = discAthletes.get(discipline.disciplineCode)?.size ?? 0;
      return activeAthletes > 0;
    });

  return {
    activeAthletes: activeAthletes ?? 0,
    from,
    to,
    services,
    trainingDisciplines,
    staffMembers,
    disciplines,
  };
}

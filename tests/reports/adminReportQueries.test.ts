/**
 * tests/reports/adminReportQueries.test.ts
 *
 * Integration tests for fetchReportData — covers the three key sections
 * added/modified in the Resumen Metas Plataforma report:
 *
 *   1. Entrenadores — athletes must be excluded even when their profile_id
 *      appears in training_sessions.coach_profile_id (bad data guard).
 *
 *   2. Staff Médico — per-member event tallying (agendadas, presencial,
 *      remoto, reprogramadas, no atendidas).
 *
 *   3. Por Disciplina — per-discipline athlete attendance and plan counts.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Module mocks (hoisted) ───────────────────────────────────────────────────

// 1. Neutralise React's cache() — no per-request memoisation in tests
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
  };
});

// 2. Bypass auth guard — tests are about query logic, not RBAC
vi.mock('@/lib/rbac/server', () => ({
  requireReportAccess: vi.fn().mockResolvedValue(undefined),
}));

// 3. Mock Supabase admin client
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: vi.fn() },
}));

// ─── Subject under test ───────────────────────────────────────────────────────

import { fetchReportData }  from '@/lib/adminReportQueries';
import { supabaseAdmin }    from '@/lib/supabase-admin';

// ─── Mock infrastructure ──────────────────────────────────────────────────────

type QueryResult = { data?: unknown[] | null; count?: number | null; error?: null };

/**
 * Returns a chainable object that:
 *  - Is "thenable" (Promise-like), resolving to `result`
 *  - Has every Supabase query-builder method returning itself
 *
 * This covers both directly-awaited chains (Promise.all) and
 * .then()-chained ones (used in Round 2 of fetchReportData).
 */
function makeQuery(result: QueryResult) {
  const chain: Record<string, unknown> = {};
  const thenable = Promise.resolve(result);
  // Bind Promise interface so the chain can be awaited or .then()'d
  chain.then  = thenable.then.bind(thenable);
  chain.catch = thenable.catch.bind(thenable);
  // Every chaining method returns itself
  for (const m of [
    'select', 'eq', 'neq', 'gte', 'lte', 'in', 'not',
    'order', 'limit', 'range', 'head', 'maybeSingle', 'single',
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

/**
 * Sets `supabaseAdmin.from` to dispatch by table name, returning each table's
 * results sequentially (first call → queue[0], second call → queue[1], …).
 *
 * Tables not present in `queues` return `{ data: [], count: null }`.
 */
function installFromMock(queues: Record<string, QueryResult[]>) {
  const cursors: Record<string, number> = {};

  (supabaseAdmin as { from: ReturnType<typeof vi.fn> }).from
    .mockImplementation((table: string) => {
      const queue = queues[table] ?? [];
      const idx   = cursors[table] ?? 0;
      cursors[table] = idx + 1;
      return makeQuery(queue[idx] ?? { data: [], count: null });
    });
}

/** Minimal no-op data for tables we don't care about in a given test. */
function emptyQueues(): Record<string, QueryResult[]> {
  return {
    // Round 1 — 14 parallel queries
    athletes:           [{ count: 0 }, { data: [] }],
    events:             [{ data: [] }],
    medical_sessions:   [{ count: 0 }],
    nutrition_checkins: [{ count: 0 }],
    psychology_sessions:[{ count: 0 }],
    physio_sessions:    [{ count: 0 }],
    roles:              [{ data: [] }],      // empty → coachRoleIds = [], skip user_roles
    training_sessions:  [{ data: [] }, { data: [] }],
    plans:              [{ data: [] }],
    profiles:           [{ data: [] }, { data: [] }],
    athlete_plans:      [{ data: [] }],
    // Round 2 (only queried when needed)
    user_roles:         [{ data: [] }],
    event_participants: [{ data: [] }],
  };
}

// ─── Per-test setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// Section 1: Entrenadores — athlete-profile exclusion
// =============================================================================

describe('fetchReportData — Entrenadores section', () => {
  it('excludes profiles with role="athlete" from the coaches list', async () => {
    const queues = emptyQueues();

    // All-time training sessions — athlete P-athlete appears as coach (bad data)
    queues.training_sessions = [
      {
        data: [
          { athlete_id: 'A1', coach_profile_id: 'P-coach' },
          { athlete_id: 'A2', coach_profile_id: 'P-athlete' }, // ← athlete acting as coach
        ],
      },
      { data: [] }, // period sessions (call 2)
    ];

    // profiles call 1 (legacy .in('role', ['coach','trainer'])): empty
    // profiles call 2 (medical staff): empty
    // profiles call 3 (coach details): both coach and athlete profiles
    queues.profiles = [
      { data: [] },  // call 1: legacy coaches
      { data: [] },  // call 2: medical staff
      {
        data: [
          { id: 'P-coach',   first_name: 'Carlos', last_name: 'Ruiz',  specialty: 'Atletismo', role: 'coach' },
          { id: 'P-athlete', first_name: 'Pedro',  last_name: 'Pérez', specialty: null,        role: 'athlete' },
        ],
      }, // call 3: coach resolution
    ];

    installFromMock(queues);

    const result = await fetchReportData('2024-01-01', '2024-01-31');

    const coachIds = result.coaches.map((c) => c.coachId);
    expect(coachIds).toContain('P-coach');
    expect(coachIds).not.toContain('P-athlete');
  });

  it('includes only the valid coach and shows correct session counts', async () => {
    const queues = emptyQueues();

    // All-time sessions
    queues.training_sessions = [
      {
        data: [
          { athlete_id: 'A1', coach_profile_id: 'P-coach' },
          { athlete_id: 'A2', coach_profile_id: 'P-coach' },
          { athlete_id: 'A3', coach_profile_id: 'P-athlete' }, // bad data
        ],
      },
      // Period sessions (call 2) — P-coach logged 2 notes
      { data: [
        { coach_profile_id: 'P-coach' },
        { coach_profile_id: 'P-coach' },
      ]},
    ];

    queues.profiles = [
      { data: [] },  // call 1: legacy coaches
      { data: [] },  // call 2: medical staff
      {
        data: [
          { id: 'P-coach',   first_name: 'Luis', last_name: 'Torres', specialty: 'Boxeo', role: 'coach' },
          { id: 'P-athlete', first_name: 'Ana',  last_name: 'Vega',   specialty: null,    role: 'athlete' },
        ],
      },
    ];

    installFromMock(queues);

    const result = await fetchReportData('2024-01-01', '2024-01-31');

    expect(result.coaches).toHaveLength(1);
    const coach = result.coaches[0];
    expect(coach.coachId).toBe('P-coach');
    expect(coach.totalAthletes).toBe(2);  // distinct athletes from all-time sessions
    expect(coach.totalNotes).toBe(2);     // period sessions
  });

  it('returns an empty coaches list when all session participants are athletes', async () => {
    const queues = emptyQueues();

    queues.training_sessions = [
      // All coach_profile_ids are athlete profiles (completely bad data)
      { data: [
        { athlete_id: 'A1', coach_profile_id: 'P-athlete-1' },
        { athlete_id: 'A2', coach_profile_id: 'P-athlete-2' },
      ]},
      { data: [] },
    ];

    queues.profiles = [
      { data: [] },
      { data: [] },
      {
        data: [
          { id: 'P-athlete-1', first_name: 'X', last_name: 'Y', specialty: null, role: 'athlete' },
          { id: 'P-athlete-2', first_name: 'X', last_name: 'Z', specialty: null, role: 'athlete' },
        ],
      },
    ];

    installFromMock(queues);

    const result = await fetchReportData('2024-01-01', '2024-01-31');

    expect(result.coaches).toHaveLength(0);
  });
});

// =============================================================================
// Section 2: Staff Médico — per-member event tallying
// =============================================================================

describe('fetchReportData — Staff Médico section', () => {
  it('tallies show/show_remote/rescheduled/no_show per staff member', async () => {
    const queues = emptyQueues();

    const MEDIC_ID = 'staff-medic';
    const NUTRI_ID = 'staff-nutri';

    queues.events = [{
      data: [
        // Medic events: 1 show, 1 show_remote, 1 no_show (3 total)
        { id: 'e1', title: 'MÉDICO 1', status: 'show',        created_by_profile_id: MEDIC_ID },
        { id: 'e2', title: 'MÉDICO 2', status: 'show_remote', created_by_profile_id: MEDIC_ID },
        { id: 'e3', title: 'MÉDICO 3', status: 'no_show',     created_by_profile_id: MEDIC_ID },
        // Nutritionist: 1 rescheduled, 1 no_show_remote (2 total)
        { id: 'e4', title: 'NUTRICIÓN 1', status: 'rescheduled',    created_by_profile_id: NUTRI_ID },
        { id: 'e5', title: 'NUTRICIÓN 2', status: 'no_show_remote', created_by_profile_id: NUTRI_ID },
      ],
    }];

    queues.profiles = [
      { data: [] }, // call 1: legacy coaches
      {             // call 2: medical staff profiles
        data: [
          { id: MEDIC_ID, first_name: 'María',  last_name: 'Doctora',       role: 'medic' },
          { id: NUTRI_ID, first_name: 'Carlos', last_name: 'Nutricionista', role: 'nutritionist' },
        ],
      },
    ];

    installFromMock(queues);

    const result = await fetchReportData('2024-01-01', '2024-01-31');

    const medic = result.staffMembers.find((s) => s.staffId === MEDIC_ID);
    expect(medic).toBeDefined();
    expect(medic!.scheduled).toBe(3);
    expect(medic!.attendedPresential).toBe(1);
    expect(medic!.attendedRemote).toBe(1);
    expect(medic!.rescheduled).toBe(0);
    expect(medic!.noShow).toBe(1);
    expect(medic!.roleLabel).toBe('Médico');

    const nutri = result.staffMembers.find((s) => s.staffId === NUTRI_ID);
    expect(nutri).toBeDefined();
    expect(nutri!.scheduled).toBe(2);
    expect(nutri!.attendedPresential).toBe(0);
    expect(nutri!.attendedRemote).toBe(0);
    expect(nutri!.rescheduled).toBe(1);
    expect(nutri!.noShow).toBe(1);           // no_show_remote counts as noShow
    expect(nutri!.roleLabel).toBe('Nutricionista');
  });

  it('omits staff members who had no events in the period', async () => {
    const queues = emptyQueues();

    queues.events = [{ data: [] }]; // no events

    queues.profiles = [
      { data: [] },
      {
        data: [
          { id: 'staff-physio', first_name: 'Ana', last_name: 'Fisio', role: 'physio' },
        ],
      },
    ];

    installFromMock(queues);

    const result = await fetchReportData('2024-01-01', '2024-01-31');

    expect(result.staffMembers).toHaveLength(0);
  });

  it('assigns correct roleLabel for all four medical roles', async () => {
    const queues = emptyQueues();

    const staffProfiles = [
      { id: 's1', first_name: 'A', last_name: 'B', role: 'medic' },
      { id: 's2', first_name: 'A', last_name: 'B', role: 'nutritionist' },
      { id: 's3', first_name: 'A', last_name: 'B', role: 'physio' },
      { id: 's4', first_name: 'A', last_name: 'B', role: 'psychologist' },
    ];

    queues.events = [{
      data: staffProfiles.map((p, i) => ({
        id: `e${i}`,
        title: 'MÉDICO',
        status: 'show',
        created_by_profile_id: p.id,
      })),
    }];

    queues.profiles = [{ data: [] }, { data: staffProfiles }];

    installFromMock(queues);

    const result = await fetchReportData('2024-01-01', '2024-01-31');

    const labels = result.staffMembers.map((s) => s.roleLabel).sort();
    expect(labels).toEqual(['Fisioterapeuta', 'Médico', 'Nutricionista', 'Psicólogo/a'].sort());
  });

  it('excludes non-medical staff (coach, trainer, athlete) from the staff section', async () => {
    const queues = emptyQueues();

    queues.events = [{
      data: [
        { id: 'e1', title: 'MÉDICO', status: 'show', created_by_profile_id: 'coach-profile' },
        { id: 'e2', title: 'MÉDICO', status: 'show', created_by_profile_id: 'athlete-profile' },
        { id: 'e3', title: 'MÉDICO', status: 'show', created_by_profile_id: 'medic-profile' },
      ],
    }];

    // Medical staff profiles only contain medic-profile (not coach/athlete)
    queues.profiles = [
      { data: [] },
      { data: [{ id: 'medic-profile', first_name: 'Dr', last_name: 'García', role: 'medic' }] },
    ];

    installFromMock(queues);

    const result = await fetchReportData('2024-01-01', '2024-01-31');

    expect(result.staffMembers).toHaveLength(1);
    expect(result.staffMembers[0].staffId).toBe('medic-profile');
  });
});

// =============================================================================
// Section 3: Por Disciplina — attendance and plan aggregation
// =============================================================================

describe('fetchReportData — Por Disciplina section', () => {
  it('counts athletes, attended, no-showed and with-plans per discipline', async () => {
    const queues = emptyQueues();

    // Two taekwondo athletes, one boxeo athlete
    queues.athletes = [
      { count: 3 },
      {
        data: [
          { id: 'AT1', discipline: 'taekwondo' },
          { id: 'AT2', discipline: 'taekwondo' },
          { id: 'AB1', discipline: 'boxeo' },
        ],
      },
    ];

    // Events in period
    queues.events = [{
      data: [
        { id: 'e1', title: 'MÉDICO', status: 'show',    created_by_profile_id: null },
        { id: 'e2', title: 'MÉDICO', status: 'no_show', created_by_profile_id: null },
        { id: 'e3', title: 'MÉDICO', status: 'show',    created_by_profile_id: null },
      ],
    }];

    // Event participants: AT1 → attended (show), AT2 → no-showed
    queues.event_participants = [{
      data: [
        { event_id: 'e1', participant_id: 'AT1' }, // show
        { event_id: 'e2', participant_id: 'AT2' }, // no_show
      ],
    }];

    // Athlete plans: AT1 has a plan (all-time)
    queues.athlete_plans = [{ data: [{ plan_id: 'plan-X', athlete_id: 'AT1' }] }];

    installFromMock(queues);

    const result = await fetchReportData('2024-01-01', '2024-01-31');

    const tkd = result.disciplines.find((d) => d.disciplineCode === 'taekwondo');
    expect(tkd).toBeDefined();
    expect(tkd!.totalAthletes).toBe(2);
    expect(tkd!.athletesAttended).toBe(1);   // AT1 attended
    expect(tkd!.athletesNoShow).toBe(1);     // AT2 no-showed
    expect(tkd!.athletesWithPlans).toBe(1);  // AT1 has a plan

    const box = result.disciplines.find((d) => d.disciplineCode === 'boxeo');
    expect(box).toBeDefined();
    expect(box!.totalAthletes).toBe(1);
    expect(box!.athletesAttended).toBe(0);
    expect(box!.athletesNoShow).toBe(0);
    expect(box!.athletesWithPlans).toBe(0);
  });

  it('counts an athlete as attended if they have at least one show or show_remote event', async () => {
    const queues = emptyQueues();

    queues.athletes = [
      { count: 1 },
      { data: [{ id: 'AT1', discipline: 'natacion' }] },
    ];

    queues.events = [{
      data: [
        { id: 'e1', title: 'MÉDICO', status: 'no_show',     created_by_profile_id: null },
        { id: 'e2', title: 'MÉDICO', status: 'show_remote', created_by_profile_id: null },
      ],
    }];

    // AT1 no-showed first, then attended remotely
    queues.event_participants = [{
      data: [
        { event_id: 'e1', participant_id: 'AT1' },
        { event_id: 'e2', participant_id: 'AT1' },
      ],
    }];

    installFromMock(queues);

    const result = await fetchReportData('2024-01-01', '2024-01-31');

    const natacion = result.disciplines.find((d) => d.disciplineCode === 'natacion');
    expect(natacion).toBeDefined();
    expect(natacion!.athletesAttended).toBe(1);  // show_remote counts as attended
    expect(natacion!.athletesNoShow).toBe(1);    // also had a no_show (counts independently)
  });

  it('excludes disciplines with zero athletes from the result', async () => {
    const queues = emptyQueues();

    // Only taekwondo athletes
    queues.athletes = [
      { count: 1 },
      { data: [{ id: 'AT1', discipline: 'taekwondo' }] },
    ];

    installFromMock(queues);

    const result = await fetchReportData('2024-01-01', '2024-01-31');

    // Only taekwondo should appear (other DISCIPLINES have 0 athletes)
    expect(result.disciplines.every((d) => d.totalAthletes > 0)).toBe(true);
    expect(result.disciplines.map((d) => d.disciplineCode)).not.toContain('boxeo');
    expect(result.disciplines.map((d) => d.disciplineCode)).not.toContain('natacion');
  });

  it('ignores athletes without a discipline value', async () => {
    const queues = emptyQueues();

    queues.athletes = [
      { count: 2 },
      {
        data: [
          { id: 'AT1', discipline: 'boxeo' },
          { id: 'AT2', discipline: null },    // no discipline — should not be counted
        ],
      },
    ];

    installFromMock(queues);

    const result = await fetchReportData('2024-01-01', '2024-01-31');

    const box = result.disciplines.find((d) => d.disciplineCode === 'boxeo');
    expect(box?.totalAthletes).toBe(1); // only AT1, not AT2

    // No "null" or empty entry in disciplines
    const nullEntry = result.disciplines.find(
      (d) => !d.disciplineCode || d.disciplineCode === ''
    );
    expect(nullEntry).toBeUndefined();
  });

  it('correctly uses all-time plans (not period-filtered) for athletesWithPlans', async () => {
    const queues = emptyQueues();

    queues.athletes = [
      { count: 1 },
      { data: [{ id: 'AT1', discipline: 'atletismo' }] },
    ];

    // AT1 has a plan (the plan was created outside the test period — all-time counts)
    queues.athlete_plans = [{ data: [{ plan_id: 'old-plan', athlete_id: 'AT1' }] }];

    installFromMock(queues);

    // Period is Jan 2024 — plan was created in 2023 but athlete_plans is not filtered by date
    const result = await fetchReportData('2024-01-01', '2024-01-31');

    const atl = result.disciplines.find((d) => d.disciplineCode === 'atletismo');
    expect(atl?.athletesWithPlans).toBe(1);
  });
});

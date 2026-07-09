/**
 * tests/plans/plans-cleanup.test.ts
 *
 * Pruebas de integración: Limpieza de asignaciones de planes por disciplina
 *
 * Estrategia: BD en memoria (mismo patrón que attachments-flow.test.ts)
 *
 * Cubre:
 *  1. Caso feliz — elimina asignaciones de atletas fuera de la disciplina
 *  2. Todos los atletas son de la disciplina — removed = 0, sin cambios
 *  3. Ningún atleta es de la disciplina — se eliminan todas las asignaciones
 *  4. Plan sin asignaciones — removed = 0, sin error
 *  5. Discipline vacío / sin atletas con esa disciplina — removed = todas las asignaciones
 *  6. Guardia de permisos — bloqueado sin edit_athletes
 *  7. getAvailableDisciplines — retorna las disciplinas del catálogo
 *  8. getAvailableDisciplines — retorna arreglo vacío si cat_disciplines está vacía
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mocks (deben registrarse ANTES de importar las acciones) ─────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/rbac/server', () => ({
  assertPermission: vi.fn().mockResolvedValue(null),   // null = autorizado
  getCurrentUser:   vi.fn().mockResolvedValue({
    authUserId: 'auth-coach-001',
    profile: { id: 'profile-coach-001', first_name: 'Saul', last_name: 'Castillo' },
    roles: [],
    permissions: new Set(['view_athletes', 'edit_athletes']),
  }),
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: vi.fn() },
}));

// ─── Constantes de prueba ─────────────────────────────────────────────────────

const PLAN_ID      = 'plan-training-001';
const DISC_CANOE   = 'canotaje';
const DISC_BOXING  = 'boxeo';
const DISC_SWIM    = 'natacion';

const ATHLETE_CANOE_1 = 'athlete-canoe-001';
const ATHLETE_CANOE_2 = 'athlete-canoe-002';
const ATHLETE_BOX_1   = 'athlete-box-001';
const ATHLETE_SWIM_1  = 'athlete-swim-001';

// ─── Estado en memoria ────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

const db: Record<string, Row[]> = {
  athletes:        [],
  athlete_plans:   [],
  cat_disciplines: [],
};

function resetDb(): void {
  db.athletes        = [];
  db.athlete_plans   = [];
  db.cat_disciplines = [];
}

// ─── Proxy de tabla Supabase ──────────────────────────────────────────────────

type EqFilter  = { kind: 'eq';  key: string; value: unknown };
type InFilter  = { kind: 'in';  key: string; values: unknown[] };
type AnyFilter = EqFilter | InFilter;

type OpType = 'select' | 'delete';

function makeTableProxy(table: string) {
  const filters: AnyFilter[] = [];
  let opType: OpType = 'select';

  function matchRow(row: Row): boolean {
    return filters.every((f) => {
      if (f.kind === 'eq') return row[f.key] === f.value;
      if (f.kind === 'in') return (f.values as unknown[]).includes(row[f.key]);
      return true;
    });
  }

  function execute(): { data: Row | Row[] | null; error: null } {
    const rows = db[table] ?? [];
    if (opType === 'select') {
      return { data: rows.filter(matchRow), error: null };
    }
    if (opType === 'delete') {
      const before = rows.length;
      db[table] = rows.filter((r) => !matchRow(r));
      const removed = before - db[table].length;
      // Supabase delete returns deleted rows — we just return count stub
      return { data: Array(removed).fill({}), error: null };
    }
    return { data: [], error: null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxy: any = {
    select: () => proxy,
    delete: () => { opType = 'delete'; return proxy; },
    eq:    (key: string, value: unknown) => { filters.push({ kind: 'eq', key, value }); return proxy; },
    in:    (key: string, values: unknown[]) => { filters.push({ kind: 'in', key, values }); return proxy; },
    order: () => proxy,
    then(resolve: (v: { data: Row | Row[] | null; error: null }) => void) {
      resolve(execute());
    },
  };

  return proxy;
}

// ─── Import de módulos bajo test ──────────────────────────────────────────────

import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission } from '@/lib/rbac/server';
import {
  removeAssignmentsOutsideDiscipline,
  getAvailableDisciplines,
} from '@/lib/plans/actions';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetDb();

  vi.mocked(assertPermission).mockResolvedValue(null);
  vi.mocked(supabaseAdmin.from).mockImplementation(
    (table: string) => makeTableProxy(table) as ReturnType<typeof supabaseAdmin.from>,
  );
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

function seedAthletes() {
  db.athletes = [
    { id: ATHLETE_CANOE_1, first_name: 'María', last_name: 'López',   discipline: DISC_CANOE  },
    { id: ATHLETE_CANOE_2, first_name: 'Juan',  last_name: 'Pérez',   discipline: DISC_CANOE  },
    { id: ATHLETE_BOX_1,   first_name: 'Luis',  last_name: 'Ramírez', discipline: DISC_BOXING },
    { id: ATHLETE_SWIM_1,  first_name: 'Ana',   last_name: 'Torres',  discipline: DISC_SWIM   },
  ];
}

function seedAssignments(athleteIds: string[]) {
  db.athlete_plans = athleteIds.map((athleteId, i) => ({
    id:              `ap-${i + 1}`,
    plan_id:         PLAN_ID,
    athlete_id:      athleteId,
    assignment_mode: 'collective',
  }));
}

function seedDisciplines() {
  db.cat_disciplines = [
    { id: 'disc-1', code: DISC_BOXING, name: 'Boxeo',     block: 'combate'   },
    { id: 'disc-2', code: DISC_CANOE,  name: 'Canotaje',  block: 'acuatico'  },
    { id: 'disc-3', code: DISC_SWIM,   name: 'Natación',  block: 'acuatico'  },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CASO FELIZ — elimina asignaciones fuera de la disciplina
// ─────────────────────────────────────────────────────────────────────────────

describe('1. Caso feliz — elimina asignaciones de atletas fuera de la disciplina', () => {
  beforeEach(() => {
    seedAthletes();
    // Plan asignado a los 4 atletas (colectivo accidental)
    seedAssignments([ATHLETE_CANOE_1, ATHLETE_CANOE_2, ATHLETE_BOX_1, ATHLETE_SWIM_1]);
  });

  it('debe retornar { error: null } y removed = 2', async () => {
    const result = await removeAssignmentsOutsideDiscipline(PLAN_ID, DISC_CANOE);
    expect(result.error).toBeNull();
    expect(result.removed).toBe(2);
  });

  it('debe dejar solo las asignaciones de atletas de canotaje', async () => {
    await removeAssignmentsOutsideDiscipline(PLAN_ID, DISC_CANOE);
    const remaining = db.athlete_plans.filter((ap) => ap.plan_id === PLAN_ID);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((ap) => ap.athlete_id)).toContain(ATHLETE_CANOE_1);
    expect(remaining.map((ap) => ap.athlete_id)).toContain(ATHLETE_CANOE_2);
  });

  it('no debe quedar ninguna asignación de boxeo ni natación', async () => {
    await removeAssignmentsOutsideDiscipline(PLAN_ID, DISC_CANOE);
    const remaining = db.athlete_plans.filter((ap) => ap.plan_id === PLAN_ID);
    expect(remaining.map((ap) => ap.athlete_id)).not.toContain(ATHLETE_BOX_1);
    expect(remaining.map((ap) => ap.athlete_id)).not.toContain(ATHLETE_SWIM_1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TODOS LOS ATLETAS YA SON DE LA DISCIPLINA — sin cambios
// ─────────────────────────────────────────────────────────────────────────────

describe('2. Todos los atletas ya son de la disciplina — removed = 0', () => {
  beforeEach(() => {
    seedAthletes();
    // Solo atletas de canotaje asignados
    seedAssignments([ATHLETE_CANOE_1, ATHLETE_CANOE_2]);
  });

  it('debe retornar removed = 0', async () => {
    const result = await removeAssignmentsOutsideDiscipline(PLAN_ID, DISC_CANOE);
    expect(result.removed).toBe(0);
    expect(result.error).toBeNull();
  });

  it('no debe eliminar ningún registro de athlete_plans', async () => {
    const countBefore = db.athlete_plans.length;
    await removeAssignmentsOutsideDiscipline(PLAN_ID, DISC_CANOE);
    expect(db.athlete_plans.length).toBe(countBefore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. NINGÚN ATLETA ES DE LA DISCIPLINA — se eliminan todas las asignaciones
// ─────────────────────────────────────────────────────────────────────────────

describe('3. Ningún atleta es de la disciplina objetivo — se eliminan todas', () => {
  beforeEach(() => {
    seedAthletes();
    // Solo boxeo y natación asignados, ningún canotaje
    seedAssignments([ATHLETE_BOX_1, ATHLETE_SWIM_1]);
  });

  it('debe retornar removed = 2 (todas las asignaciones)', async () => {
    const result = await removeAssignmentsOutsideDiscipline(PLAN_ID, DISC_CANOE);
    expect(result.removed).toBe(2);
    expect(result.error).toBeNull();
  });

  it('no debe quedar ninguna asignación para ese plan', async () => {
    await removeAssignmentsOutsideDiscipline(PLAN_ID, DISC_CANOE);
    const remaining = db.athlete_plans.filter((ap) => ap.plan_id === PLAN_ID);
    expect(remaining).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PLAN SIN ASIGNACIONES — removed = 0, sin error
// ─────────────────────────────────────────────────────────────────────────────

describe('4. Plan sin asignaciones — removed = 0', () => {
  beforeEach(() => {
    seedAthletes();
    db.athlete_plans = []; // plan existe pero sin asignaciones
  });

  it('debe retornar { error: null, removed: 0 }', async () => {
    const result = await removeAssignmentsOutsideDiscipline(PLAN_ID, DISC_CANOE);
    expect(result.error).toBeNull();
    expect(result.removed).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. DISCIPLINA SIN ATLETAS REGISTRADOS — se eliminan todas las asignaciones
// ─────────────────────────────────────────────────────────────────────────────

describe('5. Disciplina sin atletas registrados — elimina todas las asignaciones del plan', () => {
  beforeEach(() => {
    // Atletas solo con boxeo y natación, sin la disciplina 'tiro_con_arco'
    db.athletes = [
      { id: ATHLETE_BOX_1,  discipline: DISC_BOXING },
      { id: ATHLETE_SWIM_1, discipline: DISC_SWIM   },
    ];
    seedAssignments([ATHLETE_BOX_1, ATHLETE_SWIM_1]);
  });

  it('debe eliminar todas las asignaciones si nadie tiene la disciplina buscada', async () => {
    const result = await removeAssignmentsOutsideDiscipline(PLAN_ID, 'tiro_con_arco');
    expect(result.removed).toBe(2);
    expect(result.error).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. GUARDIA DE PERMISOS
// ─────────────────────────────────────────────────────────────────────────────

describe('6. Guardia de permisos — bloqueado sin edit_athletes', () => {
  beforeEach(() => {
    seedAthletes();
    seedAssignments([ATHLETE_CANOE_1, ATHLETE_BOX_1]);
  });

  it('debe retornar error cuando assertPermission deniega', async () => {
    vi.mocked(assertPermission).mockResolvedValueOnce({
      error: 'You do not have permission to perform this action.',
    });
    const result = await removeAssignmentsOutsideDiscipline(PLAN_ID, DISC_CANOE);
    expect(result.error).not.toBeNull();
    expect(result.removed).toBe(0);
  });

  it('no debe modificar athlete_plans si no hay permiso', async () => {
    vi.mocked(assertPermission).mockResolvedValueOnce({ error: 'Forbidden.' });
    const countBefore = db.athlete_plans.length;
    await removeAssignmentsOutsideDiscipline(PLAN_ID, DISC_CANOE);
    expect(db.athlete_plans.length).toBe(countBefore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. getAvailableDisciplines — retorna el catálogo
// ─────────────────────────────────────────────────────────────────────────────

describe('7. getAvailableDisciplines — retorna las disciplinas del catálogo', () => {
  beforeEach(() => {
    seedDisciplines();
  });

  it('debe retornar las 3 disciplinas sembradas', async () => {
    const disciplines = await getAvailableDisciplines();
    expect(disciplines).toHaveLength(3);
  });

  it('cada disciplina debe tener id, code y name', async () => {
    const disciplines = await getAvailableDisciplines();
    for (const d of disciplines) {
      expect(d).toHaveProperty('id');
      expect(d).toHaveProperty('code');
      expect(d).toHaveProperty('name');
    }
  });

  it('debe incluir canotaje en el resultado', async () => {
    const disciplines = await getAvailableDisciplines();
    expect(disciplines.some((d) => d.code === DISC_CANOE)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. getAvailableDisciplines — tabla vacía
// ─────────────────────────────────────────────────────────────────────────────

describe('8. getAvailableDisciplines — tabla vacía', () => {
  beforeEach(() => {
    db.cat_disciplines = [];
  });

  it('debe retornar arreglo vacío si no hay disciplinas registradas', async () => {
    const disciplines = await getAvailableDisciplines();
    expect(disciplines).toHaveLength(0);
    expect(Array.isArray(disciplines)).toBe(true);
  });
});

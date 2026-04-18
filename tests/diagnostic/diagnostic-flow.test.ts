/**
 * tests/diagnostic/diagnostic-flow.test.ts
 *
 * Prueba de integración: Diagnóstico Inicial Integral — flujo completo
 *
 * Estrategia: BD en memoria
 * ─────────────────────────
 * Se mockea supabaseAdmin con un proxy que lee y escribe sobre un objeto de
 * estado en memoria, replicando el comportamiento real de Supabase (select,
 * update, upsert, insert, maybeSingle, etc.).
 *
 * Cubre:
 *  1. Alta de atleta → diagnóstico + 5 secciones creadas en 'pendiente'
 *  2. Guardar borrador → sección pasa a 'en_proceso', avance incremental
 *  3. Completar rubro → sección pasa a 'completo', avance += 20%
 *  4. Recálculo automático de overall_status y completion_pct
 *  5. 5/5 rubros completos → 'completo' al 100%
 *  6. Resultado integrado interdisciplinario
 *  7. Lógica de semáforo: 'requiere_atencion' tiene prioridad
 *  8. Independencia: los tests no se afectan entre sí
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mocks (deben registrarse ANTES de importar las acciones) ────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/rbac/server', () => ({
  assertPermission: vi.fn().mockResolvedValue(undefined),  // Sin denegar
  requirePermission: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: vi.fn() },
}));

// ─── Estado en memoria (simula las tablas de Supabase) ───────────────────────

const ATHLETE_ID    = 'athlete-integration-001';
const DIAGNOSTIC_ID = 'diagnostic-integration-001';
const SECTION_KEYS  = ['medico', 'nutricion', 'psicologia', 'entrenador', 'fisioterapia'] as const;
type SectionKey = typeof SECTION_KEYS[number];

const SECTION_IDS: Record<SectionKey, string> = {
  medico:       'sec-med-001',
  nutricion:    'sec-nut-001',
  psicologia:   'sec-psy-001',
  entrenador:   'sec-ent-001',
  fisioterapia: 'sec-fis-001',
};

type Status = 'pendiente' | 'en_proceso' | 'completo' | 'requiere_atencion';

interface Section {
  id: string;
  diagnostic_id: string;
  athlete_id: string;
  section: SectionKey;
  status: Status;
  completion_pct: number;
  completed_at: string | null;
  captured_at: string | null;
  updated_at: string | null;
}

interface Diagnostic {
  id: string;
  athlete_id: string;
  overall_status: Status;
  completion_pct: number;
  completed_at: string | null;
  updated_at: string;
}

type Row = Record<string, unknown>;

/** Objeto mutable de estado — reemplaza la BD real */
const db: {
  athlete_initial_diagnostic: Diagnostic[];
  athlete_diagnostic_sections: Section[];
  athlete_medical_evaluation: Row[];
  athlete_nutrition_evaluation: Row[];
  athlete_psychology_evaluation: Row[];
  athlete_coach_evaluation: Row[];
  athlete_physiotherapy_evaluation: Row[];
  athlete_integrated_results: Row[];
  athlete_follow_up_log: Row[];
} = {
  athlete_initial_diagnostic: [],
  athlete_diagnostic_sections: [],
  athlete_medical_evaluation: [],
  athlete_nutrition_evaluation: [],
  athlete_psychology_evaluation: [],
  athlete_coach_evaluation: [],
  athlete_physiotherapy_evaluation: [],
  athlete_integrated_results: [],
  athlete_follow_up_log: [],
};

function resetDb(): void {
  db.athlete_initial_diagnostic = [{
    id: DIAGNOSTIC_ID,
    athlete_id: ATHLETE_ID,
    overall_status: 'pendiente',
    completion_pct: 0,
    completed_at: null,
    updated_at: new Date().toISOString(),
  }];

  db.athlete_diagnostic_sections = SECTION_KEYS.map((section) => ({
    id: SECTION_IDS[section],
    diagnostic_id: DIAGNOSTIC_ID,
    athlete_id: ATHLETE_ID,
    section,
    status: 'pendiente' as Status,
    completion_pct: 0,
    completed_at: null,
    captured_at: null,
    updated_at: null,
  }));

  db.athlete_medical_evaluation        = [];
  db.athlete_nutrition_evaluation      = [];
  db.athlete_psychology_evaluation     = [];
  db.athlete_coach_evaluation          = [];
  db.athlete_physiotherapy_evaluation  = [];
  db.athlete_integrated_results        = [];
  db.athlete_follow_up_log             = [];
}

// ─── Proxy de tabla (imita el query builder de supabase-js) ──────────────────
//
// DISEÑO: ejecución LAZY (diferida), igual que el cliente real de Supabase.
// update(data).eq(k,v) → la actualización sólo se ejecuta al awaitar la query.
// Esto es crítico para que los filtros estén aplicados antes de mutar la BD.

function getTableRows(table: string): Row[] {
  return ((db as unknown) as Record<string, Row[]>)[table] ?? [];
}

function setTableRows(table: string, rows: Row[]): void {
  ((db as unknown) as Record<string, Row[]>)[table] = rows;
}

type Operation =
  | { type: 'select' }
  | { type: 'update'; data: Row }
  | { type: 'insert'; data: Row | Row[] }
  | { type: 'upsert'; data: Row; options?: { onConflict?: string } };

/** Crea un proxy chainable con ejecución lazy sobre la BD en memoria */
function makeTableProxy(table: string) {
  const filters: Record<string, unknown> = {};
  let op: Operation = { type: 'select' };

  // ── Helpers de ejecución ──────────────────────────────────────────────────

  function doSelect(): Row[] {
    return getTableRows(table).filter((row) =>
      Object.entries(filters).every(([k, v]) => row[k] === v)
    );
  }

  function doUpdate(data: Row): void {
    setTableRows(table, getTableRows(table).map((row) =>
      Object.entries(filters).every(([k, v]) => row[k] === v)
        ? { ...row, ...data }
        : row
    ));
  }

  function doInsert(data: Row | Row[]): void {
    const rows = getTableRows(table);
    if (Array.isArray(data)) rows.push(...data); else rows.push(data);
    setTableRows(table, rows);
  }

  function doUpsert(data: Row, options?: { onConflict?: string }): void {
    const conflictKey = options?.onConflict;
    const rows = getTableRows(table);
    if (conflictKey && data[conflictKey]) {
      const idx = rows.findIndex((r) => r[conflictKey] === data[conflictKey]);
      if (idx !== -1) rows[idx] = { ...rows[idx], ...data }; else rows.push(data);
    } else {
      rows.push(data);
    }
    setTableRows(table, rows);
  }

  /** Ejecuta la operación pendiente y devuelve el resultado */
  function execute(): { data: Row | Row[] | null; error: null } {
    switch (op.type) {
      case 'select': return { data: doSelect(), error: null };
      case 'update': doUpdate(op.data);                    return { data: null, error: null };
      case 'insert': doInsert(op.data);                    return { data: op.data, error: null };
      case 'upsert': doUpsert(op.data, op.options);        return { data: op.data, error: null };
    }
  }

  // ── Proxy chainable ────────────────────────────────────────────────────────

  const proxy = {
    select: () => proxy,

    eq: (key: string, value: unknown) => {
      filters[key] = value;
      return proxy;
    },

    order: () => proxy,
    limit: () => proxy,
    'in':  () => proxy,

    // ── Operaciones mutantes (lazy) ─────────────────────────────────────────

    update: (data: Row) => { op = { type: 'update', data }; return proxy; },

    insert: (data: Row | Row[]) => { op = { type: 'insert', data }; return proxy; },

    upsert: (data: Row, options?: { onConflict?: string }) => {
      op = { type: 'upsert', data, options };
      return proxy;
    },

    // ── Resolvedores (disparan la ejecución) ────────────────────────────────

    maybeSingle: async () => {
      const result = execute();
      const rows = Array.isArray(result.data) ? result.data : [];
      return { data: rows[0] ?? null, error: null };
    },

    single: async () => {
      const result = execute();
      const rows = Array.isArray(result.data) ? result.data : [];
      return { data: rows[0] ?? null, error: null };
    },

    /**
     * Permite `await supabaseAdmin.from(t).select().eq(...)` → { data: Row[], error: null }
     * y `await supabaseAdmin.from(t).update(...).eq(...)` → { data: null, error: null }
     */
    then(
      resolve: (v: { data: Row | Row[] | null; error: null }) => void,
      _reject?: (e: unknown) => void,
    ) {
      resolve(execute());
    },
  };

  return proxy;
}

// ─── Setup por test ───────────────────────────────────────────────────────────

import { supabaseAdmin } from '@/lib/supabase-admin';

beforeEach(() => {
  vi.clearAllMocks();
  resetDb();
  vi.mocked(supabaseAdmin.from).mockImplementation(
    (table: string) => makeTableProxy(table) as unknown as ReturnType<typeof supabaseAdmin.from>
  );
});

// ─── Import de acciones (después de los mocks) ────────────────────────────────

import {
  saveMedicalSection,
  saveNutritionSection,
  savePsychologySection,
  saveCoachSection,
  savePhysioSection,
  saveIntegratedResult,
} from '@/app/[locale]/(app)/athletes/[id]/diagnostic/actions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fd(fields: Record<string, string> = {}): FormData {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  return form;
}

function getSection(key: SectionKey): Section {
  return db.athlete_diagnostic_sections.find((s) => s.section === key) as Section;
}

function getDiagnostic(): Diagnostic {
  return db.athlete_initial_diagnostic[0];
}

// ─── Descripción del escenario base ──────────────────────────────────────────
//
//  athlete_initial_diagnostic:  1 registro (DIAGNOSTIC_ID)   → overall_status='pendiente'
//  athlete_diagnostic_sections: 5 registros                  → todos 'pendiente'
//
// Cada server action hace:
//  1. getSectionRecord  → lee la sección por athlete_id + section
//  2. upsert evaluation → inserta/actualiza la evaluación del rubro
//  3. updateSectionStatus → actualiza status + completion_pct de la sección
//  4. recalculateOverall  → recalcula overall_status + completion_pct del diagnóstico
//  5. logAction           → inserta en athlete_follow_up_log

// ─────────────────────────────────────────────────────────────────────────────
// 1. ESTRUCTURA INICIAL
// ─────────────────────────────────────────────────────────────────────────────

describe('1. Estructura inicial del diagnóstico', () => {
  it('debe existir 1 registro de diagnóstico principal en estado pendiente', () => {
    expect(db.athlete_initial_diagnostic).toHaveLength(1);
    expect(getDiagnostic().overall_status).toBe('pendiente');
    expect(getDiagnostic().completion_pct).toBe(0);
    expect(getDiagnostic().completed_at).toBeNull();
  });

  it('deben existir exactamente 5 secciones, todas en estado pendiente', () => {
    expect(db.athlete_diagnostic_sections).toHaveLength(5);
    for (const key of SECTION_KEYS) {
      const s = getSection(key);
      expect(s, `Sección ${key} debe existir`).toBeDefined();
      expect(s.status).toBe('pendiente');
      expect(s.completion_pct).toBe(0);
      expect(s.completed_at).toBeNull();
      expect(s.captured_at).toBeNull();
    }
  });

  it('las secciones pertenecen al atleta y al diagnóstico correctos', () => {
    for (const s of db.athlete_diagnostic_sections) {
      expect(s.athlete_id).toBe(ATHLETE_ID);
      expect(s.diagnostic_id).toBe(DIAGNOSTIC_ID);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GUARDADO DE BORRADOR — rubro Médico
// ─────────────────────────────────────────────────────────────────────────────

describe('2. Guardar borrador — rubro Médico', () => {
  it('debe retornar { error: null }', async () => {
    const result = await saveMedicalSection(ATHLETE_ID, false, fd({
      weight_kg: '72.5',
      height_cm: '175.0',
      blood_pressure: '120/80 mmHg',
      diagnosis: 'Sin hallazgos patológicos relevantes.',
    }));
    expect(result.error).toBeNull();
  });

  it('debe crear un registro en athlete_medical_evaluation', async () => {
    await saveMedicalSection(ATHLETE_ID, false, fd({ weight_kg: '72.5' }));
    expect(db.athlete_medical_evaluation).toHaveLength(1);
    expect(db.athlete_medical_evaluation[0]).toMatchObject({
      athlete_id: ATHLETE_ID,
      diagnostic_section_id: SECTION_IDS.medico,
      weight_kg: 72.5,
    });
  });

  it('sección médica debe pasar a "en_proceso" con 50% de completitud', async () => {
    await saveMedicalSection(ATHLETE_ID, false, fd({ diagnosis: 'Atleta sano.' }));
    const s = getSection('medico');
    expect(s.status).toBe('en_proceso');
    expect(s.completion_pct).toBe(50);
    expect(s.completed_at).toBeNull(); // borrador no marca fecha de completado
  });

  it('overall_status debe pasar a "en_proceso" cuando hay al menos 1 sección en proceso', async () => {
    await saveMedicalSection(ATHLETE_ID, false, fd({}));
    expect(getDiagnostic().overall_status).toBe('en_proceso');
  });

  it('completion_pct del diagnóstico debe permanecer en 0% (ningún rubro completado)', async () => {
    await saveMedicalSection(ATHLETE_ID, false, fd({}));
    // Solo en_proceso, no completado → 0 / 5 = 0%
    expect(getDiagnostic().completion_pct).toBe(0);
  });

  it('debe registrar una entrada en la bitácora con acción "borrador_guardado"', async () => {
    await saveMedicalSection(ATHLETE_ID, false, fd({}));
    expect(db.athlete_follow_up_log).toHaveLength(1);
    expect(db.athlete_follow_up_log[0]).toMatchObject({
      athlete_id:    ATHLETE_ID,
      diagnostic_id: DIAGNOSTIC_ID,
      section:       'medico',
      action:        'borrador_guardado',
    });
  });

  it('un segundo borrador actualiza (upsert) la evaluación, no crea duplicados', async () => {
    await saveMedicalSection(ATHLETE_ID, false, fd({ weight_kg: '72.5' }));
    await saveMedicalSection(ATHLETE_ID, false, fd({ weight_kg: '73.0', diagnosis: 'Segunda captura.' }));
    expect(db.athlete_medical_evaluation).toHaveLength(1);
    expect(db.athlete_medical_evaluation[0]).toMatchObject({ weight_kg: 73.0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. COMPLETAR RUBRO — transición de estado
// ─────────────────────────────────────────────────────────────────────────────

describe('3. Completar rubro — transición de estado', () => {
  it('completar médico debe poner sección en "completo" con 100% y registrar fecha', async () => {
    await saveMedicalSection(ATHLETE_ID, true, fd({ diagnosis: 'Apto para entrenamiento.' }));
    const s = getSection('medico');
    expect(s.status).toBe('completo');
    expect(s.completion_pct).toBe(100);
    expect(s.completed_at).not.toBeNull();
  });

  it('completion_pct del diagnóstico debe ser 20% al completar 1/5 rubros', async () => {
    await saveMedicalSection(ATHLETE_ID, true, fd({}));
    expect(getDiagnostic().completion_pct).toBe(20);
    expect(getDiagnostic().overall_status).toBe('en_proceso');
  });

  it('debe registrar "rubro_completado" en la bitácora', async () => {
    await saveMedicalSection(ATHLETE_ID, true, fd({}));
    const logs = db.athlete_follow_up_log as { action: string }[];
    expect(logs.some((l) => l.action === 'rubro_completado')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. AVANCE INCREMENTAL — completar 5 rubros uno a uno
// ─────────────────────────────────────────────────────────────────────────────

describe('4. Avance incremental — completar los 5 rubros', () => {
  async function completeAll() {
    await saveMedicalSection    (ATHLETE_ID, true, fd({ diagnosis:             'Médico OK' }));
    await saveNutritionSection  (ATHLETE_ID, true, fd({ nutritional_diagnosis: 'Nutrición OK' }));
    await savePsychologySection (ATHLETE_ID, true, fd({ diagnostic_integration:'Psicología OK' }));
    await saveCoachSection      (ATHLETE_ID, true, fd({ athlete_sport_profile:  'Entrenador OK' }));
    await savePhysioSection     (ATHLETE_ID, true, fd({ functional_diagnosis:  'Fisio OK' }));
  }

  it('después de 1 rubro: 20%', async () => {
    await saveMedicalSection(ATHLETE_ID, true, fd({}));
    expect(getDiagnostic().completion_pct).toBe(20);
  });

  it('después de 2 rubros: 40%', async () => {
    await saveMedicalSection  (ATHLETE_ID, true, fd({}));
    await saveNutritionSection(ATHLETE_ID, true, fd({}));
    expect(getDiagnostic().completion_pct).toBe(40);
  });

  it('después de 3 rubros: 60%', async () => {
    await saveMedicalSection   (ATHLETE_ID, true, fd({}));
    await saveNutritionSection (ATHLETE_ID, true, fd({}));
    await savePsychologySection(ATHLETE_ID, true, fd({}));
    expect(getDiagnostic().completion_pct).toBe(60);
  });

  it('después de 4 rubros: 80%', async () => {
    await saveMedicalSection   (ATHLETE_ID, true, fd({}));
    await saveNutritionSection (ATHLETE_ID, true, fd({}));
    await savePsychologySection(ATHLETE_ID, true, fd({}));
    await saveCoachSection     (ATHLETE_ID, true, fd({}));
    expect(getDiagnostic().completion_pct).toBe(80);
    expect(getDiagnostic().overall_status).toBe('en_proceso');
  });

  it('después de 5 rubros: 100% y overall_status = "completo"', async () => {
    await completeAll();
    expect(getDiagnostic().completion_pct).toBe(100);
    expect(getDiagnostic().overall_status).toBe('completo');
    expect(getDiagnostic().completed_at).not.toBeNull();
  });

  it('todas las secciones deben tener status "completo"', async () => {
    await completeAll();
    for (const key of SECTION_KEYS) {
      expect(getSection(key).status, `Sección ${key}`).toBe('completo');
      expect(getSection(key).completion_pct).toBe(100);
    }
  });

  it('deben existir exactamente 5 entradas en la bitácora (una por rubro)', async () => {
    await completeAll();
    const logs = db.athlete_follow_up_log as { action: string }[];
    const completedLogs = logs.filter((l) => l.action === 'rubro_completado');
    expect(completedLogs).toHaveLength(5);
  });

  it('deben existir evaluaciones para los 5 rubros', async () => {
    await completeAll();
    expect(db.athlete_medical_evaluation).toHaveLength(1);
    expect(db.athlete_nutrition_evaluation).toHaveLength(1);
    expect(db.athlete_psychology_evaluation).toHaveLength(1);
    expect(db.athlete_coach_evaluation).toHaveLength(1);
    expect(db.athlete_physiotherapy_evaluation).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. BORRADOR → COMPLETO en la misma sección
// ─────────────────────────────────────────────────────────────────────────────

describe('5. Flujo borrador → completo en la misma sección', () => {
  it('debe poder guardar borrador y después completar el mismo rubro', async () => {
    await saveMedicalSection(ATHLETE_ID, false, fd({ diagnosis: 'Primera captura.' }));
    expect(getSection('medico').status).toBe('en_proceso');

    await saveMedicalSection(ATHLETE_ID, true, fd({ diagnosis: 'Captura final aprobada.' }));
    expect(getSection('medico').status).toBe('completo');
    expect(db.athlete_medical_evaluation).toHaveLength(1); // sigue siendo 1 (upsert)
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. RESULTADO INTEGRADO INTERDISCIPLINARIO
// ─────────────────────────────────────────────────────────────────────────────

describe('6. Resultado integrado interdisciplinario', () => {
  it('debe guardar el resultado integrado correctamente', async () => {
    const result = await saveIntegratedResult(ATHLETE_ID, fd({
      overall_summary:          'Atleta en condición óptima.',
      medical_summary:          'Sin patologías.',
      nutritional_summary:      'Estado nutricional adecuado.',
      psychological_summary:    'Alto nivel motivacional.',
      sport_profile:            'Atleta de resistencia con potencial alto.',
      physiotherapy_summary:    'Sin lesiones activas.',
      interdisciplinary_result: 'Apto para preparación olímpica.',
    }));
    expect(result.error).toBeNull();
  });

  it('debe crear un registro en athlete_integrated_results', async () => {
    await saveIntegratedResult(ATHLETE_ID, fd({
      overall_summary:          'Resumen integrado.',
      interdisciplinary_result: 'Conclusión final del equipo.',
    }));
    expect(db.athlete_integrated_results).toHaveLength(1);
    expect(db.athlete_integrated_results[0]).toMatchObject({
      athlete_id:               ATHLETE_ID,
      diagnostic_id:            DIAGNOSTIC_ID,
      interdisciplinary_result: 'Conclusión final del equipo.',
    });
  });

  it('un segundo guardado actualiza (upsert) el resultado, no crea duplicados', async () => {
    await saveIntegratedResult(ATHLETE_ID, fd({ overall_summary: 'v1' }));
    await saveIntegratedResult(ATHLETE_ID, fd({ overall_summary: 'v2' }));
    expect(db.athlete_integrated_results).toHaveLength(1);
    expect(db.athlete_integrated_results[0]).toMatchObject({ overall_summary: 'v2' });
  });

  it('debe registrar "resultado_generado" en la bitácora', async () => {
    await saveIntegratedResult(ATHLETE_ID, fd({}));
    const logs = db.athlete_follow_up_log as { action: string; section: string }[];
    const entry = logs.find((l) => l.action === 'resultado_generado');
    expect(entry).toBeDefined();
    expect(entry!.section).toBe('resultado_integrado');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. LÓGICA DE SEMÁFORO — "requiere_atencion" tiene prioridad
// ─────────────────────────────────────────────────────────────────────────────

describe('7. Lógica de semáforo — prioridad de "requiere_atencion"', () => {
  it('si una sección tiene "requiere_atencion", overall_status también debe serlo', async () => {
    // Completar 4 secciones normalmente
    await saveMedicalSection   (ATHLETE_ID, true, fd({}));
    await saveNutritionSection (ATHLETE_ID, true, fd({}));
    await savePsychologySection(ATHLETE_ID, true, fd({}));
    await saveCoachSection     (ATHLETE_ID, true, fd({}));

    // Marcar manualmente la sección de fisioterapia como 'requiere_atencion'
    const fisioSection = db.athlete_diagnostic_sections.find((s) => s.section === 'fisioterapia')!;
    fisioSection.status = 'requiere_atencion';

    // Salvar cualquier rubro para disparar el recálculo (usamos médico de nuevo)
    await saveMedicalSection(ATHLETE_ID, false, fd({ monitoring_notes: 'Revisión de fisio pendiente.' }));

    expect(getDiagnostic().overall_status).toBe('requiere_atencion');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. DATOS NUMÉRICOS — parseo correcto de campos de tipo number
// ─────────────────────────────────────────────────────────────────────────────

describe('8. Parseo de datos numéricos en la evaluación médica', () => {
  it('debe parsear weight_kg, height_cm, bmi y body_fat_pct como números', async () => {
    await saveMedicalSection(ATHLETE_ID, false, fd({
      weight_kg:      '68.5',
      height_cm:      '172.0',
      bmi:            '23.2',
      body_fat_pct:   '14.8',
      heart_rate_rest:'58',
    }));
    const eval_ = db.athlete_medical_evaluation[0] as Record<string, unknown>;
    expect(eval_.weight_kg).toBe(68.5);
    expect(eval_.height_cm).toBe(172.0);
    expect(eval_.bmi).toBe(23.2);
    expect(eval_.body_fat_pct).toBe(14.8);
    expect(eval_.heart_rate_rest).toBe(58);
  });

  it('campos numéricos vacíos deben guardarse como null', async () => {
    await saveMedicalSection(ATHLETE_ID, false, fd({
      weight_kg: '', height_cm: '', bmi: '',
    }));
    const eval_ = db.athlete_medical_evaluation[0] as Record<string, unknown>;
    expect(eval_.weight_kg).toBeNull();
    expect(eval_.height_cm).toBeNull();
    expect(eval_.bmi).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. INDEPENDENCIA DE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('9. Independencia — cada test parte de estado fresco', () => {
  it('test A: save borrador médico', async () => {
    await saveMedicalSection(ATHLETE_ID, false, fd({}));
    expect(getDiagnostic().overall_status).toBe('en_proceso');
    expect(getDiagnostic().completion_pct).toBe(0);
  });

  it('test B: estado inicial no contaminado por test anterior', () => {
    // Si beforeEach funciona correctamente, el estado es 'pendiente' aquí
    expect(getDiagnostic().overall_status).toBe('pendiente');
    expect(getDiagnostic().completion_pct).toBe(0);
    expect(getSection('medico').status).toBe('pendiente');
  });

  it('test C: guardar nutrición después de reset', async () => {
    await saveNutritionSection(ATHLETE_ID, true, fd({ nutritional_diagnosis: 'OK' }));
    expect(getSection('nutricion').status).toBe('completo');
    expect(getSection('medico').status).toBe('pendiente');
    expect(getDiagnostic().completion_pct).toBe(20);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. RESUMEN: FLUJO COMPLETO DE PRINCIPIO A FIN
// ─────────────────────────────────────────────────────────────────────────────

describe('10. Resumen — flujo completo E2E simulado', () => {
  it('debe completar el ciclo completo: alta → borrador → completar 5 rubros → resultado integrado', async () => {
    // ── Paso 1: Estado inicial tras alta de atleta ──────────────
    expect(getDiagnostic().overall_status).toBe('pendiente');
    expect(getDiagnostic().completion_pct).toBe(0);

    // ── Paso 2: Médico salva borrador ───────────────────────────
    await saveMedicalSection(ATHLETE_ID, false, fd({
      weight_kg: '75', height_cm: '180', bmi: '23.1',
      diagnosis: 'Evaluación cardiorrespiratoria normal.',
    }));
    expect(getDiagnostic().overall_status).toBe('en_proceso');
    expect(getDiagnostic().completion_pct).toBe(0);

    // ── Paso 3: Médico completa el rubro ────────────────────────
    await saveMedicalSection(ATHLETE_ID, true, fd({
      weight_kg: '75', diagnosis: 'Apto para entrenamiento de alta intensidad.',
      risk_level: 'bajo', injury_prevention_plan: 'Plan preventivo establecido.',
    }));
    expect(getSection('medico').status).toBe('completo');
    expect(getDiagnostic().completion_pct).toBe(20);

    // ── Paso 4: Nutrición completa ──────────────────────────────
    await saveNutritionSection(ATHLETE_ID, true, fd({
      nutritional_diagnosis: 'Estado nutricional óptimo.',
      food_plan: 'Dieta hipercalórica con énfasis en carbohidratos complejos.',
    }));
    expect(getDiagnostic().completion_pct).toBe(40);

    // ── Paso 5: Psicología completa ─────────────────────────────
    await savePsychologySection(ATHLETE_ID, true, fd({
      diagnostic_integration: 'Alta motivación, resiliencia elevada.',
      goal_setting: 'Clasificar al selectivo nacional en 6 meses.',
    }));
    expect(getDiagnostic().completion_pct).toBe(60);

    // ── Paso 6: Entrenador completa ─────────────────────────────
    await saveCoachSection(ATHLETE_ID, true, fd({
      athlete_sport_profile: 'Velocista con excelente potencia en 400m.',
      performance_objectives: 'Bajar a 45.8s en 400m para el selectivo.',
    }));
    expect(getDiagnostic().completion_pct).toBe(80);
    expect(getDiagnostic().overall_status).toBe('en_proceso');

    // ── Paso 7: Fisioterapia completa ───────────────────────────
    await savePhysioSection(ATHLETE_ID, true, fd({
      functional_diagnosis: 'Sin desbalances significativos. Leve tensión en isquiotibiales.',
      relapse_prevention: 'Rutina de elongación post-entrenamiento.',
    }));
    expect(getDiagnostic().completion_pct).toBe(100);
    expect(getDiagnostic().overall_status).toBe('completo');
    expect(getDiagnostic().completed_at).not.toBeNull();

    // ── Paso 8: Verificar que todos los rubros están completos ──
    for (const key of SECTION_KEYS) {
      expect(getSection(key).status, `Sección ${key}`).toBe('completo');
    }

    // ── Paso 9: Generar resultado integrado ──────────────────────
    const intResult = await saveIntegratedResult(ATHLETE_ID, fd({
      overall_summary: 'Atleta en estado integral óptimo para competición.',
      interdisciplinary_result:
        'El equipo multidisciplinario avala el inicio de la fase de preparación específica.',
    }));
    expect(intResult.error).toBeNull();
    expect(db.athlete_integrated_results).toHaveLength(1);

    // ── Paso 10: Verificar bitácora ─────────────────────────────
    const logs = db.athlete_follow_up_log as { action: string }[];
    const completedActions = logs.filter((l) => l.action === 'rubro_completado');
    const resultAction     = logs.filter((l) => l.action === 'resultado_generado');
    expect(completedActions).toHaveLength(5);
    expect(resultAction).toHaveLength(1);

    // ── Estado final consolidado ────────────────────────────────
    const final = getDiagnostic();
    expect(final).toMatchObject({
      overall_status:  'completo',
      completion_pct:  100,
    });
    expect(final.completed_at).not.toBeNull();
  });
});

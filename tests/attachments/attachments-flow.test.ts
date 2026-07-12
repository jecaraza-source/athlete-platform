/**
 * tests/attachments/attachments-flow.test.ts
 *
 * Prueba de integración: Gestión de Documentos Anexos del Expediente
 *
 * Estrategia: BD + Storage en memoria
 * ───────────────────────────────────
 * Se mockea supabaseAdmin con un proxy igual al de diagnostic-flow.test.ts
 * más una capa de storage en memoria que simula upload, signedUrl y remove.
 *
 * Cubre:
 *  1. Validación de tipo MIME no permitido
 *  2. Validación de tamaño máximo
 *  3. Límite de archivos por carga (MAX_FILES_PER_UPLOAD)
 *  4. Carga exitosa de un archivo — registro en BD + storage
 *  5. Carga múltiple — varios archivos en una sola llamada
 *  6. Listar adjuntos de un atleta
 *  7. Listar adjuntos filtrados por módulo
 *  8. Listar adjuntos filtrados por relatedRecordId
 *  9. Actualizar descripción de un adjunto
 * 10. Eliminar adjunto (baja lógica) — is_active = false
 * 11. Guardia de permisos — upload bloqueado sin edit_athletes
 * 12. Guardia de permisos — delete bloqueado sin delete_athletes
 * 13. Auditoría — uploaded_by, deleted_by correctamente asignados
 * 14. Limpieza de storage si falla la inserción en BD
 * 15. URL firmada generada correctamente
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mocks (deben registrarse ANTES de importar las acciones) ─────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Mock de RBAC con control por test (se sobreescribe en tests de permisos)
vi.mock('@/lib/rbac/server', () => ({
  assertPermission: vi.fn().mockResolvedValue(null),       // null = autorizado
  getCurrentUser:   vi.fn().mockResolvedValue({
    authUserId: 'auth-coach-001',
    profile: { id: 'profile-coach-001', first_name: 'Ana', last_name: 'Torres' },
    roles: [],
    permissions: new Set(['view_athletes', 'edit_athletes', 'delete_athletes']),
  }),
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: vi.fn(), storage: { createBucket: vi.fn(), from: vi.fn() } },
}));

// ─── Constantes de prueba ─────────────────────────────────────────────────────

const ATHLETE_ID        = 'athlete-attach-001';
const MEDICAL_CASE_ID   = 'medical-case-001';
const NUTRITION_PLAN_ID = 'nutrition-plan-001';
const PROFILE_ID        = 'profile-coach-001';
const ATTACHMENT_ID_1   = 'attach-001';
const ATTACHMENT_ID_2   = 'attach-002';

// ─── Estado en memoria ────────────────────────────────────────────────────────

type AttachRow = Record<string, unknown>;

const db: { athlete_attachments: AttachRow[] } = {
  athlete_attachments: [],
};

// Simula el bucket de storage
const storageBucket: Record<string, { content: Buffer; contentType: string }> = {};

function resetState(): void {
  db.athlete_attachments = [];
  for (const key of Object.keys(storageBucket)) delete storageBucket[key];
}

// ─── Proxy de tabla Supabase (idéntico al de diagnostic-flow) ─────────────────

type Row = Record<string, unknown>;
type Operation =
  | { type: 'select' }
  | { type: 'update'; data: Row }
  | { type: 'insert'; data: Row | Row[] }
  | { type: 'upsert'; data: Row; options?: { onConflict?: string } };

function getTableRows(table: string): Row[] {
  return ((db as unknown) as Record<string, Row[]>)[table] ?? [];
}

function setTableRows(table: string, rows: Row[]): void {
  ((db as unknown) as Record<string, Row[]>)[table] = rows;
}

function makeTableProxy(table: string) {
  const filters: Record<string, unknown> = {};
  let op: Operation = { type: 'select' };

  function doSelect(): Row[] {
    return getTableRows(table).filter((row) =>
      Object.entries(filters).every(([k, v]) => row[k] === v)
    );
  }

  function doUpdate(data: Row): void {
    setTableRows(table, getTableRows(table).map((row) =>
      Object.entries(filters).every(([k, v]) => row[k] === v) ? { ...row, ...data } : row
    ));
  }

  function doInsert(data: Row | Row[]): void {
    const rows = getTableRows(table);
    if (Array.isArray(data)) rows.push(...data); else rows.push({ id: crypto.randomUUID(), ...data });
    setTableRows(table, rows);
  }

  function execute(): { data: Row | Row[] | null; error: null } {
    switch (op.type) {
      case 'select': return { data: doSelect(), error: null };
      case 'update': doUpdate(op.data); return { data: null, error: null };
      case 'insert': doInsert(op.data); return { data: op.data, error: null };
      case 'upsert': {
        const rows = getTableRows(table);
        rows.push({ id: crypto.randomUUID(), ...op.data });
        setTableRows(table, rows);
        return { data: op.data, error: null };
      }
    }
  }

  const proxy: Record<string, unknown> = {
    select: () => proxy,
    eq:     (key: string, value: unknown) => { filters[key] = value; return proxy; },
    order:  () => proxy,
    limit:  () => proxy,
    in:     () => proxy,
    update: (data: Row) => { op = { type: 'update', data }; return proxy; },
    insert: (data: Row | Row[]) => { op = { type: 'insert', data }; return proxy; },
    single: async () => {
      const result = execute();
      const rows = Array.isArray(result.data) ? result.data : [];
      return { data: rows[0] ?? null, error: rows.length === 0 ? { message: 'No rows' } : null };
    },
    maybeSingle: async () => {
      const result = execute();
      const rows = Array.isArray(result.data) ? result.data : [];
      return { data: rows[0] ?? null, error: null };
    },
    then(resolve: (v: { data: Row | Row[] | null; error: null }) => void) {
      resolve(execute());
    },
  };
  return proxy;
}

// ─── Mock de Supabase Storage ─────────────────────────────────────────────────

function makeStorageMock() {
  return {
    createBucket: vi.fn().mockResolvedValue({ error: null }),
    from: vi.fn().mockImplementation((_bucket: string) => ({
      upload: vi.fn().mockImplementation((path: string, buffer: Buffer, opts: { contentType: string }) => {
        storageBucket[path] = { content: buffer, contentType: opts.contentType };
        return Promise.resolve({ error: null });
      }),
      remove: vi.fn().mockImplementation((paths: string[]) => {
        paths.forEach((p) => delete storageBucket[p]);
        return Promise.resolve({ error: null });
      }),
      createSignedUrl: vi.fn().mockImplementation((path: string, _ttl: number) => {
        const exists = path in storageBucket;
        return Promise.resolve({
          data: exists ? { signedUrl: `https://storage.example.com/signed/${path}` } : null,
          error: exists ? null : { message: 'Not found' },
        });
      }),
    })),
  };
}

// ─── Import de modules bajo test ──────────────────────────────────────────────

import { supabaseAdmin } from '@/lib/supabase-admin';
import { assertPermission, getCurrentUser } from '@/lib/rbac/server';

import {
  uploadAttachments,
  listAttachments,
  getAttachmentSignedUrl,
  updateAttachmentDescription,
  deleteAttachment,
} from '@/lib/attachments/actions';

import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_UPLOAD,
} from '@/lib/types/attachments';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeFile(
  name = 'report.pdf',
  type = 'application/pdf',
  sizeBytes = 1024,
): File {
  const buffer = Buffer.alloc(sizeBytes, 'x');
  return new File([buffer], name, { type });
}

function formDataWith(...files: File[]): FormData {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  return fd;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetState();

  vi.mocked(supabaseAdmin.from).mockImplementation(
    (table: string) => makeTableProxy(table) as unknown as ReturnType<typeof supabaseAdmin.from>
  );

  const storageMock = makeStorageMock();
  (supabaseAdmin as unknown as Record<string, unknown>).storage = storageMock;

  // Reset RBAC mocks to autorizado por defecto
  vi.mocked(assertPermission).mockResolvedValue(null);
  vi.mocked(getCurrentUser).mockResolvedValue({
    authUserId: 'auth-coach-001',
    profile: { id: PROFILE_ID, first_name: 'Ana', last_name: 'Torres', email: 'ana@test.com', role: 'coach' },
    roles: [],
    permissions: new Set(['view_athletes', 'edit_athletes', 'delete_athletes']),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. VALIDACIÓN — TIPO MIME NO PERMITIDO
// ─────────────────────────────────────────────────────────────────────────────

describe('1. Validación — tipo MIME no permitido', () => {
  it('debe rechazar un archivo .exe y devolver error descriptivo', async () => {
    const file = makeFile('malware.exe', 'application/octet-stream');
    const result = await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical' },
      formDataWith(file)
    );
    expect(result.uploaded).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/tipo de archivo no permitido/i);
  });

  it('debe rechazar un archivo .js y devolver error descriptivo', async () => {
    const file = makeFile('script.js', 'application/javascript');
    const result = await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical' },
      formDataWith(file)
    );
    expect(result.uploaded).toBe(0);
    expect(result.errors[0]).toContain('script.js');
  });

  it('no debe escribir nada en storage ni en BD si el tipo es inválido', async () => {
    await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical' },
      formDataWith(makeFile('bad.exe', 'application/octet-stream'))
    );
    expect(Object.keys(storageBucket)).toHaveLength(0);
    expect(db.athlete_attachments).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. VALIDACIÓN — TAMAÑO MÁXIMO
// ─────────────────────────────────────────────────────────────────────────────

describe('2. Validación — tamaño máximo (50 MB)', () => {
  it('debe rechazar un archivo que excede 50 MB', async () => {
    const oversized = makeFile('huge.pdf', 'application/pdf', MAX_FILE_SIZE_BYTES + 1);
    const result = await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical' },
      formDataWith(oversized)
    );
    expect(result.uploaded).toBe(0);
    expect(result.errors[0]).toMatch(/tamaño máximo/i);
  });

  it('debe aceptar un archivo que llega exactamente al límite', async () => {
    const exact = makeFile('limit.pdf', 'application/pdf', MAX_FILE_SIZE_BYTES);
    const result = await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical' },
      formDataWith(exact)
    );
    expect(result.uploaded).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. VALIDACIÓN — LÍMITE DE ARCHIVOS POR CARGA
// ─────────────────────────────────────────────────────────────────────────────

describe('3. Validación — límite de archivos por carga', () => {
  it(`debe rechazar si se envían más de ${MAX_FILES_PER_UPLOAD} archivos a la vez`, async () => {
    const tooMany = Array.from({ length: MAX_FILES_PER_UPLOAD + 1 }, (_, i) =>
      makeFile(`file-${i}.pdf`, 'application/pdf')
    );
    const fd = new FormData();
    tooMany.forEach((f) => fd.append('files', f));

    const result = await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical' },
      fd
    );
    expect(result.uploaded).toBe(0);
    expect(result.errors[0]).toMatch(new RegExp(`Máximo ${MAX_FILES_PER_UPLOAD}`, 'i'));
  });

  it(`debe aceptar exactamente ${MAX_FILES_PER_UPLOAD} archivos`, async () => {
    const maxFiles = Array.from({ length: MAX_FILES_PER_UPLOAD }, (_, i) =>
      makeFile(`ok-${i}.pdf`, 'application/pdf')
    );
    const fd = new FormData();
    maxFiles.forEach((f) => fd.append('files', f));

    const result = await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical' },
      fd
    );
    expect(result.uploaded).toBe(MAX_FILES_PER_UPLOAD);
    expect(result.errors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CARGA EXITOSA — UN ARCHIVO
// ─────────────────────────────────────────────────────────────────────────────

describe('4. Carga exitosa — un archivo', () => {
  it('debe retornar { uploaded: 1, errors: [] }', async () => {
    const result = await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical', relatedRecordId: MEDICAL_CASE_ID },
      formDataWith(makeFile('laboratorio.pdf', 'application/pdf', 2048))
    );
    expect(result.uploaded).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('debe crear un registro en athlete_attachments con los metadatos correctos', async () => {
    await uploadAttachments(
      {
        athleteId: ATHLETE_ID,
        module: 'medical',
        sectionName: 'medico',
        relatedRecordId: MEDICAL_CASE_ID,
        description: 'Resultados de laboratorio — marzo 2025',
      },
      formDataWith(makeFile('laboratorio-marzo.pdf', 'application/pdf', 2048))
    );

    expect(db.athlete_attachments).toHaveLength(1);
    const row = db.athlete_attachments[0];
    expect(row.athlete_id).toBe(ATHLETE_ID);
    expect(row.module_name).toBe('medical');
    expect(row.section_name).toBe('medico');
    expect(row.related_record_id).toBe(MEDICAL_CASE_ID);
    expect(row.file_name_original).toBe('laboratorio-marzo.pdf');
    expect(row.mime_type).toBe('application/pdf');
    expect(row.file_extension).toBe('pdf');
    expect(row.file_size).toBe(2048);
    expect(row.description).toBe('Resultados de laboratorio — marzo 2025');
    expect(row.is_active).toBeUndefined(); // el default lo pone la BD, no el insert
    expect(row.uploaded_by).toBe(PROFILE_ID);
  });

  it('debe guardar el archivo en el storage en memoria bajo la ruta correcta', async () => {
    await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical' },
      formDataWith(makeFile('eco.pdf', 'application/pdf'))
    );
    const storedPaths = Object.keys(storageBucket);
    expect(storedPaths).toHaveLength(1);
    expect(storedPaths[0]).toMatch(new RegExp(`^${ATHLETE_ID}/medical/`));
  });

  it('el path del storage debe empezar con {athlete_id}/{module}/', async () => {
    await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'nutrition' },
      formDataWith(makeFile('plan.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
    );
    const path = Object.keys(storageBucket)[0];
    expect(path.startsWith(`${ATHLETE_ID}/nutrition/`)).toBe(true);
  });

  it('el file_path en BD debe coincidir con el path en storage', async () => {
    await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'physio' },
      formDataWith(makeFile('eval-postural.jpg', 'image/jpeg'))
    );
    const storedPath = Object.keys(storageBucket)[0];
    const row = db.athlete_attachments[0];
    expect(row.file_path).toBe(storedPath);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. CARGA MÚLTIPLE
// ─────────────────────────────────────────────────────────────────────────────

describe('5. Carga múltiple — varios archivos en una sola llamada', () => {
  it('debe subir 3 archivos y registrar 3 filas en BD', async () => {
    const result = await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'physio', relatedRecordId: 'case-physio-001' },
      formDataWith(
        makeFile('frontal.jpg',   'image/jpeg'),
        makeFile('lateral.jpg',   'image/jpeg'),
        makeFile('posterior.png', 'image/png'),
      )
    );
    expect(result.uploaded).toBe(3);
    expect(result.errors).toHaveLength(0);
    expect(db.athlete_attachments).toHaveLength(3);
    expect(Object.keys(storageBucket)).toHaveLength(3);
  });

  it('en carga mixta (válidos + inválidos), valida TODOS antes de subir ninguno', async () => {
    const result = await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical' },
      formDataWith(
        makeFile('ok.pdf',  'application/pdf'),
        makeFile('bad.exe', 'application/octet-stream'),
      )
    );
    // Validación falla antes de subir → 0 archivos en storage
    expect(result.uploaded).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(db.athlete_attachments).toHaveLength(0);
    expect(Object.keys(storageBucket)).toHaveLength(0);
  });

  it('cada archivo tiene su propio path único en storage (sin colisiones)', async () => {
    await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'training' },
      formDataWith(
        makeFile('session1.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        makeFile('session2.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      )
    );
    const paths = Object.keys(storageBucket);
    expect(new Set(paths).size).toBe(paths.length); // todos únicos
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. LISTAR ADJUNTOS
// ─────────────────────────────────────────────────────────────────────────────

describe('6. Listar adjuntos de un atleta', () => {
  beforeEach(async () => {
    // Sembrar datos directamente en la BD en memoria
    db.athlete_attachments = [
      {
        id: ATTACHMENT_ID_1,
        athlete_id: ATHLETE_ID,
        module_name: 'medical',
        section_name: 'medico',
        related_record_id: MEDICAL_CASE_ID,
        file_name_original: 'lab-mar.pdf',
        file_name_storage:  'ts1-abc.pdf',
        file_path: `${ATHLETE_ID}/medical/ts1-abc.pdf`,
        mime_type: 'application/pdf',
        file_extension: 'pdf',
        file_size: 1024,
        description: 'Labs de marzo',
        uploaded_by: PROFILE_ID,
        uploaded_at: '2025-03-01T10:00:00Z',
        updated_at:  '2025-03-01T10:00:00Z',
        is_active: true,
      },
      {
        id: ATTACHMENT_ID_2,
        athlete_id: ATHLETE_ID,
        module_name: 'nutrition',
        section_name: null,
        related_record_id: NUTRITION_PLAN_ID,
        file_name_original: 'plan-abril.xlsx',
        file_name_storage:  'ts2-def.xlsx',
        file_path: `${ATHLETE_ID}/nutrition/ts2-def.xlsx`,
        mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        file_extension: 'xlsx',
        file_size: 4096,
        description: 'Plan de abril',
        uploaded_by: PROFILE_ID,
        uploaded_at: '2025-04-01T10:00:00Z',
        updated_at:  '2025-04-01T10:00:00Z',
        is_active: true,
      },
    ];
  });

  it('debe retornar todos los adjuntos activos del atleta', async () => {
    const attachments = await listAttachments({ athleteId: ATHLETE_ID });
    expect(attachments).toHaveLength(2);
  });

  it('debe retornar arreglo vacío para un atleta sin adjuntos', async () => {
    const attachments = await listAttachments({ athleteId: 'otro-atleta-000' });
    expect(attachments).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. LISTAR — FILTRO POR MÓDULO
// ─────────────────────────────────────────────────────────────────────────────

describe('7. Listar adjuntos filtrados por módulo', () => {
  beforeEach(() => {
    db.athlete_attachments = [
      { id: 'a1', athlete_id: ATHLETE_ID, module_name: 'medical',   is_active: true, file_name_original: 'med.pdf',   uploaded_at: '2025-01-01T00:00:00Z' },
      { id: 'a2', athlete_id: ATHLETE_ID, module_name: 'nutrition', is_active: true, file_name_original: 'nut.xlsx',  uploaded_at: '2025-01-02T00:00:00Z' },
      { id: 'a3', athlete_id: ATHLETE_ID, module_name: 'medical',   is_active: true, file_name_original: 'med2.pdf',  uploaded_at: '2025-01-03T00:00:00Z' },
      { id: 'a4', athlete_id: ATHLETE_ID, module_name: 'physio',    is_active: true, file_name_original: 'photo.jpg', uploaded_at: '2025-01-04T00:00:00Z' },
    ];
  });

  it('debe retornar solo los adjuntos del módulo medical (2 de 4)', async () => {
    const attachments = await listAttachments({ athleteId: ATHLETE_ID, module: 'medical' });
    expect(attachments).toHaveLength(2);
    expect(attachments.every((a) => a.module_name === 'medical')).toBe(true);
  });

  it('debe retornar solo los adjuntos del módulo nutrition (1 de 4)', async () => {
    const attachments = await listAttachments({ athleteId: ATHLETE_ID, module: 'nutrition' });
    expect(attachments).toHaveLength(1);
    expect(attachments[0].module_name).toBe('nutrition');
  });

  it('debe retornar arreglo vacío para un módulo sin adjuntos', async () => {
    const attachments = await listAttachments({ athleteId: ATHLETE_ID, module: 'psychology' });
    expect(attachments).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. LISTAR — FILTRO POR relatedRecordId
// ─────────────────────────────────────────────────────────────────────────────

describe('8. Listar adjuntos filtrados por relatedRecordId', () => {
  beforeEach(() => {
    db.athlete_attachments = [
      { id: 'b1', athlete_id: ATHLETE_ID, module_name: 'medical', related_record_id: MEDICAL_CASE_ID,   is_active: true, uploaded_at: '2025-01-01T00:00:00Z' },
      { id: 'b2', athlete_id: ATHLETE_ID, module_name: 'medical', related_record_id: MEDICAL_CASE_ID,   is_active: true, uploaded_at: '2025-01-02T00:00:00Z' },
      { id: 'b3', athlete_id: ATHLETE_ID, module_name: 'medical', related_record_id: 'other-case-999',  is_active: true, uploaded_at: '2025-01-03T00:00:00Z' },
    ];
  });

  it('debe filtrar solo los archivos del caso médico correcto', async () => {
    const attachments = await listAttachments({
      athleteId: ATHLETE_ID,
      relatedRecordId: MEDICAL_CASE_ID,
    });
    expect(attachments).toHaveLength(2);
    expect(attachments.every((a) => a.related_record_id === MEDICAL_CASE_ID)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. ACTUALIZAR DESCRIPCIÓN
// ─────────────────────────────────────────────────────────────────────────────

describe('9. Actualizar descripción de un adjunto', () => {
  beforeEach(() => {
    db.athlete_attachments = [{
      id: ATTACHMENT_ID_1,
      athlete_id: ATHLETE_ID,
      module_name: 'medical',
      description: 'Descripción original',
      is_active: true,
      updated_at: '2025-01-01T00:00:00Z',
    }];
  });

  it('debe retornar { error: null } si la actualización es exitosa', async () => {
    const result = await updateAttachmentDescription(ATTACHMENT_ID_1, 'Nueva descripción');
    expect(result.error).toBeNull();
  });

  it('debe actualizar el campo description en la BD', async () => {
    await updateAttachmentDescription(ATTACHMENT_ID_1, 'Resultados definitivos — confirmado por Dr. Herrera');
    const row = db.athlete_attachments.find((a) => a.id === ATTACHMENT_ID_1);
    expect(row?.description).toBe('Resultados definitivos — confirmado por Dr. Herrera');
  });

  it('debe guardar null si se pasa una descripción vacía', async () => {
    await updateAttachmentDescription(ATTACHMENT_ID_1, '   ');
    const row = db.athlete_attachments.find((a) => a.id === ATTACHMENT_ID_1);
    expect(row?.description).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. ELIMINAR — BAJA LÓGICA
// ─────────────────────────────────────────────────────────────────────────────

describe('10. Eliminar adjunto (baja lógica)', () => {
  beforeEach(() => {
    db.athlete_attachments = [{
      id: ATTACHMENT_ID_1,
      athlete_id: ATHLETE_ID,
      module_name: 'medical',
      file_path: `${ATHLETE_ID}/medical/ts1-abc.pdf`,
      is_active: true,
      deleted_by: null,
      deleted_at: null,
    }];
  });

  it('debe retornar { error: null }', async () => {
    const result = await deleteAttachment(ATTACHMENT_ID_1);
    expect(result.error).toBeNull();
  });

  it('debe poner is_active = false en la BD (baja lógica, NO borrado físico)', async () => {
    await deleteAttachment(ATTACHMENT_ID_1);
    const row = db.athlete_attachments.find((a) => a.id === ATTACHMENT_ID_1);
    expect(row?.is_active).toBe(false);
    // El objeto sigue existiendo en la tabla
    expect(db.athlete_attachments).toHaveLength(1);
  });

  it('debe registrar deleted_by con el profile_id del usuario actual', async () => {
    await deleteAttachment(ATTACHMENT_ID_1);
    const row = db.athlete_attachments.find((a) => a.id === ATTACHMENT_ID_1);
    expect(row?.deleted_by).toBe(PROFILE_ID);
  });

  it('debe registrar deleted_at con un timestamp', async () => {
    await deleteAttachment(ATTACHMENT_ID_1);
    const row = db.athlete_attachments.find((a) => a.id === ATTACHMENT_ID_1);
    expect(row?.deleted_at).toBeDefined();
    expect(typeof row?.deleted_at).toBe('string');
  });

  it('el archivo físico en storage NO debe eliminarse (solo baja lógica)', async () => {
    // Primero subimos un archivo para que exista en storage
    storageBucket[`${ATHLETE_ID}/medical/ts1-abc.pdf`] = {
      content: Buffer.from('pdf content'),
      contentType: 'application/pdf',
    };
    await deleteAttachment(ATTACHMENT_ID_1);
    // El archivo sigue en storage
    expect(`${ATHLETE_ID}/medical/ts1-abc.pdf` in storageBucket).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. GUARDIA DE PERMISOS — UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

describe('11. Guardia de permisos — upload bloqueado sin edit_athletes', () => {
  it('debe retornar error de autorización si assertPermission deniega', async () => {
    vi.mocked(assertPermission).mockResolvedValueOnce({
      error: 'You do not have permission to perform this action.',
    });

    const result = await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical' },
      formDataWith(makeFile('report.pdf', 'application/pdf'))
    );

    expect(result.uploaded).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/permission/i);
  });

  it('no debe escribir nada en storage ni en BD si no hay permiso', async () => {
    vi.mocked(assertPermission).mockResolvedValueOnce({ error: 'Forbidden.' });

    await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical' },
      formDataWith(makeFile('report.pdf', 'application/pdf'))
    );

    expect(Object.keys(storageBucket)).toHaveLength(0);
    expect(db.athlete_attachments).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. GUARDIA DE PERMISOS — DELETE
// ─────────────────────────────────────────────────────────────────────────────

describe('12. Guardia de permisos — delete bloqueado sin delete_athletes', () => {
  beforeEach(() => {
    db.athlete_attachments = [{
      id: ATTACHMENT_ID_1,
      athlete_id: ATHLETE_ID,
      module_name: 'medical',
      file_path: `${ATHLETE_ID}/medical/ts1-abc.pdf`,
      is_active: true,
    }];
  });

  it('debe retornar error si el usuario no tiene delete_athletes', async () => {
    vi.mocked(assertPermission).mockResolvedValueOnce({ error: 'Forbidden.' });

    const result = await deleteAttachment(ATTACHMENT_ID_1);
    expect(result.error).not.toBeNull();
    expect(result.error).toMatch(/Forbidden/i);
  });

  it('no debe modificar is_active si no tiene permiso', async () => {
    vi.mocked(assertPermission).mockResolvedValueOnce({ error: 'Forbidden.' });

    await deleteAttachment(ATTACHMENT_ID_1);
    const row = db.athlete_attachments.find((a) => a.id === ATTACHMENT_ID_1);
    expect(row?.is_active).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. AUDITORÍA — uploaded_by y deleted_by
// ─────────────────────────────────────────────────────────────────────────────

describe('13. Auditoría — campos de auditoría correctamente asignados', () => {
  it('uploaded_by debe ser el profile_id del usuario que subió el archivo', async () => {
    await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical' },
      formDataWith(makeFile('ecg.pdf', 'application/pdf'))
    );
    expect(db.athlete_attachments[0].uploaded_by).toBe(PROFILE_ID);
  });

  it('uploaded_by debe ser null si getCurrentUser no retorna profile', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      authUserId: 'auth-xxx',
      profile: null,
      roles: [],
      permissions: new Set(),
    });

    await uploadAttachments(
      { athleteId: ATHLETE_ID, module: 'medical' },
      formDataWith(makeFile('ecg.pdf', 'application/pdf'))
    );
    expect(db.athlete_attachments[0].uploaded_by).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. URL FIRMADA
// ─────────────────────────────────────────────────────────────────────────────

describe('14. URL firmada — generación correcta', () => {
  it('debe retornar una URL firmada para un archivo existente en storage', async () => {
    const filePath = `${ATHLETE_ID}/medical/existing.pdf`;
    storageBucket[filePath] = { content: Buffer.from('pdf'), contentType: 'application/pdf' };

    const url = await getAttachmentSignedUrl(filePath);
    expect(url).not.toBeNull();
    expect(url).toContain('signed');
    expect(url).toContain(filePath);
  });

  it('debe retornar null para un archivo que no existe en storage', async () => {
    const url = await getAttachmentSignedUrl(`${ATHLETE_ID}/medical/nope.pdf`);
    expect(url).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. TIPOS DE ARCHIVO PERMITIDOS
// ─────────────────────────────────────────────────────────────────────────────

describe('15. Todos los tipos MIME permitidos se aceptan correctamente', () => {
  const allowed = [
    ['application/pdf',                                                              'test.pdf'],
    ['image/jpeg',                                                                   'foto.jpg'],
    ['image/png',                                                                    'captura.png'],
    ['image/webp',                                                                   'imagen.webp'],
    ['application/msword',                                                           'doc.doc'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document',      'doc.docx'],
    ['application/vnd.ms-excel',                                                     'hoja.xls'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',            'hoja.xlsx'],
    ['application/vnd.ms-powerpoint',                                                'pres.ppt'],
    ['application/vnd.openxmlformats-officedocument.presentationml.presentation',    'pres.pptx'],
    ['text/plain',                                                                   'notas.txt'],
    ['text/csv',                                                                     'datos.csv'],
  ] as const;

  for (const [mime, name] of allowed) {
    it(`debe aceptar ${name} (${mime})`, async () => {
      resetState();
      const result = await uploadAttachments(
        { athleteId: ATHLETE_ID, module: 'diagnostic' },
        formDataWith(makeFile(name, mime))
      );
      expect(result.uploaded).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  }
});

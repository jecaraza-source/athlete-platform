/**
 * tests/rbac/auditor-access.test.ts
 *
 * Suite de verificación del perfil Auditor (migración 061_auditor_role.sql).
 *
 * Cubre:
 *  1. hasRole / hasPermission  — permisos concedidos y denegados
 *  2. requireAdminAccess       — redirige al dashboard (auditor ≠ admin)
 *  3. assertAdminAccess        — retorna { error } para auditor
 *  4. requireRoutePermission   — 403 en operaciones de escritura, null en lectura
 *  5. getDiagnosticAccess      — secciones vacías, sin acceso integrado
 *  6. confirmShow (Server Action) — assertMedicalAccess bloquea al auditor
 *  7. Confirmación de que isAdmin=false e isAuditor=true para el rol 'auditor'
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SCENARIOS, setupAuthMock, setupSupabaseAdminMock } from '../helpers';

// ---------------------------------------------------------------------------
// Module mocks  (hoisted by Vitest)
// ---------------------------------------------------------------------------

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn };
});

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn().mockResolvedValue('en'),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { redirectUrl: url });
  }),
}));

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: vi.fn() },
}));

// next/cache is needed by actions.ts
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// OneSignal used in some server actions
vi.mock('@/lib/notifications/providers/onesignal-adapter', () => ({
  oneSignalAdapter: { send: vi.fn().mockResolvedValue(undefined) },
}));

// ---------------------------------------------------------------------------
// Import modules under test AFTER mocks are registered
// ---------------------------------------------------------------------------

import {
  hasPermission,
  hasRole,
  requireAdminAccess,
  assertAdminAccess,
  requireRoutePermission,
  getDiagnosticAccess,
} from '@/lib/rbac/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { confirmShow } from '@/app/[locale]/(app)/medical/appointments/[eventId]/actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function captureRedirect(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    throw new Error('Expected a redirect but the function returned normally.');
  } catch (err: unknown) {
    const e = err as { message?: string; redirectUrl?: string };
    if (e.message === 'NEXT_REDIRECT' && e.redirectUrl) return e.redirectUrl;
    throw err;
  }
}

function setupAuditor() {
  setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.auditor);
  setupSupabaseAdminMock(
    vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> },
    SCENARIOS.auditor,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// 1. hasRole
// ===========================================================================

describe('1. hasRole — auditor', () => {
  it('hasRole("auditor") → true', async () => {
    setupAuditor();
    expect(await hasRole('auditor')).toBe(true);
  });

  it('hasRole("admin") → false', async () => {
    setupAuditor();
    expect(await hasRole('admin')).toBe(false);
  });

  it('hasRole("super_admin") → false', async () => {
    setupAuditor();
    expect(await hasRole('super_admin')).toBe(false);
  });

  it('hasRole("medic", "physio", "nutritionist", "psychologist") → false', async () => {
    setupAuditor();
    expect(await hasRole('medic', 'physio', 'nutritionist', 'psychologist')).toBe(false);
  });

  it('hasRole("coach") → false', async () => {
    setupAuditor();
    expect(await hasRole('coach')).toBe(false);
  });

  it('hasRole("program_director", "event_coordinator") → false', async () => {
    setupAuditor();
    expect(await hasRole('program_director', 'event_coordinator')).toBe(false);
  });
});

// ===========================================================================
// 2. hasPermission
// ===========================================================================

describe('2. hasPermission — auditor (concedidos: view_athletes, view_calendar)', () => {
  it('hasPermission("view_athletes") → true  [concedido]', async () => {
    setupAuditor();
    expect(await hasPermission('view_athletes')).toBe(true);
  });

  it('hasPermission("view_calendar") → true  [concedido]', async () => {
    setupAuditor();
    expect(await hasPermission('view_calendar')).toBe(true);
  });

  it('hasPermission("edit_athletes") → false  [denegado]', async () => {
    setupAuditor();
    expect(await hasPermission('edit_athletes')).toBe(false);
  });

  it('hasPermission("create_athletes") → false  [denegado]', async () => {
    setupAuditor();
    expect(await hasPermission('create_athletes')).toBe(false);
  });

  it('hasPermission("delete_athletes") → false  [denegado]', async () => {
    setupAuditor();
    expect(await hasPermission('delete_athletes')).toBe(false);
  });

  it('hasPermission("manage_calendar") → false  [denegado]', async () => {
    setupAuditor();
    expect(await hasPermission('manage_calendar')).toBe(false);
  });

  it('hasPermission("manage_users") → false  [denegado]', async () => {
    setupAuditor();
    expect(await hasPermission('manage_users')).toBe(false);
  });

  it('hasPermission("manage_roles") → false  [denegado]', async () => {
    setupAuditor();
    expect(await hasPermission('manage_roles')).toBe(false);
  });

  it('hasPermission("manage_permissions") → false  [denegado]', async () => {
    setupAuditor();
    expect(await hasPermission('manage_permissions')).toBe(false);
  });

  it('hasPermission("view_finances") → false  [denegado]', async () => {
    setupAuditor();
    expect(await hasPermission('view_finances')).toBe(false);
  });

  it('hasPermission("manage_finances") → false  [denegado]', async () => {
    setupAuditor();
    expect(await hasPermission('manage_finances')).toBe(false);
  });
});

// ===========================================================================
// 3. requireAdminAccess — auditor no es admin
// ===========================================================================

describe('3. requireAdminAccess — auditor redirigido al dashboard', () => {
  it('redirige a /en/dashboard (auditor ≠ admin)', async () => {
    setupAuditor();
    const url = await captureRedirect(() => requireAdminAccess());
    expect(url).toBe('/en/dashboard');
  });
});

// ===========================================================================
// 4. assertAdminAccess — retorna { error } para auditor
// ===========================================================================

describe('4. assertAdminAccess — retorna error para auditor', () => {
  it('retorna { error: "Admin access required." }', async () => {
    setupAuditor();
    const result = await assertAdminAccess();
    expect(result).not.toBeNull();
    expect(result?.error).toMatch(/admin/i);
  });
});

// ===========================================================================
// 5. requireRoutePermission — operaciones de escritura bloqueadas
// ===========================================================================

describe('5. requireRoutePermission — auditor', () => {
  it('view_athletes → null (permitido — tiene el permiso)', async () => {
    setupAuditor();
    expect(await requireRoutePermission('view_athletes')).toBeNull();
  });

  it('view_calendar → null (permitido — tiene el permiso)', async () => {
    setupAuditor();
    expect(await requireRoutePermission('view_calendar')).toBeNull();
  });

  it('edit_athletes → 403 (denegado)', async () => {
    setupAuditor();
    const res = await requireRoutePermission('edit_athletes');
    expect(res?.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it('create_athletes → 403 (denegado)', async () => {
    setupAuditor();
    const res = await requireRoutePermission('create_athletes');
    expect(res?.status).toBe(403);
  });

  it('delete_athletes → 403 (denegado)', async () => {
    setupAuditor();
    const res = await requireRoutePermission('delete_athletes');
    expect(res?.status).toBe(403);
  });

  it('manage_users → 403 (denegado)', async () => {
    setupAuditor();
    const res = await requireRoutePermission('manage_users');
    expect(res?.status).toBe(403);
  });

  it('manage_roles → 403 (denegado)', async () => {
    setupAuditor();
    const res = await requireRoutePermission('manage_roles');
    expect(res?.status).toBe(403);
  });

  it('view_finances → 403 (denegado)', async () => {
    setupAuditor();
    const res = await requireRoutePermission('view_finances');
    expect(res?.status).toBe(403);
  });
});

// ===========================================================================
// 6. getDiagnosticAccess — sin acceso a secciones clínicas
// ===========================================================================

describe('6. getDiagnosticAccess — auditor sin acceso clínico', () => {
  it('allowedSections debe estar vacío []', async () => {
    setupAuditor();
    const { allowedSections } = await getDiagnosticAccess();
    expect(allowedSections).toHaveLength(0);
  });

  it('canViewIntegratedResult debe ser false', async () => {
    setupAuditor();
    const { canViewIntegratedResult } = await getDiagnosticAccess();
    expect(canViewIntegratedResult).toBe(false);
  });
});

// ===========================================================================
// 7. confirmShow — assertMedicalAccess bloquea al auditor (HAL-03)
// ===========================================================================

describe('7. confirmShow — Server Action de escritura bloqueada para auditor', () => {
  it('retorna { error } cuando el usuario es auditor (assertMedicalAccess falla)', async () => {
    setupAuditor();
    const result = await confirmShow('event-001', 'Notas de prueba');
    // assertMedicalAccess() checks MEDICAL_ROLE_CODES which excludes 'auditor'
    expect(result).toMatchObject({ error: expect.any(String) });
    expect((result as { error: string }).error).toMatch(/acceso/i);
  });

  it('un admin (program_director) sí puede confirmar asistencia (control positivo)', async () => {
    // MEDICAL_ROLE_CODES incluye 'program_director' → assertMedicalAccess() pasa.
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.admin);

    // Stub por tabla: RBAC tables + events + event_participants
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === 'event_participants') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: SCENARIOS.admin!.profile }),
            }),
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: SCENARIOS.admin!.userRoleRows }),
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === 'role_permissions') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: SCENARIOS.admin!.rolePermRows }),
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      } as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    const result = await confirmShow('event-001', '');
    expect((result as { error: string | null }).error).toBeNull();
  });
});

// ===========================================================================
// 8. Comparación auditor vs admin — roles distintos
// ===========================================================================

describe('8. Auditor vs Admin — diferencias clave', () => {
  it('admin tiene manage_users; auditor no', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.admin);
    setupSupabaseAdminMock(
      vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> },
      SCENARIOS.admin,
    );
    expect(await hasPermission('manage_users')).toBe(true);

    vi.clearAllMocks();
    setupAuditor();
    expect(await hasPermission('manage_users')).toBe(false);
  });

  it('admin tiene edit_athletes; auditor no', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.admin);
    setupSupabaseAdminMock(
      vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> },
      SCENARIOS.admin,
    );
    expect(await hasPermission('edit_athletes')).toBe(true);

    vi.clearAllMocks();
    setupAuditor();
    expect(await hasPermission('edit_athletes')).toBe(false);
  });

  it('admin accede al panel admin; auditor es redirigido', async () => {
    // Admin: no redirige
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.admin);
    setupSupabaseAdminMock(
      vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> },
      SCENARIOS.admin,
    );
    const adminUser = await requireAdminAccess();
    expect(adminUser.roles.some((r) => r.code === 'program_director')).toBe(true);

    vi.clearAllMocks();

    // Auditor: redirige a dashboard
    setupAuditor();
    const url = await captureRedirect(() => requireAdminAccess());
    expect(url).toBe('/en/dashboard');
  });
});

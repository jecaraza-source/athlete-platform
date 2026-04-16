/**
 * Unit tests for lib/rbac/server.ts
 *
 * Strategy
 * --------
 * • vi.mock hoisting ensures the mocks below are applied before any module is
 *   imported, so `cache` from React is already a no-op when lib/rbac/server.ts
 *   evaluates at the top of each test file run.
 * • `redirect` throws a recognisable error so code execution stops after the
 *   call, mirroring Next.js's real behaviour.
 * • Each test calls `vi.clearAllMocks()` + `setupSupabaseAdminMock()` so
 *   scenarios are fully isolated.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SCENARIOS, setupAuthMock, setupSupabaseAdminMock } from '../helpers';

// ---------------------------------------------------------------------------
// Module mocks  (vi.mock calls are hoisted to the top of the file by Vitest)
// ---------------------------------------------------------------------------

// 1. Make React's cache() a no-op so getCurrentUser / getAuthUser are plain
//    async functions in tests — no per-request memoisation to work around.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
  };
});

// 2. Mock next-intl/server so getLocale() is available in the Node test
//    environment. Returns 'en' — the same default as the app's i18n config.
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn().mockResolvedValue('en'),
}));

// 3. Make redirect() throw a detectable error so control flow stops exactly
//    as it does in production (Next.js redirect() throws internally).
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { redirectUrl: url });
  }),
}));

// 3. Supabase SSR client — controls which auth user is "logged in"
vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

// 4. Supabase admin client — controls the DB rows returned for profile/roles/permissions
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import the functions under test AFTER the mocks are registered
// ---------------------------------------------------------------------------

import {
  hasPermission,
  hasRole,
  requireAuthenticated,
  requirePermission,
  requireAdminAccess,
  assertPermission,
  assertAdminAccess,
  requireRouteAuth,
  requireRoutePermission,
} from '@/lib/rbac/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// Helpers to call redirect-throwing guards without unhandled rejections
// ---------------------------------------------------------------------------

/** Returns the redirectUrl from a NEXT_REDIRECT error, or throws for any other error. */
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

// ---------------------------------------------------------------------------
// Per-test setup: reset all mock state
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// hasPermission
// ===========================================================================

describe('hasPermission', () => {
  it('returns false when the user is anonymous', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.anonymous);
    expect(await hasPermission('view_athletes')).toBe(false);
  });

  it('returns false when the user does not have the requested permission', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.athlete);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.athlete);
    // athlete only has view_calendar
    expect(await hasPermission('view_athletes')).toBe(false);
  });

  it('returns true when the user has the requested permission', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.coach);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.coach);
    expect(await hasPermission('view_athletes')).toBe(true);
    expect(await hasPermission('edit_athletes')).toBe(true);
    expect(await hasPermission('manage_calendar')).toBe(true);
  });

  it('returns true for super_admin regardless of which permission is asked', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.super_admin);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.super_admin);
    // super_admin bypasses the permission check entirely
    expect(await hasPermission('manage_permissions')).toBe(true);
    expect(await hasPermission('delete_athletes')).toBe(true);
    expect(await hasPermission('some_nonexistent_permission')).toBe(true);
  });
});

// ===========================================================================
// hasRole
// ===========================================================================

describe('hasRole', () => {
  it('returns false when the user is anonymous', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.anonymous);
    expect(await hasRole('athlete')).toBe(false);
  });

  it('returns false when the user does not hold the requested role', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.athlete);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.athlete);
    expect(await hasRole('admin')).toBe(false);
    expect(await hasRole('coach')).toBe(false);
  });

  it('returns true when the user holds the requested role', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.coach);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.coach);
    expect(await hasRole('coach')).toBe(true);
  });

  it('returns true when any of several requested roles matches', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.admin);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.admin);
    // admin scenario uses 'program_director' code in the existing DB schema
    expect(await hasRole('super_admin', 'program_director')).toBe(true);
  });
});

// ===========================================================================
// requireAuthenticated
// ===========================================================================

describe('requireAuthenticated', () => {
  it('redirects to /login when the user is anonymous', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.anonymous);
    const url = await captureRedirect(() => requireAuthenticated());
    expect(url).toBe('/en/login');
  });

  it('returns the CurrentUser when a session exists', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.coach);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.coach);
    const user = await requireAuthenticated();
    expect(user.authUserId).toBe(SCENARIOS.coach!.authUserId);
    expect(user.profile?.id).toBe(SCENARIOS.coach!.profile.id);
  });
});

// ===========================================================================
// requirePermission  (page guard — throws redirect)
// ===========================================================================

describe('requirePermission', () => {
  it('redirects to /login when the user is anonymous', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.anonymous);
    const url = await captureRedirect(() => requirePermission('view_athletes'));
    expect(url).toBe('/en/login');
  });

  it('redirects to /dashboard when the user lacks the permission', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.athlete);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.athlete);
    // athlete only has view_calendar; view_athletes is denied
    const url = await captureRedirect(() => requirePermission('view_athletes'));
    expect(url).toBe('/en/dashboard');
  });

  it('does not redirect when the user has the required permission', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.coach);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.coach);
    // coach has view_athletes — should return without throwing
    await expect(requirePermission('view_athletes')).resolves.toBeUndefined();
  });

  it('does not redirect for super_admin even for a permission they are not explicitly assigned', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.super_admin);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.super_admin);
    await expect(requirePermission('manage_permissions')).resolves.toBeUndefined();
  });

  it('enforces view_calendar for athlete — grants access', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.athlete);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.athlete);
    await expect(requirePermission('view_calendar')).resolves.toBeUndefined();
  });

  it('enforces manage_calendar — denied for athlete, granted for coach', async () => {
    // Athlete denied
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.athlete);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.athlete);
    const url = await captureRedirect(() => requirePermission('manage_calendar'));
    expect(url).toBe('/en/dashboard');

    vi.clearAllMocks();

    // Coach granted
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.coach);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.coach);
    await expect(requirePermission('manage_calendar')).resolves.toBeUndefined();
  });
});

// ===========================================================================
// requireAdminAccess  (page guard — throws redirect)
// ===========================================================================

describe('requireAdminAccess', () => {
  it('redirects to /login when the user is anonymous', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.anonymous);
    const url = await captureRedirect(() => requireAdminAccess());
    expect(url).toBe('/en/login');
  });

  it('redirects to /dashboard for a non-admin user (athlete)', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.athlete);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.athlete);
    const url = await captureRedirect(() => requireAdminAccess());
    expect(url).toBe('/en/dashboard');
  });

  it('redirects to /dashboard for a non-admin user (coach)', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.coach);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.coach);
    const url = await captureRedirect(() => requireAdminAccess());
    expect(url).toBe('/en/dashboard');
  });

  it('returns the CurrentUser for an admin', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.admin);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.admin);
    const user = await requireAdminAccess();
    expect(user.authUserId).toBe(SCENARIOS.admin!.authUserId);
    // admin scenario maps to 'program_director' code in the existing DB schema
    expect(user.roles.some((r) => r.code === 'program_director')).toBe(true);
  });

  it('returns the CurrentUser for a super_admin', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.super_admin);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.super_admin);
    const user = await requireAdminAccess();
    expect(user.roles.some((r) => r.code === 'super_admin')).toBe(true);
  });
});

// ===========================================================================
// assertPermission  (server action guard — returns { error } or null)
// ===========================================================================

describe('assertPermission', () => {
  it('returns an error object when the user is anonymous', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.anonymous);
    const result = await assertPermission('view_athletes');
    expect(result).not.toBeNull();
    expect(result?.error).toMatch(/signed in/i);
  });

  it('returns an error object when the user lacks the permission', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.athlete);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.athlete);
    const result = await assertPermission('edit_athletes');
    expect(result).not.toBeNull();
    expect(result?.error).toMatch(/permission/i);
  });

  it('returns null when the user has the permission', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.coach);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.coach);
    expect(await assertPermission('edit_athletes')).toBeNull();
    expect(await assertPermission('view_athletes')).toBeNull();
  });

  it('returns null for super_admin on any permission', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.super_admin);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.super_admin);
    expect(await assertPermission('manage_permissions')).toBeNull();
    expect(await assertPermission('delete_athletes')).toBeNull();
  });

  it('correctly guards edit_athletes: athlete denied, admin allowed', async () => {
    // Athlete
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.athlete);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.athlete);
    expect(await assertPermission('edit_athletes')).not.toBeNull();

    vi.clearAllMocks();

    // Admin
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.admin);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.admin);
    expect(await assertPermission('edit_athletes')).toBeNull();
  });

  it('correctly guards manage_calendar: athlete denied, coach allowed', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.athlete);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.athlete);
    expect(await assertPermission('manage_calendar')).not.toBeNull();

    vi.clearAllMocks();

    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.coach);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.coach);
    expect(await assertPermission('manage_calendar')).toBeNull();
  });
});

// ===========================================================================
// assertAdminAccess  (server action guard — returns { error } or null)
// ===========================================================================

describe('assertAdminAccess', () => {
  it('returns an error for anonymous callers', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.anonymous);
    const result = await assertAdminAccess();
    expect(result?.error).toMatch(/signed in/i);
  });

  it('returns an error for non-admin roles (athlete, coach)', async () => {
    for (const scenario of [SCENARIOS.athlete, SCENARIOS.coach]) {
      vi.clearAllMocks();
      setupAuthMock(vi.mocked(createSupabaseServerClient), scenario);
      setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, scenario);
      const result = await assertAdminAccess();
      expect(result?.error).toMatch(/admin/i);
    }
  });

  it('returns null for admin', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.admin);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.admin);
    expect(await assertAdminAccess()).toBeNull();
  });

  it('returns null for super_admin', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.super_admin);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.super_admin);
    expect(await assertAdminAccess()).toBeNull();
  });
});

// ===========================================================================
// requireRouteAuth  (API route guard — returns Response | null)
// ===========================================================================

describe('requireRouteAuth', () => {
  it('returns a 401 JSON response when the user is anonymous', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.anonymous);
    const response = await requireRouteAuth();
    expect(response).not.toBeNull();
    expect(response!.status).toBe(401);
    const body = await response!.json();
    expect(body.error).toMatch(/unauthenticated/i);
  });

  it('returns null when a valid session exists', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.coach);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.coach);
    expect(await requireRouteAuth()).toBeNull();
  });
});

// ===========================================================================
// requireRoutePermission  (API route guard — returns Response | null)
// ===========================================================================

describe('requireRoutePermission', () => {
  it('returns 401 when the user is anonymous', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.anonymous);
    const response = await requireRoutePermission('view_athletes');
    expect(response!.status).toBe(401);
  });

  it('returns 403 when the authenticated user lacks the permission', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.athlete);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.athlete);
    // athlete only has view_calendar
    const response = await requireRoutePermission('view_athletes');
    expect(response!.status).toBe(403);
    const body = await response!.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it('returns null when the user has the required permission', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.coach);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.coach);
    expect(await requireRoutePermission('view_athletes')).toBeNull();
    expect(await requireRoutePermission('edit_athletes')).toBeNull();
  });

  it('returns null for super_admin regardless of which permission is requested', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.super_admin);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.super_admin);
    expect(await requireRoutePermission('manage_permissions')).toBeNull();
    expect(await requireRoutePermission('delete_athletes')).toBeNull();
  });

  it('enforces manage_roles: coach denied (403), admin allowed (null)', async () => {
    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.coach);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.coach);
    const denied = await requireRoutePermission('manage_roles');
    expect(denied!.status).toBe(403);

    vi.clearAllMocks();

    setupAuthMock(vi.mocked(createSupabaseServerClient), SCENARIOS.admin);
    setupSupabaseAdminMock(vi.mocked(supabaseAdmin) as { from: ReturnType<typeof vi.fn> }, SCENARIOS.admin);
    expect(await requireRoutePermission('manage_roles')).toBeNull();
  });
});

/**
 * RBAC server utilities
 *
 * All functions are server-only. Import in:
 *  - Server Components / layouts
 *  - Server Actions  ('use server')
 *  - Route Handlers  (app/api/...)
 *
 * Never import this file in client components.
 *
 * Layered API
 * ───────────
 *  Page / layout guards  (throw redirects)
 *    requireAuthenticated()   – any authenticated page
 *    requirePermission(p)     – page needs a specific permission
 *    requireAdminAccess()     – admin-only page
 *
 *  Server Action guards  (return { error } instead of redirecting)
 *    assertPermission(p)      – returns { error } or null
 *    assertAdminAccess()      – returns { error } or null
 *
 *  API Route Handler guards  (return a Response or null)
 *    requireRouteAuth()       – returns 401 Response or null
 *    requireRoutePermission(p)– returns 401/403 Response or null
 */

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { CurrentUser, Permission, ProfileSummary, Role } from './types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** JSON Response factory for route handler guards. */
function jsonResponse(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * True if the user holds the super_admin role (bypasses all permission checks).
 * Compares against role.code, which is the snake_case slug in the DB.
 */
function isSuperAdmin(user: CurrentUser): boolean {
  return user.roles.some((r) => r.code === 'super_admin');
}

// ---------------------------------------------------------------------------
// Session — memoized per React render/request via React cache()
// ---------------------------------------------------------------------------

/**
 * Returns the raw Supabase auth user for the current request, or null.
 * Memoized: only one network call per request, no matter how many times
 * this is called within the same Server Component tree or Server Action.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
});

/**
 * Resolves the full CurrentUser (auth identity + profile + roles + permissions).
 * Uses the service-role client so RLS is bypassed.
 * Returns null when the request carries no valid session.
 *
 * Memoized: DB is queried at most once per request regardless of how many
 * callers invoke this function.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const authUser = await getAuthUser();
  if (!authUser) return null;

  // 1. Resolve the profile row
  const { data: profileRow } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  const profile: ProfileSummary | null = profileRow ?? null;

  if (!profile) {
    return { authUserId: authUser.id, profile: null, roles: [], permissions: new Set() };
  }

  // 2. Resolve roles via the existing user_roles → roles join.
  // NOTE: roles.code is the snake_case slug (e.g. 'super_admin');
  //       roles.name is the human-readable label (e.g. 'Super Admin').
  const { data: userRoleRows } = await supabaseAdmin
    .from('user_roles')
    .select('role_id, roles(id, code, name, description, is_system, created_at)')
    .eq('profile_id', profile.id);

  const roles: Role[] = (userRoleRows ?? [])
    .map((r: { roles: Role | Role[] | null }) =>
      Array.isArray(r.roles) ? r.roles[0] : r.roles
    )
    .filter((r): r is Role => r != null);

  // 3. Resolve permissions for those roles (requires migration 002 to have run).
  let permissions = new Set<string>();
  if (roles.length > 0) {
    const { data: rpRows } = await supabaseAdmin
      .from('role_permissions')
      .select('permission_id, permissions(name)')
      .in('role_id', roles.map((r) => r.id));

    permissions = new Set(
      (rpRows ?? [])
        .map((rp: { permissions: { name: string } | { name: string }[] | null }) => {
          const p = Array.isArray(rp.permissions) ? rp.permissions[0] : rp.permissions;
          return p?.name;
        })
        .filter((n): n is string => n != null)
    );
  }

  return { authUserId: authUser.id, profile, roles, permissions };
});

// ---------------------------------------------------------------------------
// Primitive checks (non-throwing)
// ---------------------------------------------------------------------------

/** Returns true if the current user has the given permission. */
export async function hasPermission(permission: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return user.permissions.has(permission);
}

/** Returns true if the current user holds at least one of the given roles (matched by code). */
export async function hasRole(...roleCodes: string[]): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return user.roles.some((r) => roleCodes.includes(r.code));
}

// ---------------------------------------------------------------------------
// Page / Layout guards  (throw Next.js redirects on failure)
// ---------------------------------------------------------------------------

/**
 * Ensures the current request has a valid auth session.
 * Redirects to /login if not authenticated.
 * Use at the top of any Server Component that requires auth but not a
 * specific role.
 */
export async function requireAuthenticated(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Ensures the current user has the given permission.
 * Redirects to /login if unauthenticated, or to /dashboard if the
 * permission is missing.
 * Use at the top of Server Components and layouts.
 */
export async function requirePermission(permission: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (isSuperAdmin(user)) return;
  if (!user.permissions.has(permission)) redirect('/dashboard');
}

/**
 * Ensures the current user has an admin-level role (super_admin or admin).
 * Redirects to /login if unauthenticated, or to /dashboard if not an admin.
 * Returns the resolved CurrentUser so callers don't need to fetch it again.
 * Use at the top of every admin page.
 */
export async function requireAdminAccess(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // 'program_director' is the admin-equivalent role in the existing DB schema
  const isAdmin = user.roles.some((r) =>
    ['super_admin', 'admin', 'program_director'].includes(r.code)
  );
  if (!isAdmin) redirect('/dashboard');
  return user;
}

// ---------------------------------------------------------------------------
// Server Action guards  (return errors instead of redirecting)
// ---------------------------------------------------------------------------

/**
 * Authorization check for use inside Server Actions.
 * Returns null when the caller is authorized.
 * Returns { error: string } when they are not — the action should return
 * this object immediately so the UI can display the message.
 *
 * @example
 * export async function deleteWidget(id: string) {
 *   const denied = await assertPermission('manage_widgets');
 *   if (denied) return denied;
 *   // ... mutate DB
 *   return { error: null };
 * }
 */
export async function assertPermission(
  permission: string
): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You must be signed in to perform this action.' };
  if (isSuperAdmin(user)) return null;
  if (!user.permissions.has(permission)) {
    return { error: 'You do not have permission to perform this action.' };
  }
  return null;
}

/**
 * Admin-level authorization check for Server Actions.
 * Returns null when the caller has an admin role, or { error } otherwise.
 */
export async function assertAdminAccess(): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You must be signed in to perform this action.' };
  const isAdmin = user.roles.some((r) =>
    ['super_admin', 'admin', 'program_director'].includes(r.code)
  );
  if (!isAdmin) return { error: 'Admin access required.' };
  return null;
}

// ---------------------------------------------------------------------------
// API Route Handler guards  (return a Response or null)
// ---------------------------------------------------------------------------

/**
 * Authentication guard for API Route Handlers.
 * Returns null when the request carries a valid session.
 * Returns a 401 JSON Response otherwise.
 *
 * @example
 * export async function GET() {
 *   const denied = await requireRouteAuth();
 *   if (denied) return denied;
 *   return Response.json({ ok: true });
 * }
 */
export async function requireRouteAuth(): Promise<Response | null> {
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: 'Unauthenticated' }, 401);
  return null;
}

/**
 * Permission guard for API Route Handlers.
 * Returns null when the caller has the required permission.
 * Returns a 401 JSON Response for unauthenticated callers,
 * or a 403 JSON Response for callers lacking the permission.
 *
 * @example
 * export async function DELETE(req: Request) {
 *   const denied = await requireRoutePermission('delete_athletes');
 *   if (denied) return denied;
 *   // ... handler logic
 * }
 */
export async function requireRoutePermission(
  permission: string
): Promise<Response | null> {
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: 'Unauthenticated' }, 401);
  if (isSuperAdmin(user)) return null;
  if (!user.permissions.has(permission)) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Data fetchers used by the Access Control admin pages
// ---------------------------------------------------------------------------

export async function getAllRoles(): Promise<Role[]> {
  const { data } = await supabaseAdmin
    .from('roles')
    .select('*')
    .order('name');
  return data ?? [];
}

export async function getAllPermissions(): Promise<Permission[]> {
  const { data } = await supabaseAdmin
    .from('permissions')
    .select('*')
    .order('name');
  return data ?? [];
}

export async function getRoleWithPermissions(roleId: string) {
  const { data: role } = await supabaseAdmin
    .from('roles')
    .select('*')
    .eq('id', roleId)
    .maybeSingle();

  if (!role) return null;

  const { data: rpRows } = await supabaseAdmin
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', roleId);

  const permissionIds = (rpRows ?? []).map((r: { permission_id: string }) => r.permission_id);
  let permissions: Permission[] = [];

  if (permissionIds.length > 0) {
    const { data: perms } = await supabaseAdmin
      .from('permissions')
      .select('*')
      .in('id', permissionIds);
    permissions = perms ?? [];
  }

  return { ...role, permissions };
}

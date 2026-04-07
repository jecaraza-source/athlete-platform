/**
 * Shared test helpers for RBAC and middleware tests.
 *
 * Provides:
 *  - Role/permission ID constants (kept consistent across fixtures)
 *  - User scenario factories (anon, athlete, coach, admin, super_admin)
 *  - buildSupabaseAdminMock() — configures the supabaseAdmin chain mock for a scenario
 *  - setupAuthMock() — configures the SSR client mock for a scenario
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Stable IDs used across fixtures
// ---------------------------------------------------------------------------

export const IDS = {
  // Auth users
  authAthlete:    'auth-athlete-001',
  authCoach:      'auth-coach-001',
  authAdmin:      'auth-admin-001',
  authSuperAdmin: 'auth-super-001',

  // Profiles
  profileAthlete:    'profile-athlete-001',
  profileCoach:      'profile-coach-001',
  profileAdmin:      'profile-admin-001',
  profileSuperAdmin: 'profile-super-001',

  // Roles
  roleAthlete:    'role-athlete',
  roleCoach:      'role-coach',
  roleAdmin:      'role-admin',
  roleSuperAdmin: 'role-super-admin',

  // Permissions
  permViewAthletes:      'perm-view-athletes',
  permCreateAthletes:    'perm-create-athletes',
  permEditAthletes:      'perm-edit-athletes',
  permDeleteAthletes:    'perm-delete-athletes',
  permViewCalendar:      'perm-view-calendar',
  permManageCalendar:    'perm-manage-calendar',
  permManageUsers:       'perm-manage-users',
  permManageRoles:       'perm-manage-roles',
  permManagePermissions: 'perm-manage-permissions',
} as const;

// ---------------------------------------------------------------------------
// Row shape types (mirrors what getCurrentUser reads from the DB)
// ---------------------------------------------------------------------------

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
};

type UserRoleRow = {
  role_id: string;
  roles: RoleRow;
};

type RolePermRow = {
  permission_id: string;
  permissions: { name: string };
};

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string | null;
};

// ---------------------------------------------------------------------------
// Role + permission set definitions
// ---------------------------------------------------------------------------

export const ROLES: Record<string, RoleRow> = {
  athlete: {
    id: IDS.roleAthlete, name: 'athlete',
    description: null, is_system: true, created_at: '2024-01-01T00:00:00Z',
  },
  coach: {
    id: IDS.roleCoach, name: 'coach',
    description: null, is_system: true, created_at: '2024-01-01T00:00:00Z',
  },
  admin: {
    id: IDS.roleAdmin, name: 'admin',
    description: null, is_system: true, created_at: '2024-01-01T00:00:00Z',
  },
  super_admin: {
    id: IDS.roleSuperAdmin, name: 'super_admin',
    description: null, is_system: true, created_at: '2024-01-01T00:00:00Z',
  },
};

// Permissions granted to each role — mirrors the default seed data in 001_rbac.sql
const ROLE_PERMISSIONS: Record<string, Array<{ permId: string; name: string }>> = {
  athlete: [
    { permId: IDS.permViewCalendar, name: 'view_calendar' },
  ],
  coach: [
    { permId: IDS.permViewAthletes,   name: 'view_athletes' },
    { permId: IDS.permCreateAthletes, name: 'create_athletes' },
    { permId: IDS.permEditAthletes,   name: 'edit_athletes' },
    { permId: IDS.permViewCalendar,   name: 'view_calendar' },
    { permId: IDS.permManageCalendar, name: 'manage_calendar' },
  ],
  admin: [
    { permId: IDS.permViewAthletes,   name: 'view_athletes' },
    { permId: IDS.permCreateAthletes, name: 'create_athletes' },
    { permId: IDS.permEditAthletes,   name: 'edit_athletes' },
    { permId: IDS.permDeleteAthletes, name: 'delete_athletes' },
    { permId: IDS.permViewCalendar,   name: 'view_calendar' },
    { permId: IDS.permManageCalendar, name: 'manage_calendar' },
    { permId: IDS.permManageUsers,    name: 'manage_users' },
    { permId: IDS.permManageRoles,    name: 'manage_roles' },
  ],
  super_admin: [
    { permId: IDS.permViewAthletes,      name: 'view_athletes' },
    { permId: IDS.permCreateAthletes,    name: 'create_athletes' },
    { permId: IDS.permEditAthletes,      name: 'edit_athletes' },
    { permId: IDS.permDeleteAthletes,    name: 'delete_athletes' },
    { permId: IDS.permViewCalendar,      name: 'view_calendar' },
    { permId: IDS.permManageCalendar,    name: 'manage_calendar' },
    { permId: IDS.permManageUsers,       name: 'manage_users' },
    { permId: IDS.permManageRoles,       name: 'manage_roles' },
    { permId: IDS.permManagePermissions, name: 'manage_permissions' },
  ],
};

// ---------------------------------------------------------------------------
// Scenario payloads
// ---------------------------------------------------------------------------

export type Scenario = {
  authUserId: string;
  profile: ProfileRow;
  userRoleRows: UserRoleRow[];
  rolePermRows: RolePermRow[];
};

function makeScenario(
  roleName: keyof typeof ROLES,
  authId: string,
  profileId: string,
): Scenario {
  const role = ROLES[roleName];
  return {
    authUserId: authId,
    profile: {
      id: profileId,
      first_name: 'Test',
      last_name: roleName.charAt(0).toUpperCase() + roleName.slice(1),
      email: `${roleName}@test.com`,
      role: roleName,
    },
    userRoleRows: [{ role_id: role.id, roles: role }],
    rolePermRows: (ROLE_PERMISSIONS[roleName] ?? []).map((p) => ({
      permission_id: p.permId,
      permissions: { name: p.name },
    })),
  };
}

export const SCENARIOS = {
  /** No Supabase session at all. */
  anonymous: null as Scenario | null,
  athlete:    makeScenario('athlete',    IDS.authAthlete,    IDS.profileAthlete),
  coach:      makeScenario('coach',      IDS.authCoach,      IDS.profileCoach),
  admin:      makeScenario('admin',      IDS.authAdmin,      IDS.profileAdmin),
  super_admin:makeScenario('super_admin',IDS.authSuperAdmin, IDS.profileSuperAdmin),
};

// ---------------------------------------------------------------------------
// Supabase admin mock builder
// ---------------------------------------------------------------------------

/**
 * Configures the vi.mocked(supabaseAdmin) to return appropriate data
 * for the given scenario's profile / roles / permissions.
 *
 * Call this inside a beforeEach or individual test after calling
 * vi.mock('@/lib/supabase-admin').
 */
export function setupSupabaseAdminMock(
  supabaseAdmin: { from: ReturnType<typeof vi.fn> },
  scenario: Scenario | null,
) {
  supabaseAdmin.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: scenario?.profile ?? null,
            }),
          }),
        }),
      };
    }

    if (table === 'user_roles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: scenario?.userRoleRows ?? [],
          }),
        }),
      };
    }

    if (table === 'role_permissions') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: scenario?.rolePermRows ?? [],
          }),
        }),
      };
    }

    // Fallback for any unexpected table
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [] }),
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// SSR client (auth) mock builder
// ---------------------------------------------------------------------------

/**
 * Configures the vi.mocked(createSupabaseServerClient) to return a mock
 * Supabase client whose auth.getUser() resolves with the given scenario's
 * auth user (or null for anonymous).
 */
export function setupAuthMock(
  createSupabaseServerClient: ReturnType<typeof vi.fn>,
  scenario: Scenario | null,
) {
  const user = scenario ? { id: scenario.authUserId } : null;
  createSupabaseServerClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  });
}

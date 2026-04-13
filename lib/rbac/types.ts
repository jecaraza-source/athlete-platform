// =============================================================================
// RBAC types — mirrors the database schema defined in 001_rbac.sql
// =============================================================================

export type Role = {
  /**
   * Integer PK from the existing `roles` table.
   * Use `code` (not `id`) for permission/role name comparisons in code.
   */
  id: number;
  /** Snake_case slug — the authoritative identifier used in permission checks. */
  code: string;
  /** Human-readable display label, e.g. "Super Admin". */
  name: string;
  description: string | null;
  /** Added by migration 002. Undefined until migration runs. */
  is_system?: boolean;
  /** Added by migration 002. Undefined until migration runs. */
  created_at?: string;
};

export type Permission = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type RolePermission = {
  /** INTEGER — references roles.id */
  role_id: number;
  permission_id: string;
};

export type UserRole = {
  id?: number;
  profile_id: string;
  /** INTEGER — references roles.id */
  role_id: number;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// Well-known role names — used for type-safe comparisons
// ---------------------------------------------------------------------------

export const SYSTEM_ROLES = ['super_admin', 'admin', 'coach', 'staff', 'athlete'] as const;
export type SystemRoleName = (typeof SYSTEM_ROLES)[number];

// ---------------------------------------------------------------------------
// Well-known permission names
// ---------------------------------------------------------------------------

export const PERMISSION_NAMES = [
  // Athletes
  'view_athletes',
  'create_athletes',
  'edit_athletes',
  'delete_athletes',
  // Calendar
  'view_calendar',
  'manage_calendar',
  // Administration
  'manage_users',
  'manage_roles',
  'manage_permissions',
  // Tickets
  'view_tickets',
  'create_tickets',
  'edit_tickets',
  'assign_tickets',
  'comment_tickets',
  'close_tickets',
] as const;
export type PermissionName = (typeof PERMISSION_NAMES)[number];

// ---------------------------------------------------------------------------
// Derived / joined shapes used in the UI and server utilities
// ---------------------------------------------------------------------------

/** A role enriched with its assigned permissions. */
export type RoleWithPermissions = Role & {
  permissions: Permission[];
};

/** A profile row used across the admin RBAC UI. */
export type ProfileSummary = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role: string | null;         // legacy column, kept for display
  /** Supabase Auth user UUID — present when fetched for admin pages. */
  auth_user_id?: string | null;
};

/** A profile enriched with its RBAC role assignments. */
export type ProfileWithRoles = ProfileSummary & {
  roles: Role[];
};

/** The currently authenticated user's identity + resolved permissions. */
export type CurrentUser = {
  authUserId: string;
  profile: ProfileSummary | null;
  roles: Role[];
  permissions: Set<string>;
};

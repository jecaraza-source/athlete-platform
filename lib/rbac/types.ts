// =============================================================================
// RBAC types — mirrors the database schema defined in 001_rbac.sql
// =============================================================================

export type Role = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
};

export type Permission = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type RolePermission = {
  role_id: string;
  permission_id: string;
};

export type UserRole = {
  profile_id: string;
  role_id: string;
  assigned_at: string;
  assigned_by_profile_id: string | null;
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
  'view_athletes',
  'create_athletes',
  'edit_athletes',
  'delete_athletes',
  'view_calendar',
  'manage_calendar',
  'manage_users',
  'manage_roles',
  'manage_permissions',
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
  role: string | null; // legacy column, kept for display
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

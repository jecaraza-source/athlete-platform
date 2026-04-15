// Types originally from @athlete-platform/shared (packages/shared/src/types.ts)
// Inlined here so the web app has no external file:// dependency in production.
//
// IMPORTANT: keep this file in sync with packages/shared/src/types.ts.

/**
 * Canonical system role codes as stored in the `roles` table.
 * These match the `code` column values seeded by migrations 001-002.
 *
 * Note: `requireAdminAccess` in lib/rbac/server.ts also accepts
 * 'program_director' for backwards compatibility with any existing DB rows
 * that have that legacy role assigned.
 */
export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'coach'
  | 'staff'
  | 'athlete';

export type AthleteStatus =
  | 'active'
  | 'inactive'
  | 'injured'
  | 'suspended';

export type DiagnosticStatus =
  | 'pendiente'
  | 'en_proceso'
  | 'completo'
  | 'requiere_atencion';

export type DisabilityStatus =
  | 'con_discapacidad'
  | 'sin_discapacidad';

export type AthleteWithDiagnostic = {
  id: string;
  first_name: string;
  last_name: string;
  status: AthleteStatus;
  discipline: string | null;
  disability_status: DisabilityStatus | null;
  diagnostic_status: DiagnosticStatus | null;
  diagnostic_pct: number | null;
};

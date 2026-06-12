/**
 * @athlete-platform/shared
 *
 * Canonical domain types shared across the monorepo:
 *   apps/web  → re-exported via apps/web/lib/types/shared.ts
 *   apps/mobile → apps/mobile/types/index.ts (manually synced)
 *
 * IMPORTANT: keep this file in sync with:
 *   - apps/web/lib/types/shared.ts        (re-exports)
 *   - apps/mobile/types/index.ts          (manual copy of core types)
 */

// =============================================================================
// RBAC
// =============================================================================

/**
 * Canonical system role codes as stored in the `roles` table.
 * Seeded by migrations 001-002. `program_director` is a legacy backwards-
 * compat alias that maps to admin access in code.
 */
export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'program_director'   // legacy alias for admin access
  | 'coach'
  | 'staff'
  | 'athlete';

/** Roles that grant staff-level access (can read all athletes, etc.) */
export const STAFF_ROLES: UserRole[] = [
  'super_admin', 'admin', 'program_director', 'coach', 'staff',
];

// =============================================================================
// Athlete
// =============================================================================

export type AthleteStatus =
  | 'active'
  | 'inactive'
  | 'injured'
  | 'suspended';

export const ATHLETE_STATUS_LABELS: Record<AthleteStatus, string> = {
  active:    'Activo',
  inactive:  'Inactivo',
  injured:   'Lesionado',
  suspended: 'Suspendido',
};

export type DisabilityStatus =
  | 'con_discapacidad'
  | 'sin_discapacidad';

// =============================================================================
// Diagnostic
// =============================================================================

export type DiagnosticStatus =
  | 'pendiente'
  | 'en_proceso'
  | 'completo'
  | 'requiere_atencion';

export const DIAGNOSTIC_STATUS_LABELS: Record<DiagnosticStatus, string> = {
  pendiente:         'Pendiente',
  en_proceso:        'En proceso',
  completo:          'Completo',
  requiere_atencion: 'Requiere atención',
};

export type DiagnosticSectionKey =
  | 'medico'
  | 'nutricion'
  | 'psicologia'
  | 'entrenador'
  | 'fisioterapia';

export const SECTION_LABELS: Record<DiagnosticSectionKey, string> = {
  medico:       'Médico',
  nutricion:    'Nutrición',
  psicologia:   'Psicología',
  entrenador:   'Entrenador',
  fisioterapia: 'Fisioterapia',
};

// =============================================================================
// Tickets
// =============================================================================

export type TicketStatus   = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open:        'Abierto',
  in_progress: 'En progreso',
  resolved:    'Resuelto',
  closed:      'Cerrado',
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low:    'Baja',
  medium: 'Media',
  high:   'Alta',
  urgent: 'Urgente',
};

// =============================================================================
// Push notifications
// =============================================================================

export type PushPlatform = 'ios' | 'android' | 'web';
export type JobStatus    = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'retrying';

// =============================================================================
// Composite (used by multiple modules)
// =============================================================================

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

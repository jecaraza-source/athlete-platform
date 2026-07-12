// =============================================================================
// types/index.ts — Domain types for the mobile app
//
// SOURCE OF TRUTH: packages/shared/src/types.ts (canonical shared types)
//                  apps/web/lib/rbac/types.ts    (web-specific extensions)
//
// SYNC POLICY
// -----------
// This file is a MANUALLY MAINTAINED copy. It is kept separate because
// apps/mobile has its own git repository and cannot easily consume the local
// packages/shared package without an npm workspace setup.
//
// When you add or change types in the files listed above, also update this
// file. Sections that must stay in sync:
//
//   1. PERMISSION_NAMES — must match apps/web/lib/rbac/types.ts exactly.
//   2. SYSTEM_ROLES     — must match packages/shared/src/types.ts exactly.
//   3. AthleteStatus / DiagnosticStatus / TicketStatus / TicketPriority
//      labels and value sets — must match packages/shared/src/types.ts.
//
// FUTURE: When mobile and web are moved into a true npm workspace monorepo,
// replace this file with:
//   export * from '@athlete-platform/shared';
// =============================================================================

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------

export type Role = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_system?: boolean;
  created_at?: string;
};

export type Permission = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type UserRole = {
  id?: number;
  profile_id: string;
  role_id: number;
  created_at?: string;
};

/**
 * Canonical system roles seeded by migrations 001-002.
 * Must match packages/shared/src/types.ts and apps/web/lib/rbac/types.ts.
 */
export const SYSTEM_ROLES = ['super_admin', 'admin', 'coach', 'staff', 'athlete'] as const;
export type SystemRoleName = (typeof SYSTEM_ROLES)[number];

export const PERMISSION_NAMES = [
  // Athletes
  'view_athletes', 'create_athletes', 'edit_athletes', 'delete_athletes',
  // Calendar
  'view_calendar', 'manage_calendar',
  // Administration
  'manage_users', 'manage_roles', 'manage_permissions',
  // Tickets (migration 005)
  'view_tickets', 'create_tickets', 'edit_tickets', 'assign_tickets',
  'comment_tickets', 'close_tickets',
  // Notifications (migration 010) — kept in sync with apps/web/lib/rbac/types.ts
  'manage_email_campaigns',
  'manage_push_campaigns',
  'manage_notification_templates',
  'manage_ticket_emails',
  'view_notification_logs',
  // Training (migration 029)
  'manage_training',   // create sessions for athletes, reply to comments (coaches/staff)
  'view_training',     // view own sessions, mark done, comment (athletes + all staff)
  'send_notifications', // send push/email notifications to other users
] as const;
export type PermissionName = (typeof PERMISSION_NAMES)[number];

export type ProfileSummary = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role: string | null;
  auth_user_id?: string | null;
  /** Public URL of the profile photo in the `avatars` storage bucket.
   *  Added by migration 022. Null when no photo has been uploaded yet. */
  avatar_url?: string | null;
};

export type CurrentUser = {
  authUserId: string;
  profile: ProfileSummary | null;
  roles: Role[];
  permissions: Set<string>;
};

// ---------------------------------------------------------------------------
// Athlete
// ---------------------------------------------------------------------------

// Values must match the database schema (from packages/shared/src/types.ts)
export type AthleteStatus = 'active' | 'inactive' | 'injured' | 'suspended';

export const ATHLETE_STATUS_LABELS: Record<AthleteStatus, string> = {
  active:    'Activo',
  inactive:  'Inactivo',
  injured:   'Lesionado',
  suspended: 'Suspendido',
};

export type Athlete = {
  id: string;
  athlete_code: string | null;
  first_name: string;
  last_name: string;
  // Campos de identidad
  date_of_birth: string | null;          // DB column: date_of_birth
  sex: string | null;                    // DB column: sex
  email: string | null;                  // added by migration 018
  // Datos físicos (migration 000)
  height_cm: number | null;
  weight_kg: number | null;
  dominant_side: string | null;
  school_or_club: string | null;
  // Disciplina y discapacidad (migration 011)
  discipline: string | null;
  disability_status: 'con_discapacidad' | 'sin_discapacidad' | null;
  // Tutor
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  // Contacto de emergencia
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  // Notas médicas
  medical_notes_summary: string | null;
  // Estado y metadatos
  status: AthleteStatus | null;
  profile_id: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export type DiagnosticStatus = 'pendiente' | 'en_proceso' | 'completo' | 'requiere_atencion';

export type DiagnosticSectionKey =
  | 'medico' | 'nutricion' | 'psicologia' | 'entrenador' | 'fisioterapia';

export type AthleteInitialDiagnostic = {
  id: string;
  athlete_id: string;
  overall_status: DiagnosticStatus;
  completion_pct: number;
  is_baseline: boolean;
  version: number;
  integrated_result: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AthleteSection = {
  id: string;
  diagnostic_id: string;
  athlete_id: string;
  section: DiagnosticSectionKey;
  status: DiagnosticStatus;
  completion_pct: number;
  completed_at: string | null;
  captured_at: string | null;
  updated_at: string | null;
};

export const SECTION_KEYS: DiagnosticSectionKey[] = [
  'medico', 'nutricion', 'psicologia', 'entrenador', 'fisioterapia',
];

export const SECTION_LABELS: Record<DiagnosticSectionKey, string> = {
  medico:       'Médico',
  nutricion:    'Nutrición',
  psicologia:   'Psicología',
  entrenador:   'Entrenador',
  fisioterapia: 'Fisioterapia',
};

export const DIAGNOSTIC_STATUS_LABELS: Record<DiagnosticStatus, string> = {
  pendiente:         'Pendiente',
  en_proceso:        'En proceso',
  completo:          'Completo',
  requiere_atencion: 'Requiere atención',
};

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type Ticket = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_by: string;
  assigned_to: string | null;
  due_date: string | null;
  requester_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

export type TicketWithProfiles = Ticket & {
  created_by_profile: TicketProfile | null;
  assigned_to_profile: TicketProfile | null;
};

export type TicketComment = {
  id: string;
  ticket_id: string;
  author_id: string;
  message: string;
  created_at: string;
};

export type CommentWithAuthor = TicketComment & {
  author: TicketProfile | null;
};

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

// ---------------------------------------------------------------------------
// Notifications (Push)
// ---------------------------------------------------------------------------

export type PushPlatform = 'ios' | 'android' | 'web';

export type PushDeviceToken = {
  id: string;
  profile_id: string;
  onesignal_player_id: string | null;
  device_token: string | null;
  platform: PushPlatform;
  device_name: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  registered_at: string;
};

export type JobStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'retrying';

export type PushJob = {
  id: string;
  campaign_id: string | null;
  template_id: string | null;
  recipient_profile_id: string;
  device_token_id: string | null;
  title: string;
  message: string;
  deep_link: string | null;
  extra_data: Record<string, unknown>;
  status: JobStatus;
  scheduled_at: string;
  processed_at: string | null;
  attempt_count: number;
  created_at: string;
  /** Set by the mobile app when the user reads the notification (migration 024). */
  read_at: string | null;
};

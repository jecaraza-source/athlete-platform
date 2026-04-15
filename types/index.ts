// =============================================================================
// types/index.ts — Domain types for the mobile app
// Ported from apps/web/lib/rbac/types.ts, tickets/types.ts, types/diagnostic.ts,
// notifications/types.ts
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

export const SYSTEM_ROLES = ['super_admin', 'admin', 'coach', 'staff', 'athlete'] as const;
export type SystemRoleName = (typeof SYSTEM_ROLES)[number];

export const PERMISSION_NAMES = [
  'view_athletes', 'create_athletes', 'edit_athletes', 'delete_athletes',
  'view_calendar', 'manage_calendar',
  'manage_users', 'manage_roles', 'manage_permissions',
  'view_tickets', 'create_tickets', 'edit_tickets', 'assign_tickets',
  'comment_tickets', 'close_tickets',
] as const;
export type PermissionName = (typeof PERMISSION_NAMES)[number];

export type ProfileSummary = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role: string | null;
  auth_user_id?: string | null;
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
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  nationality: string | null;
  gender: string | null;
  disability_status: 'con_discapacidad' | 'sin_discapacidad' | null;
  discipline: string | null;
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
};

// =============================================================================
// Ticket system types — mirrors 005_tickets.sql
// =============================================================================

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

// ---------------------------------------------------------------------------
// Base DB row shapes
// ---------------------------------------------------------------------------

export type Ticket = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_by: string;
  assigned_to: string | null;
  /** Added in migration 009 */
  due_date: string | null;
  /** Added in migration 009 */
  requester_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketComment = {
  id: string;
  ticket_id: string;
  author_id: string;
  message: string;
  created_at: string;
};

export type TicketActivityLog = {
  id: string;
  ticket_id: string;
  action: string;
  performed_by: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Slim profile shape returned by joins
// ---------------------------------------------------------------------------

export type TicketProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

// ---------------------------------------------------------------------------
// Joined / enriched shapes used in the UI
// ---------------------------------------------------------------------------

/** Ticket with creator and assignee profile details resolved. */
export type TicketWithProfiles = Ticket & {
  created_by_profile: TicketProfile | null;
  assigned_to_profile: TicketProfile | null;
};

/** Comment with the author's profile resolved. */
export type CommentWithAuthor = TicketComment & {
  author: TicketProfile | null;
};

/** Activity log entry with the performer's name resolved. */
export type ActivityLogEntry = TicketActivityLog & {
  performer: Pick<TicketProfile, 'id' | 'first_name' | 'last_name'> | null;
};

// ---------------------------------------------------------------------------
// Filter shape used by the list page
// ---------------------------------------------------------------------------

export type TicketFilters = {
  status?: string;
  priority?: string;
  assigned_to?: string;
  search?: string;
};

// ---------------------------------------------------------------------------
// Multi-assignee and athlete-link shapes
// ---------------------------------------------------------------------------

/** A staff profile linked to a ticket as an assignee. */
export type TicketAssignee = {
  ticket_id:   string;
  profile_id:  string;
  assigned_at: string;
  profile: TicketProfile | null;
};

/** Slim athlete row used in ticket follow-up selectors. */
export type AthleteOption = {
  id:           string;
  first_name:   string;
  last_name:    string;
  athlete_code: string | null;
  status:       string | null;
};

/** An athlete linked to a ticket for performance follow-up. */
export type TicketAthletePivot = {
  ticket_id:  string;
  athlete_id: string;
  note:       string | null;
  added_at:   string;
  athlete:    AthleteOption | null;
};

// ---------------------------------------------------------------------------
// Well-known ticket permission names
// ---------------------------------------------------------------------------

export const TICKET_PERMISSIONS = [
  'view_tickets',
  'create_tickets',
  'edit_tickets',
  'assign_tickets',
  'comment_tickets',
  'close_tickets',
] as const;

export type TicketPermissionName = (typeof TICKET_PERMISSIONS)[number];

// ---------------------------------------------------------------------------
// UI label helpers
// ---------------------------------------------------------------------------

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  closed:      'Closed',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
  urgent: 'Urgent',
};

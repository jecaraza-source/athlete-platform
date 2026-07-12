/**
 * Ticket data-fetching utilities.
 * Server-only — uses supabaseAdmin (service role, bypasses RLS).
 * Import only from Server Components, Server Actions, or Route Handlers.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import type {
  ActivityLogEntry,
  AthleteOption,
  CommentWithAuthor,
  TicketAssignee,
  TicketAthletePivot,
  TicketFilters,
  TicketWithProfiles,
} from './types';
import type { ProfileSummary } from '@/lib/rbac/types';

// ---------------------------------------------------------------------------
// Reusable select fragments
// ---------------------------------------------------------------------------

/**
 * PostgREST join syntax for profiles when multiple FKs point to the same table.
 * The `!column_name` hint disambiguates which FK to follow.
 */
const TICKET_SELECT = `
  *,
  due_date,
  requester_user_id,
  created_by_profile:profiles!created_by(id, first_name, last_name, email),
  assigned_to_profile:profiles!assigned_to(id, first_name, last_name, email)
`.trim();

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch all tickets with optional filters.
 * Results are ordered newest-first.
 */
export async function getTickets(filters: TicketFilters = {}): Promise<TicketWithProfiles[]> {
  let query = supabaseAdmin
    .from('tickets')
    .select(TICKET_SELECT)
    .order('created_at', { ascending: false });

  if (filters.status)      query = query.eq('status', filters.status);
  if (filters.priority)    query = query.eq('priority', filters.priority);
  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
  if (filters.search)      query = query.ilike('title', `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw new Error(`getTickets: ${error.message}`);
  return (data ?? []) as unknown as TicketWithProfiles[];
}

/**
 * Fetch a single ticket by ID. Returns null if not found.
 */
export async function getTicket(id: string): Promise<TicketWithProfiles | null> {
  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select(TICKET_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`getTicket: ${error.message}`);
  return data as unknown as TicketWithProfiles | null;
}

/**
 * Fetch all comments for a ticket, ordered oldest-first (chronological thread).
 */
export async function getTicketComments(ticketId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabaseAdmin
    .from('ticket_comments')
    .select('*, author:profiles!author_id(id, first_name, last_name, email)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`getTicketComments: ${error.message}`);
  return (data ?? []) as unknown as CommentWithAuthor[];
}

/**
 * Fetch activity log entries for a ticket, ordered newest-first.
 */
export async function getTicketActivity(ticketId: string): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('ticket_activity_log')
    .select('*, performer:profiles!performed_by(id, first_name, last_name)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getTicketActivity: ${error.message}`);
  return (data ?? []) as unknown as ActivityLogEntry[];
}

/**
 * Fetch all profiles for use in assign / filter dropdowns.
 */
export async function getAllProfiles(): Promise<ProfileSummary[]> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .order('last_name');
  return (data ?? []) as ProfileSummary[];
}

/**
 * Fetch non-athlete profiles (staff, coaches, admins) for the assignee picker.
 */
export async function getStaffProfiles(): Promise<ProfileSummary[]> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .neq('role', 'athlete')
    .order('last_name');
  return (data ?? []) as ProfileSummary[];
}

/**
 * Fetch the staff assignees for a ticket (ticket_assignees join).
 */
export async function getTicketAssignees(ticketId: string): Promise<TicketAssignee[]> {
  const { data, error } = await supabaseAdmin
    .from('ticket_assignees')
    .select('*, profile:profiles!profile_id(id, first_name, last_name, email)')
    .eq('ticket_id', ticketId)
    .order('assigned_at', { ascending: true });

  if (error) throw new Error(`getTicketAssignees: ${error.message}`);
  return (data ?? []) as unknown as TicketAssignee[];
}

/**
 * Fetch the athletes linked to a ticket for performance follow-up.
 */
export async function getTicketAthletes(ticketId: string): Promise<TicketAthletePivot[]> {
  const { data, error } = await supabaseAdmin
    .from('ticket_athletes')
    .select('*, athlete:athletes!athlete_id(id, first_name, last_name, athlete_code, status)')
    .eq('ticket_id', ticketId)
    .order('added_at', { ascending: true });

  if (error) throw new Error(`getTicketAthletes: ${error.message}`);
  return (data ?? []) as unknown as TicketAthletePivot[];
}

/**
 * Fetch all active athletes for the follow-up selector.
 */
export async function getAllAthletes(): Promise<AthleteOption[]> {
  const { data } = await supabaseAdmin
    .from('athletes')
    .select('id, first_name, last_name, athlete_code, status')
    .eq('status', 'active')
    .order('last_name');
  return (data ?? []) as AthleteOption[];
}

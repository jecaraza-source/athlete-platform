import { supabase } from '@/lib/supabase';
import type { Ticket, TicketWithProfiles, CommentWithAuthor, TicketStatus, TicketPriority } from '@/types';

export type TicketFilters = {
  status?:    TicketStatus;
  priority?:  TicketPriority;
  search?:    string;
  /** When set, only returns tickets whose created_by matches this profile ID.
   *  Used for athletes who should only see their own tickets. */
  createdBy?: string;
};

/** List tickets with optional filters.
 * Fetches tickets WITHOUT the profiles join to avoid RLS-related row exclusions.
 * The TicketCard handles null profiles gracefully (shows 'Sin asignar').
 */
export async function listTickets(filters?: TicketFilters): Promise<TicketWithProfiles[]> {
  let query = supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.createdBy) {
    // Athletes only see their own tickets
    query = query.eq('created_by', filters.createdBy);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.priority) {
    query = query.eq('priority', filters.priority);
  }
  if (filters?.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[tickets] listTickets error:', error.message, error.code);
    throw error;
  }
  // Cast to TicketWithProfiles — profiles are null in list view, loaded in detail
  return (data ?? []).map((row) => ({
    ...row,
    created_by_profile:  null,
    assigned_to_profile: null,
  })) as TicketWithProfiles[];
}

/** Get a single ticket with full details. */
export async function getTicket(id: string): Promise<TicketWithProfiles | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      created_by_profile:profiles!created_by(id, first_name, last_name, email),
      assigned_to_profile:profiles!assigned_to(id, first_name, last_name, email)
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as TicketWithProfiles | null;
}

/** Get comments for a ticket. */
export async function getTicketComments(ticketId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('ticket_comments')
    .select(`
      *,
      author:profiles(id, first_name, last_name, email)
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CommentWithAuthor[];
}

/** Create a new ticket. */
export async function createTicket(payload: {
  title: string;
  description: string;
  priority: TicketPriority;
  created_by: string;        // profiles.id (FK to profiles table)
  requester_user_id?: string; // auth.uid() — used by RLS policy
  assigned_to?: string;
}): Promise<Ticket> {
  const { data, error } = await supabase
    .from('tickets')
    .insert({ ...payload, status: 'open' })
    .select()
    .single();
  if (error) throw error;
  return data as Ticket;
}

/** Add a comment to a ticket. */
export async function addComment(ticketId: string, authorId: string, message: string) {
  const { error } = await supabase
    .from('ticket_comments')
    .insert({ ticket_id: ticketId, author_id: authorId, message });
  if (error) throw error;
}

/** Change ticket status. */
export async function changeTicketStatus(id: string, status: TicketStatus) {
  const { error } = await supabase
    .from('tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Count open tickets. */
export async function countOpenTickets(): Promise<number> {
  const { count } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open');
  return count ?? 0;
}

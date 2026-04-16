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

/** List tickets with optional filters. */
export async function listTickets(filters?: TicketFilters): Promise<TicketWithProfiles[]> {
  let query = supabase
    .from('tickets')
    .select(`
      *,
      created_by_profile:profiles!tickets_created_by_fkey(id, first_name, last_name, email),
      assigned_to_profile:profiles!tickets_assigned_to_fkey(id, first_name, last_name, email)
    `)
    .order('created_at', { ascending: false });

  if (filters?.createdBy) {
    // Athletes see only their own tickets
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
  if (error) throw error;
  return (data ?? []) as TicketWithProfiles[];
}

/** Get a single ticket with full details. */
export async function getTicket(id: string): Promise<TicketWithProfiles | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      created_by_profile:profiles!tickets_created_by_fkey(id, first_name, last_name, email),
      assigned_to_profile:profiles!tickets_assigned_to_fkey(id, first_name, last_name, email)
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

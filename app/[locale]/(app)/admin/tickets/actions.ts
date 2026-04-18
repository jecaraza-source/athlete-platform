'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentUser, assertPermission } from '@/lib/rbac/server';
import { triggerTicketLifecycleEmails } from '@/lib/notifications/ticket-email-service';
import {
  canAccessTicket,
  canAssignTicket,
  canCloseTicket,
  canEditTicket,
  isSuperAdminOrAdmin,
} from '@/lib/tickets/permissions';
import type { TicketPriority, TicketStatus } from '@/lib/tickets/types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type ActionResult = { error: string | null };

/** Appends a row to ticket_activity_log (best-effort, never throws). */
async function logActivity(
  ticketId: string,
  action: string,
  performedBy: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await supabaseAdmin.from('ticket_activity_log').insert({
    ticket_id:    ticketId,
    action,
    performed_by: performedBy,
    metadata:     metadata ?? null,
  });
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Create a new ticket.
 * Requires: create_tickets permission.
 * Returns the new ticket's id on success so the UI can redirect to it.
 */
export async function createTicket(
  formData: FormData
): Promise<ActionResult & { ticketId?: string }> {
  const denied = await assertPermission('create_tickets');
  if (denied) return denied;

  const user = await getCurrentUser();
  if (!user?.profile) return { error: 'Profile not found for your account.' };

  const title       = (formData.get('title')       as string)?.trim();
  const description = (formData.get('description') as string)?.trim() ?? '';
  const priority    = ((formData.get('priority')   as string) ?? 'medium') as TicketPriority;

  if (!title) return { error: 'Title is required.' };

  const { data: ticket, error } = await supabaseAdmin
    .from('tickets')
    .insert({
      title,
      description,
      priority,
      status:     'open',
      created_by: user.profile.id,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await logActivity(ticket.id, 'created', user.profile.id, { title, priority });

  // Fire-and-forget: trigger lifecycle emails (best-effort, does not block the UI)
  triggerTicketLifecycleEmails({
    ticketId:    ticket.id,
    event:       'ticket_created',
    triggeredBy: user.profile.id,
  }).catch(() => {});

  revalidatePath('/admin/tickets');
  return { error: null, ticketId: ticket.id };
}

/**
 * Update a ticket's status.
 * Requires: edit_tickets + ticket access (or close_tickets for 'closed').
 */
export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You must be signed in to perform this action.' };

  // Fetch current ticket to check access
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('id, title, description, status, priority, created_by, assigned_to, due_date, requester_user_id, created_at, updated_at')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket) return { error: 'Ticket not found.' };

  // Closing requires close_tickets permission
  if (status === 'closed') {
    if (!canCloseTicket(user)) {
      return { error: 'You do not have permission to close tickets.' };
    }
  } else {
    if (!canEditTicket(user, ticket)) {
      return { error: 'You do not have permission to edit this ticket.' };
    }
  }

  const previousStatus = ticket.status;

  const { error } = await supabaseAdmin
    .from('tickets')
    .update({ status })
    .eq('id', ticketId);

  if (error) return { error: error.message };

  if (user.profile) {
    await logActivity(ticketId, 'status_changed', user.profile.id, {
      from: previousStatus,
      to:   status,
    });
  }

  // Map the new status to a lifecycle event
  const lifecycleEvent =
    status === 'resolved' ? 'ticket_resolved' :
    status === 'closed'   ? 'ticket_closed'   :
    'ticket_status_changed';

  triggerTicketLifecycleEmails({
    ticketId,
    event:       lifecycleEvent,
    triggeredBy: user.profile?.id ?? null,
  }).catch(() => {});

  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath('/admin/tickets');
  return { error: null };
}

/**
 * Assign (or unassign) a ticket.
 * Requires: assign_tickets permission.
 * Pass null as assignToProfileId to unassign.
 */
export async function assignTicket(
  ticketId: string,
  assignToProfileId: string | null
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You must be signed in to perform this action.' };

  if (!canAssignTicket(user)) {
    return { error: 'You do not have permission to assign tickets.' };
  }

  const { error } = await supabaseAdmin
    .from('tickets')
    .update({ assigned_to: assignToProfileId })
    .eq('id', ticketId);

  if (error) return { error: error.message };

  if (user.profile) {
    await logActivity(ticketId, 'assigned', user.profile.id, {
      assigned_to: assignToProfileId,
    });
  }

  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath('/admin/tickets');
  return { error: null };
}

/**
 * Add a comment to a ticket.
 * Requires: comment_tickets permission.
 */
export async function addComment(
  ticketId: string,
  message: string
): Promise<ActionResult> {
  const denied = await assertPermission('comment_tickets');
  if (denied) return denied;

  const user = await getCurrentUser();
  if (!user?.profile) return { error: 'Profile not found for your account.' };

  const trimmed = message.trim();
  if (!trimmed) return { error: 'Comment cannot be empty.' };

  const { error } = await supabaseAdmin.from('ticket_comments').insert({
    ticket_id: ticketId,
    author_id: user.profile.id,
    message:   trimmed,
  });

  if (error) return { error: error.message };

  await logActivity(ticketId, 'comment_added', user.profile.id);

  revalidatePath(`/admin/tickets/${ticketId}`);
  return { error: null };
}

/**
 * Set the full list of staff assignees for a ticket (replaces existing).
 * Requires: assign_tickets permission.
 * Also syncs tickets.assigned_to to the first profile ID for list-view filtering.
 */
export async function setTicketAssignees(
  ticketId: string,
  profileIds: string[]
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You must be signed in to perform this action.' };
  if (!canAssignTicket(user)) return { error: 'You do not have permission to assign tickets.' };

  // Replace all assignees atomically
  const { error: delError } = await supabaseAdmin
    .from('ticket_assignees')
    .delete()
    .eq('ticket_id', ticketId);
  if (delError) return { error: delError.message };

  if (profileIds.length > 0) {
    const rows = profileIds.map((pid) => ({ ticket_id: ticketId, profile_id: pid }));
    const { error: insError } = await supabaseAdmin
      .from('ticket_assignees')
      .insert(rows);
    if (insError) return { error: insError.message };
  }

  // Keep tickets.assigned_to in sync with the primary (first) assignee
  // so the list-page filter still works without a JOIN.
  await supabaseAdmin
    .from('tickets')
    .update({ assigned_to: profileIds[0] ?? null })
    .eq('id', ticketId);

  if (user.profile) {
    await logActivity(ticketId, 'assignees_updated', user.profile.id, {
      count: profileIds.length,
    });
  }

  if (profileIds.length > 0) {
    triggerTicketLifecycleEmails({
      ticketId,
      event:       'ticket_assigned',
      triggeredBy: user.profile?.id ?? null,
    }).catch(() => {});
  }

  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath('/admin/tickets');
  return { error: null };
}

/**
 * Set the athletes linked to a ticket for performance follow-up (replaces existing).
 * Requires: edit_tickets permission.
 */
export async function setTicketAthletes(
  ticketId: string,
  athleteIds: string[]
): Promise<ActionResult> {
  const denied = await assertPermission('edit_tickets');
  if (denied) return denied;

  const user = await getCurrentUser();
  if (!user?.profile) return { error: 'Profile not found for your account.' };

  await supabaseAdmin
    .from('ticket_athletes')
    .delete()
    .eq('ticket_id', ticketId);

  if (athleteIds.length > 0) {
    const rows = athleteIds.map((aid) => ({ ticket_id: ticketId, athlete_id: aid }));
    const { error } = await supabaseAdmin.from('ticket_athletes').insert(rows);
    if (error) return { error: error.message };
  }

  await logActivity(ticketId, 'athletes_linked', user.profile.id, {
    count: athleteIds.length,
  });

  revalidatePath(`/admin/tickets/${ticketId}`);
  return { error: null };
}

/**
 * Delete a ticket (admin-only).
 * Used for cleanup; not exposed in the default UI.
 */
export async function deleteTicket(ticketId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated.' };
  if (!isSuperAdminOrAdmin(user)) return { error: 'Admin access required.' };

  const { error } = await supabaseAdmin
    .from('tickets')
    .delete()
    .eq('id', ticketId);

  if (error) return { error: error.message };

  revalidatePath('/admin/tickets');
  return { error: null };
}

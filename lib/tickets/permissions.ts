/**
 * Ticket permission helpers.
 * Pure functions that take a CurrentUser and return a boolean.
 * Safe to import in both Server Components and Server Actions.
 */

import type { CurrentUser } from '@/lib/rbac/types';
import type { Ticket } from './types';

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

/** Returns true for roles that have elevated (admin-level) access. */
export function isSuperAdminOrAdmin(user: CurrentUser): boolean {
  return user.roles.some((r) =>
    ['super_admin', 'admin', 'program_director'].includes(r.code)
  );
}

// ---------------------------------------------------------------------------
// Per-ticket access checks
// ---------------------------------------------------------------------------

/**
 * Returns true if the user may view/interact with a specific ticket.
 * Admins always pass; everyone else must be the creator or assignee.
 */
export function canAccessTicket(user: CurrentUser, ticket: Ticket): boolean {
  if (isSuperAdminOrAdmin(user)) return true;
  if (!user.profile) return false;
  return (
    ticket.created_by  === user.profile.id ||
    ticket.assigned_to === user.profile.id
  );
}

/**
 * Returns true if the user may edit a specific ticket's fields/status.
 * Requires the edit_tickets permission AND access to the ticket.
 */
export function canEditTicket(user: CurrentUser, ticket: Ticket): boolean {
  if (isSuperAdminOrAdmin(user)) return true;
  return user.permissions.has('edit_tickets') && canAccessTicket(user, ticket);
}

// ---------------------------------------------------------------------------
// Action-level checks (not tied to a specific ticket row)
// ---------------------------------------------------------------------------

/** Returns true if the user may assign tickets to other users. */
export function canAssignTicket(user: CurrentUser): boolean {
  return isSuperAdminOrAdmin(user) || user.permissions.has('assign_tickets');
}

/** Returns true if the user may close/resolve tickets. */
export function canCloseTicket(user: CurrentUser): boolean {
  return isSuperAdminOrAdmin(user) || user.permissions.has('close_tickets');
}

/** Returns true if the user may add comments to tickets. */
export function canCommentTicket(user: CurrentUser): boolean {
  return isSuperAdminOrAdmin(user) || user.permissions.has('comment_tickets');
}

/** Returns true if the user may view the tickets index. */
export function canViewTickets(user: CurrentUser): boolean {
  return isSuperAdminOrAdmin(user) || user.permissions.has('view_tickets');
}

/** Returns true if the user may open new tickets. */
export function canCreateTickets(user: CurrentUser): boolean {
  return isSuperAdminOrAdmin(user) || user.permissions.has('create_tickets');
}

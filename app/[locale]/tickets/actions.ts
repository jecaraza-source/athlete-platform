'use server';

import { revalidatePath }                          from 'next/cache';
import { supabaseAdmin }                            from '@/lib/supabase-admin';
import { requireAuthenticated }                     from '@/lib/rbac/server';
import { triggerTicketLifecycleEmails }             from '@/lib/notifications/ticket-email-service';
import type { TicketPriority }                      from '@/lib/tickets/types';

// ---------------------------------------------------------------------------
// createMyTicket
// ---------------------------------------------------------------------------

/**
 * Creates a ticket on behalf of the currently authenticated user.
 *
 * Guard: requireAuthenticated() — any logged-in user (including athletes)
 * can submit a ticket. No DB permission entry required.
 *
 * Returns { error, ticketId } so the Client Component can redirect on success.
 */
export async function createMyTicket(
  formData: FormData
): Promise<{ error: string | null; ticketId?: string }> {
  // Throws a Next.js redirect to /login for unauthenticated requests.
  const user = await requireAuthenticated();

  if (!user.profile) {
    return { error: 'No se encontró tu perfil de usuario. Contacta al administrador.' };
  }

  const title       = (formData.get('title')       as string | null)?.trim();
  const description = (formData.get('description') as string | null)?.trim() ?? '';
  const priority    = ((formData.get('priority')   as string) ?? 'medium') as TicketPriority;

  if (!title) return { error: 'El título es requerido.' };

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

  // Fire-and-forget: send lifecycle notification emails where configured.
  triggerTicketLifecycleEmails({
    ticketId:    ticket.id,
    event:       'ticket_created',
    triggeredBy: user.profile.id,
  }).catch(() => {});

  revalidatePath('/tickets');
  return { error: null, ticketId: ticket.id as string };
}

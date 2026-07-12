'use server';

import { revalidatePath }   from 'next/cache';
import { z }                from 'zod';
import { supabaseAdmin }    from '@/lib/supabase-admin';
import { assertPermission, assertAdminAccess, getCurrentUser } from '@/lib/rbac/server';
import { sendTicketEmail }  from '@/lib/notifications/ticket-email-service';
import { writeNotificationAudit } from '@/lib/notifications/email-service';
import type { TicketEmailType } from '@/lib/notifications/types';

type ActionResult = { error: string | null };

// ---------------------------------------------------------------------------
// Update ticket email template
// ---------------------------------------------------------------------------

const TemplateSchema = z.object({
  subject:    z.string().min(1),
  html_body:  z.string().min(1),
  plain_body: z.string().default(''),
  is_active:  z.boolean().default(true),
});

export async function updateTicketEmailTemplate(
  templateId: string,
  formData:   FormData
): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return denied;
  const user = await getCurrentUser();

  const parse = TemplateSchema.safeParse({
    subject:   formData.get('subject'),
    html_body: formData.get('html_body'),
    plain_body: formData.get('plain_body') || '',
    is_active: formData.get('is_active') === 'true',
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { error } = await supabaseAdmin
    .from('ticket_email_templates')
    .update({ ...parse.data, updated_by: user?.profile?.id ?? null })
    .eq('id', templateId);

  if (error) return { error: error.message };

  await writeNotificationAudit({
    action: 'template_updated', performedBy: user?.profile?.id ?? null,
    entityType: 'ticket_email_template', entityId: templateId,
  });

  revalidatePath('/admin/notificaciones/tickets/plantillas');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Update ticket automation rule
// ---------------------------------------------------------------------------

const RuleSchema = z.object({
  name:             z.string().min(1),
  description:      z.string().optional(),
  event_key:        z.string().min(1),
  trigger_event:    z.enum([
    'ticket_created', 'ticket_assigned', 'ticket_status_changed',
    'ticket_overdue', 'ticket_pending_response', 'ticket_resolved', 'ticket_closed',
  ]),
  delay_minutes:    z.coerce.number().min(0).default(0),
  filter_statuses:  z.array(z.string()).optional().nullable(),
  filter_priorities: z.array(z.string()).optional().nullable(),
  is_active:        z.boolean().default(true),
});

export async function createAutomationRule(formData: FormData): Promise<ActionResult & { ruleId?: string }> {
  const denied = await assertAdminAccess();
  if (denied) return denied;
  const user = await getCurrentUser();

  const parse = RuleSchema.safeParse({
    name:              formData.get('name'),
    description:       formData.get('description') || undefined,
    event_key:         formData.get('event_key'),
    trigger_event:     formData.get('trigger_event'),
    delay_minutes:     formData.get('delay_minutes') || 0,
    filter_statuses:   JSON.parse((formData.get('filter_statuses') as string) || 'null'),
    filter_priorities: JSON.parse((formData.get('filter_priorities') as string) || 'null'),
    is_active:         formData.get('is_active') !== 'false',
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { data: rule, error } = await supabaseAdmin
    .from('ticket_automation_rules')
    .insert({ ...parse.data, created_by: user?.profile?.id ?? null })
    .select('id')
    .single();
  if (error) return { error: error.message };

  await writeNotificationAudit({
    action: 'ticket_rule_created', performedBy: user?.profile?.id ?? null,
    entityType: 'ticket_automation_rule', entityId: rule.id,
  });

  revalidatePath('/admin/notificaciones/tickets/reglas');
  return { error: null, ruleId: rule.id };
}

export async function updateAutomationRule(
  ruleId:   string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return denied;
  const user = await getCurrentUser();

  const parse = RuleSchema.safeParse({
    name:              formData.get('name'),
    description:       formData.get('description') || undefined,
    event_key:         formData.get('event_key'),
    trigger_event:     formData.get('trigger_event'),
    delay_minutes:     formData.get('delay_minutes') || 0,
    filter_statuses:   JSON.parse((formData.get('filter_statuses') as string) || 'null'),
    filter_priorities: JSON.parse((formData.get('filter_priorities') as string) || 'null'),
    is_active:         formData.get('is_active') !== 'false',
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { error } = await supabaseAdmin
    .from('ticket_automation_rules')
    .update({ ...parse.data, updated_by: user?.profile?.id ?? null })
    .eq('id', ruleId);
  if (error) return { error: error.message };

  await writeNotificationAudit({
    action: 'ticket_rule_updated', performedBy: user?.profile?.id ?? null,
    entityType: 'ticket_automation_rule', entityId: ruleId,
  });

  revalidatePath('/admin/notificaciones/tickets/reglas');
  return { error: null };
}

export async function toggleAutomationRule(ruleId: string, isActive: boolean): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return denied;

  const { error } = await supabaseAdmin
    .from('ticket_automation_rules')
    .update({ is_active: isActive })
    .eq('id', ruleId);

  revalidatePath('/admin/notificaciones/tickets/reglas');
  revalidatePath('/admin/notificaciones/tickets');
  return { error: error?.message ?? null };
}

export async function deleteAutomationRule(ruleId: string): Promise<ActionResult> {
  const denied = await assertAdminAccess();
  if (denied) return denied;
  const user = await getCurrentUser();

  const { error } = await supabaseAdmin
    .from('ticket_automation_rules')
    .delete()
    .eq('id', ruleId);

  if (error) return { error: error.message };

  await writeNotificationAudit({
    action:      'ticket_rule_updated',
    performedBy: user?.profile?.id ?? null,
    entityType:  'ticket_automation_rule',
    entityId:    ruleId,
    metadata:    { deleted: true },
  });

  revalidatePath('/admin/notificaciones/tickets/reglas');
  revalidatePath('/admin/notificaciones/tickets');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Manual ticket email send (from ticket detail page)
// ---------------------------------------------------------------------------

const ManualSendSchema = z.object({
  ticket_id:       z.string().uuid(),
  event_key:       z.string().min(1),
  email_type:      z.enum(['reminder', 'follow_up', 'status_update', 'assignment', 'overdue', 'resolution', 'creation', 'closure']),
  recipient_email: z.string().email(),
  recipient_profile_id: z.string().uuid().optional(),
});

export async function sendManualTicketEmail(formData: FormData): Promise<ActionResult> {
  const denied = await assertPermission('manage_ticket_emails');
  if (denied) return denied;
  const user = await getCurrentUser();

  const parse = ManualSendSchema.safeParse({
    ticket_id:            formData.get('ticket_id'),
    event_key:            formData.get('event_key'),
    email_type:           formData.get('email_type'),
    recipient_email:      formData.get('recipient_email'),
    recipient_profile_id: formData.get('recipient_profile_id') || undefined,
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const d = parse.data;

  // Fetch ticket variables
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('id, title, status, priority, due_date, created_at')
    .eq('id', d.ticket_id)
    .single();

  if (!ticket) return { error: 'Ticket no encontrado.' };

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const variables: Record<string, string> = {
    ticket_id:        ticket.id,
    ticket_title:     ticket.title,
    ticket_status:    ticket.status,
    ticket_priority:  ticket.priority,
    ticket_due_date:  ticket.due_date ?? '—',
    ticket_created_at: new Date(ticket.created_at).toLocaleDateString('es-MX'),
    ticket_link:      `${APP_URL}/admin/tickets/${ticket.id}`,
    requester_name:   '—',
    assigned_to_name: '—',
    latest_comment:   '',
  };

  const result = await sendTicketEmail({
    ticketId:           d.ticket_id,
    eventKey:           d.event_key,
    emailType:          d.email_type as TicketEmailType,
    triggerType:        'manual',
    triggeredBy:        user?.profile?.id ?? null,
    recipientEmail:     d.recipient_email,
    recipientProfileId: d.recipient_profile_id ?? null,
    variables,
  });

  revalidatePath(`/admin/tickets/${d.ticket_id}`);
  return { error: result.error };
}

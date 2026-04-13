// =============================================================================
// lib/notifications/ticket-email-service.ts
// Ticket email service.
// Handles manual sends (reminder, follow-up) and automatic sends triggered
// by ticket lifecycle events (created, assigned, status_changed, overdue…).
//
// Server-only — uses supabaseAdmin + resendAdapter.
// =============================================================================

import { supabaseAdmin }       from '@/lib/supabase-admin';
import { resendAdapter }       from './providers/resend-adapter';
import { renderEmailTemplate } from './template-utils';
import type {
  TicketEmailType,
  TicketEmailTrigger,
  TicketEmailJob,
} from './types';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Variable builder
// ---------------------------------------------------------------------------

type TicketRow = {
  id:           string;
  title:        string;
  status:       string;
  priority:     string;
  due_date?:    string | null;
  created_at:   string;
};

type ProfileRow = {
  first_name: string;
  last_name:  string;
};

function buildTicketVariables(
  ticket:        TicketRow,
  requester?:    ProfileRow | null,
  assignedTo?:   ProfileRow | null,
  latestComment?: string | null
): Record<string, string> {
  return {
    ticket_id:        ticket.id,
    ticket_title:     ticket.title,
    ticket_status:    ticket.status,
    ticket_priority:  ticket.priority,
    ticket_due_date:  ticket.due_date ?? '—',
    ticket_created_at: new Date(ticket.created_at).toLocaleDateString('es-MX'),
    ticket_link:      `${APP_URL}/admin/tickets/${ticket.id}`,
    requester_name:   requester  ? `${requester.first_name} ${requester.last_name}`  : '—',
    assigned_to_name: assignedTo ? `${assignedTo.first_name} ${assignedTo.last_name}` : '—',
    latest_comment:   latestComment ?? '',
  };
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

/**
 * Send a ticket email for a given event_key.
 * Creates a ticket_email_job record, sends via Resend, and logs the delivery.
 * Idempotency key: `ticket:{id}:event:{event_key}:recipient:{email}:{timestamp_minute}`
 * (timestamp rounded to minute to allow re-sends after manual retries).
 */
export async function sendTicketEmail(params: {
  ticketId:       string;
  eventKey:       string;
  emailType:      TicketEmailType;
  triggerType:    TicketEmailTrigger;
  triggeredBy?:   string | null;
  recipientEmail: string;
  recipientProfileId?: string | null;
  variables?:     Record<string, string>;
}): Promise<{ success: boolean; jobId: string | null; error: string | null }> {
  const {
    ticketId, eventKey, emailType, triggerType,
    triggeredBy, recipientEmail, recipientProfileId, variables = {},
  } = params;

  // 1. Fetch the active template for this event
  const { data: template, error: tErr } = await supabaseAdmin
    .from('ticket_email_templates')
    .select('*')
    .eq('event_key', eventKey)
    .eq('is_active', true)
    .maybeSingle();

  if (tErr || !template) {
    return { success: false, jobId: null, error: `No active template for event_key "${eventKey}".` };
  }

  // 2. Render content
  const { html, text, subject } = renderEmailTemplate(
    template.html_body,
    template.plain_body,
    template.subject,
    variables
  );

  // 3. Build idempotency key (minute-level granularity)
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const idempotencyKey = `ticket:${ticketId}:event:${eventKey}:recipient:${recipientEmail}:t${minuteBucket}`;

  // 4. Insert job record
  const { data: job, error: jobErr } = await supabaseAdmin
    .from('ticket_email_jobs')
    .insert({
      ticket_id:            ticketId,
      event_key:            eventKey,
      email_type:           emailType,
      trigger_type:         triggerType,
      triggered_by:         triggeredBy ?? null,
      recipient_profile_id: recipientProfileId ?? null,
      recipient_email:      recipientEmail,
      subject,
      html_body:            html,
      plain_body:           text,
      variables_used:       variables,
      status:               'processing',
      idempotency_key:      idempotencyKey,
    })
    .select('id')
    .single();

  if (jobErr || !job) {
    return { success: false, jobId: null, error: jobErr?.message ?? 'Failed to create job record.' };
  }

  // 5. Send via Resend
  const result = await resendAdapter.send({
    to:              recipientEmail,
    from:            FROM_EMAIL,
    subject,
    html,
    text,
    idempotency_key: idempotencyKey,
  });

  // 6. Update job and log delivery
  if (result.success) {
    await supabaseAdmin
      .from('ticket_email_jobs')
      .update({
        status:              'sent',
        processed_at:        new Date().toISOString(),
        provider_message_id: result.message_id,
        provider_response:   result.raw,
        attempt_count:       1,
      })
      .eq('id', job.id);

    await supabaseAdmin.from('ticket_email_deliveries').insert({
      job_id:              job.id,
      status:              'sent',
      provider_message_id: result.message_id,
      provider_response:   result.raw,
    });

    // Append to ticket_activity_log for visibility in the ticket detail panel
    if (triggeredBy) {
      await supabaseAdmin.from('ticket_activity_log').insert({
        ticket_id:    ticketId,
        action:       'email_sent',
        performed_by: triggeredBy,
        metadata: {
          event_key:       eventKey,
          email_type:      emailType,
          trigger_type:    triggerType,
          recipient_email: recipientEmail,
          job_id:          job.id,
        },
      });
    }

    return { success: true, jobId: job.id, error: null };
  } else {
    await supabaseAdmin
      .from('ticket_email_jobs')
      .update({
        status:       'failed',
        last_error:   result.error,
        attempt_count: 1,
        provider_response: result.raw,
      })
      .eq('id', job.id);

    await supabaseAdmin.from('ticket_email_deliveries').insert({
      job_id:           job.id,
      status:           'failed',
      provider_response: result.raw,
    });

    return { success: false, jobId: job.id, error: result.error };
  }
}

// ---------------------------------------------------------------------------
// Lifecycle-triggered sends (called from ticket server actions)
// ---------------------------------------------------------------------------

/**
 * Send all relevant emails triggered by a ticket lifecycle event.
 * Fetches the full ticket row + related profiles and dispatches
 * to matching active automation rules.
 */
export async function triggerTicketLifecycleEmails(params: {
  ticketId:    string;
  event:       'ticket_created' | 'ticket_assigned' | 'ticket_status_changed' | 'ticket_resolved' | 'ticket_closed';
  triggeredBy: string | null;
}): Promise<void> {
  const { ticketId, event, triggeredBy } = params;

  // Fetch ticket + profiles
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select(`
      id, title, status, priority, due_date, created_at,
      created_by, assigned_to,
      requester_user_id,
      created_by_profile:profiles!tickets_created_by_fkey(first_name, last_name, email),
      assigned_profile:profiles!tickets_assigned_to_fkey(first_name, last_name, email)
    `)
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket) return;

  // Fetch active automation rules for this event
  const { data: rules } = await supabaseAdmin
    .from('ticket_automation_rules')
    .select('*')
    .eq('trigger_event', event)
    .eq('is_active', true);

  if (!rules || rules.length === 0) return;

  // Fetch latest comment for context
  const { data: latestCommentRow } = await supabaseAdmin
    .from('ticket_comments')
    .select('message')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const creatorProfile  = Array.isArray(ticket.created_by_profile) ? ticket.created_by_profile[0] : ticket.created_by_profile;
  const assigneeProfile = Array.isArray(ticket.assigned_profile)   ? ticket.assigned_profile[0]   : ticket.assigned_profile;

  const vars = buildTicketVariables(
    ticket,
    creatorProfile as ProfileRow | null,
    assigneeProfile as ProfileRow | null,
    latestCommentRow?.message ?? null
  );

  for (const rule of rules) {
    // Apply status filter
    if (rule.filter_statuses && !rule.filter_statuses.includes(ticket.status)) continue;
    // Apply priority filter
    if (rule.filter_priorities && !rule.filter_priorities.includes(ticket.priority)) continue;

    // Determine recipients based on event_key
    const recipients = await resolveTicketRecipients(ticket, rule.event_key, assigneeProfile as ProfileRow & { email: string } | null, creatorProfile as ProfileRow & { email: string } | null);

    const emailType = eventKeyToEmailType(rule.event_key);

    for (const recipient of recipients) {
      const recipientVars = {
        ...vars,
        // Personalize greeting for the specific recipient
        assigned_to_name: `${recipient.first_name} ${recipient.last_name}`,
      };

      if (rule.delay_minutes > 0) {
        // For delayed sends, just insert a pending job; cron will process it
        const scheduledAt = new Date(Date.now() + rule.delay_minutes * 60_000).toISOString();
        const minuteBucket = Math.floor(Date.now() / 60_000);
        const idempotencyKey = `ticket:${ticketId}:rule:${rule.id}:recipient:${recipient.email}:t${minuteBucket}`;

        const { data: existingTemplate } = await supabaseAdmin
          .from('ticket_email_templates')
          .select('*')
          .eq('event_key', rule.event_key)
          .eq('is_active', true)
          .maybeSingle();

        if (!existingTemplate) continue;

        const rendered = renderEmailTemplate(
          existingTemplate.html_body,
          existingTemplate.plain_body,
          existingTemplate.subject,
          recipientVars
        );

        await supabaseAdmin.from('ticket_email_jobs').upsert({
          ticket_id:            ticketId,
          event_key:            rule.event_key,
          email_type:           emailType,
          trigger_type:         'automatic',
          triggered_by:         null,
          recipient_profile_id: recipient.profile_id ?? null,
          recipient_email:      recipient.email,
          subject:              rendered.subject,
          html_body:            rendered.html,
          plain_body:           rendered.text,
          variables_used:       recipientVars,
          status:               'pending',
          idempotency_key:      idempotencyKey,
          scheduled_at:         scheduledAt,
        }, { onConflict: 'idempotency_key', ignoreDuplicates: true });
      } else {
        // Immediate send
        await sendTicketEmail({
          ticketId,
          eventKey:            rule.event_key,
          emailType,
          triggerType:         'automatic',
          triggeredBy,
          recipientEmail:      recipient.email,
          recipientProfileId:  recipient.profile_id ?? null,
          variables:           recipientVars,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Deduplication helper
// ---------------------------------------------------------------------------

/**
 * Returns true if a ticket_email_job already exists for this ticket + event_key
 * created within the last `windowMinutes`. Prevents flooding on each cron tick.
 */
async function hasRecentTicketEmail(
  ticketId:      string,
  eventKey:      string,
  windowMinutes: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const { count } = await supabaseAdmin
    .from('ticket_email_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('ticket_id', ticketId)
    .eq('event_key',  eventKey)
    .in('status', ['sent', 'processing', 'pending'])
    .gte('created_at', since);

  return (count ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// processTicketAutomation — called by cron every 5 minutes
// ---------------------------------------------------------------------------

export type TicketAutomationResult = {
  overdue_processed:  number;
  pending_processed:  number;
  jobs_flushed:       number;
  skipped_dedup:      number;
  errors:             string[];
};

/**
 * Two-phase ticket automation processor:
 *
 * Phase 1 — Time-based rules (cron-driven):
 *   a) ticket_overdue:          tickets past their due_date
 *   b) ticket_pending_response: tickets with no update for rule.delay_minutes
 *
 * Phase 2 — Flush delayed jobs already queued in ticket_email_jobs.
 *
 * Deduplication: skips a send if the same event_key was already sent
 * to the ticket within a sensible window, preventing re-flood on each tick.
 */
export async function processTicketAutomation(): Promise<TicketAutomationResult> {
  const now             = new Date();
  let overdueProcessed  = 0;
  let pendingProcessed  = 0;
  let jobsFlushed       = 0;
  let skippedDedup      = 0;
  const errors: string[] = [];

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 1a — ticket_overdue rules
  // ──────────────────────────────────────────────────────────────────────────
  const { data: overdueRules } = await supabaseAdmin
    .from('ticket_automation_rules')
    .select('*')
    .eq('trigger_event', 'ticket_overdue')
    .eq('is_active', true);

  for (const rule of overdueRules ?? []) {
    const statusFilter = rule.filter_statuses ?? ['open', 'in_progress'];
    const priorityFilter: string[] | null = rule.filter_priorities ?? null;

    let query = supabaseAdmin
      .from('tickets')
      .select(`
        id, title, status, priority, due_date, created_at,
        created_by, assigned_to,
        creator:profiles!tickets_created_by_fkey(first_name, last_name, email),
        assignee:profiles!tickets_assigned_to_fkey(first_name, last_name, email)
      `)
      .in('status', statusFilter)
      .not('due_date', 'is', null)
      .lte('due_date', now.toISOString());

    if (priorityFilter) {
      query = query.in('priority', priorityFilter);
    }

    const { data: tickets } = await query;

    for (const ticket of tickets ?? []) {
      // Dedup: don't re-send overdue email within 24h
      const alreadySent = await hasRecentTicketEmail(ticket.id, rule.event_key, 24 * 60);
      if (alreadySent) { skippedDedup++; continue; }

      try {
        await dispatchAutomationEmail({ ticket, rule, now });
        overdueProcessed++;
      } catch (err) {
        errors.push(`overdue ticket ${ticket.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 1b — ticket_pending_response rules
  // ──────────────────────────────────────────────────────────────────────────
  const { data: pendingRules } = await supabaseAdmin
    .from('ticket_automation_rules')
    .select('*')
    .eq('trigger_event', 'ticket_pending_response')
    .eq('is_active', true);

  for (const rule of pendingRules ?? []) {
    // Tickets that have had no update for at least delay_minutes
    const cutoff         = new Date(now.getTime() - rule.delay_minutes * 60_000).toISOString();
    const statusFilter   = rule.filter_statuses   ?? ['open', 'in_progress'];
    const priorityFilter: string[] | null = rule.filter_priorities ?? null;

    let query = supabaseAdmin
      .from('tickets')
      .select(`
        id, title, status, priority, due_date, created_at,
        created_by, assigned_to,
        creator:profiles!tickets_created_by_fkey(first_name, last_name, email),
        assignee:profiles!tickets_assigned_to_fkey(first_name, last_name, email)
      `)
      .in('status', statusFilter)
      .lte('updated_at', cutoff);

    if (priorityFilter) {
      query = query.in('priority', priorityFilter);
    }

    const { data: tickets } = await query;

    for (const ticket of tickets ?? []) {
      // Dedup: don't re-send within the same delay window
      const alreadySent = await hasRecentTicketEmail(ticket.id, rule.event_key, rule.delay_minutes);
      if (alreadySent) { skippedDedup++; continue; }

      try {
        await dispatchAutomationEmail({ ticket, rule, now });
        pendingProcessed++;
      } catch (err) {
        errors.push(`pending ticket ${ticket.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 2 — Flush delayed ticket_email_jobs already enqueued
  // ──────────────────────────────────────────────────────────────────────────
  const { data: pendingJobs } = await supabaseAdmin
    .from('ticket_email_jobs')
    .select('*')
    .in('status', ['pending', 'retrying'])
    .lte('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(50);

  for (const job of (pendingJobs ?? []) as TicketEmailJob[]) {
    await supabaseAdmin
      .from('ticket_email_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id);

    const result = await resendAdapter.send({
      to:              job.recipient_email,
      from:            FROM_EMAIL,
      subject:         job.subject,
      html:            job.html_body,
      text:            job.plain_body,
      idempotency_key: job.idempotency_key,
    });

    const newAttemptCount = job.attempt_count + 1;

    if (result.success) {
      await supabaseAdmin.from('ticket_email_jobs').update({
        status:              'sent',
        processed_at:        new Date().toISOString(),
        provider_message_id: result.message_id,
        attempt_count:       newAttemptCount,
        last_error:          null,
      }).eq('id', job.id);

      await supabaseAdmin.from('ticket_email_deliveries').insert({
        job_id: job.id, status: 'sent', provider_message_id: result.message_id,
        provider_response: result.raw,
      });
    } else {
      const nextStatus     = newAttemptCount >= job.max_attempts ? 'failed' : 'retrying';
      const backoffMinutes = Math.pow(2, newAttemptCount);
      const retryAt        = new Date(Date.now() + backoffMinutes * 60_000).toISOString();

      await supabaseAdmin.from('ticket_email_jobs').update({
        status:        nextStatus,
        scheduled_at:  nextStatus === 'retrying' ? retryAt : job.scheduled_at,
        attempt_count: newAttemptCount,
        last_error:    result.error,
        provider_response: result.raw,
      }).eq('id', job.id);

      await supabaseAdmin.from('ticket_email_deliveries').insert({
        job_id: job.id, status: 'failed', provider_response: result.raw,
      });
    }

    jobsFlushed++;
  }

  return { overdue_processed: overdueProcessed, pending_processed: pendingProcessed, jobs_flushed: jobsFlushed, skipped_dedup: skippedDedup, errors };
}

// ---------------------------------------------------------------------------
// Internal: build variables and send email for a single automation rule match
// ---------------------------------------------------------------------------

type RawTicket = {
  id: string; title: string; status: string; priority: string;
  due_date: string | null; created_at: string;
  created_by: string; assigned_to: string | null;
  creator:  { first_name: string; last_name: string; email: string } | { first_name: string; last_name: string; email: string }[] | null;
  assignee: { first_name: string; last_name: string; email: string } | { first_name: string; last_name: string; email: string }[] | null;
};

async function dispatchAutomationEmail({
  ticket,
  rule,
  now,
}: {
  ticket: RawTicket;
  rule:   { event_key: string; delay_minutes: number };
  now:    Date;
}): Promise<void> {
  const creatorRaw  = Array.isArray(ticket.creator)  ? ticket.creator[0]  : ticket.creator;
  const assigneeRaw = Array.isArray(ticket.assignee) ? ticket.assignee[0] : ticket.assignee;

  const creatorProfile  = creatorRaw  as (ProfileRow & { email: string }) | null;
  const assigneeProfile = assigneeRaw as (ProfileRow & { email: string }) | null;

  const vars: Record<string, string> = {
    ticket_id:        ticket.id,
    ticket_title:     ticket.title,
    ticket_status:    ticket.status,
    ticket_priority:  ticket.priority,
    ticket_due_date:  ticket.due_date ?? '—',
    ticket_created_at: new Date(ticket.created_at).toLocaleDateString('es-MX'),
    ticket_link:      `${APP_URL}/admin/tickets/${ticket.id}`,
    requester_name:   creatorProfile  ? `${creatorProfile.first_name} ${creatorProfile.last_name}`  : '—',
    assigned_to_name: assigneeProfile ? `${assigneeProfile.first_name} ${assigneeProfile.last_name}` : '—',
    latest_comment:   '',
  };

  // Determine recipient(s)
  const recipients: Array<{ email: string; profile_id: string | null }> = [];

  if (rule.event_key === 'ticket_overdue') {
    // Notify assignee primarily, fallback to creator
    if (assigneeProfile?.email) {
      recipients.push({ email: assigneeProfile.email, profile_id: ticket.assigned_to });
    } else if (creatorProfile?.email) {
      recipients.push({ email: creatorProfile.email, profile_id: ticket.created_by });
    }
  } else {
    // pending_response or other — notify assignee, then creator if different
    if (assigneeProfile?.email) {
      recipients.push({ email: assigneeProfile.email, profile_id: ticket.assigned_to });
    }
    if (creatorProfile?.email && creatorProfile.email !== assigneeProfile?.email) {
      recipients.push({ email: creatorProfile.email, profile_id: ticket.created_by });
    }
  }

  for (const recipient of recipients) {
    await sendTicketEmail({
      ticketId:           ticket.id,
      eventKey:           rule.event_key,
      emailType:          eventKeyToEmailType(rule.event_key),
      triggerType:        'automatic',
      triggeredBy:        null,
      recipientEmail:     recipient.email,
      recipientProfileId: recipient.profile_id,
      variables:          { ...vars, assigned_to_name: recipient.email === assigneeProfile?.email
        ? (assigneeProfile ? `${assigneeProfile.first_name} ${assigneeProfile.last_name}` : '—')
        : vars.assigned_to_name
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SimpleRecipient = {
  profile_id: string | null;
  email:      string;
  first_name: string;
  last_name:  string;
};

async function resolveTicketRecipients(
  ticket:          { created_by: string; assigned_to: string | null },
  eventKey:        string,
  assigneeProfile: (ProfileRow & { email: string }) | null,
  creatorProfile:  (ProfileRow & { email: string }) | null
): Promise<SimpleRecipient[]> {
  const recipients: SimpleRecipient[] = [];

  if (eventKey === 'ticket_assigned' || eventKey === 'ticket_reassigned') {
    if (assigneeProfile?.email) {
      recipients.push({
        profile_id: ticket.assigned_to,
        email:      assigneeProfile.email,
        first_name: assigneeProfile.first_name,
        last_name:  assigneeProfile.last_name,
      });
    }
  } else if (eventKey === 'ticket_resolved' || eventKey === 'ticket_closed') {
    if (creatorProfile?.email) {
      recipients.push({
        profile_id: ticket.created_by,
        email:      creatorProfile.email,
        first_name: creatorProfile.first_name,
        last_name:  creatorProfile.last_name,
      });
    }
  } else {
    // Default: notify both requester and assignee where available
    if (creatorProfile?.email) {
      recipients.push({
        profile_id: ticket.created_by,
        email:      creatorProfile.email,
        first_name: creatorProfile.first_name,
        last_name:  creatorProfile.last_name,
      });
    }
    if (assigneeProfile?.email && assigneeProfile.email !== creatorProfile?.email) {
      recipients.push({
        profile_id: ticket.assigned_to,
        email:      assigneeProfile.email,
        first_name: assigneeProfile.first_name,
        last_name:  assigneeProfile.last_name,
      });
    }
  }

  return recipients;
}

function eventKeyToEmailType(eventKey: string): TicketEmailType {
  const map: Record<string, TicketEmailType> = {
    ticket_created:          'creation',
    ticket_assigned:         'assignment',
    ticket_reassigned:       'assignment',
    ticket_status_updated:   'status_update',
    ticket_pending_response: 'reminder',
    ticket_follow_up:        'follow_up',
    ticket_overdue:          'overdue',
    ticket_resolved:         'resolution',
    ticket_closed:           'closure',
  };
  return map[eventKey] ?? 'reminder';
}

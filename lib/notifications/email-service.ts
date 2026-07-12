// =============================================================================
// lib/notifications/email-service.ts
// Email campaign send service.
// Handles job enqueueing, processing, retry with exponential backoff,
// delivery logging, and audit trail.
//
// Server-only — uses supabaseAdmin.
// =============================================================================

import { supabaseAdmin }     from '@/lib/supabase-admin';
import { resendAdapter }     from './providers/resend-adapter';
import { resolveAudience }   from './audience';
import { renderEmailTemplate } from './template-utils';
import type { EmailCampaign, EmailJob, AuditAction } from './types';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

/**
 * Resolve the campaign's audience and insert one email_job per recipient.
 * Uses an idempotency_key of `campaign:{id}:profile:{profile_id}` to prevent
 * duplicate sends if triggered multiple times.
 */
export async function enqueueEmailCampaign(
  campaign: EmailCampaign
): Promise<{ enqueued: number; error: string | null }> {
  // 1. Fetch the template
  if (!campaign.template_id) {
    return { enqueued: 0, error: 'Campaign has no template assigned.' };
  }

  const { data: template, error: tErr } = await supabaseAdmin
    .from('email_templates')
    .select('*')
    .eq('id', campaign.template_id)
    .single();

  if (tErr || !template) {
    return { enqueued: 0, error: 'Template not found.' };
  }

  // 2. Resolve recipients
  const recipients = await resolveAudience({
    selection_mode:  campaign.selection_mode,
    audience_type:   campaign.audience_type,
    recipient_ids:   campaign.recipient_ids,
    audience_config: campaign.audience_config,
    channel:         'email',
  });

  if (recipients.length === 0) {
    return { enqueued: 0, error: null };
  }

  // 3. Build job rows
  const scheduledAt = campaign.scheduled_at ?? new Date().toISOString();

  const rows = recipients.map((r) => {
    const vars = {
      first_name: r.first_name,
      last_name:  r.last_name,
      ...campaign.variable_overrides,
    };

    const { html, text, subject } = renderEmailTemplate(
      template.html_body,
      template.plain_body,
      template.subject,
      vars
    );

    return {
      campaign_id:          campaign.id,
      template_id:          template.id,
      recipient_profile_id: r.profile_id,
      recipient_email:      r.email,
      subject,
      html_body:            html,
      plain_body:           text,
      status:               'pending' as const,
      idempotency_key:      `campaign:${campaign.id}:profile:${r.profile_id}`,
      scheduled_at:         scheduledAt,
    };
  });

  // 4. Upsert (idempotency: skip duplicates)
  const { error: insErr } = await supabaseAdmin
    .from('email_jobs')
    .upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true });

  if (insErr) {
    return { enqueued: 0, error: insErr.message };
  }

  return { enqueued: rows.length, error: null };
}

// ---------------------------------------------------------------------------
// Process pending jobs (called by cron)
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50;

/**
 * Pick up to BATCH_SIZE pending/retrying email jobs that are due,
 * send them via Resend, and update their status and delivery records.
 */
export async function processPendingEmailJobs(): Promise<{
  processed: number;
  failed: number;
}> {
  const now = new Date().toISOString();

  const { data: jobs, error } = await supabaseAdmin
    .from('email_jobs')
    .select('*')
    .in('status', ['pending', 'retrying'])
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error || !jobs || jobs.length === 0) {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed    = 0;

  for (const job of jobs as EmailJob[]) {
    // Mark as processing to prevent duplicate pickup
    await supabaseAdmin
      .from('email_jobs')
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
      await supabaseAdmin
        .from('email_jobs')
        .update({
          status:              'sent',
          processed_at:        new Date().toISOString(),
          provider_message_id: result.message_id,
          provider_response:   result.raw,
          attempt_count:       newAttemptCount,
          last_error:          null,
        })
        .eq('id', job.id);

      await supabaseAdmin.from('email_deliveries').insert({
        job_id:              job.id,
        status:              'sent',
        provider_message_id: result.message_id,
        provider_response:   result.raw,
      });

      processed++;
    } else {
      const nextStatus = newAttemptCount >= job.max_attempts ? 'failed' : 'retrying';
      // Exponential backoff: 2^attempt minutes
      const backoffMinutes = Math.pow(2, newAttemptCount);
      const retryAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();

      await supabaseAdmin
        .from('email_jobs')
        .update({
          status:        nextStatus,
          scheduled_at:  nextStatus === 'retrying' ? retryAt : job.scheduled_at,
          attempt_count: newAttemptCount,
          last_error:    result.error,
          provider_response: result.raw,
        })
        .eq('id', job.id);

      await supabaseAdmin.from('email_deliveries').insert({
        job_id:           job.id,
        status:           'failed',
        provider_response: result.raw,
      });

      failed++;
    }
  }

  return { processed, failed };
}

// ---------------------------------------------------------------------------
// Direct (immediate) send — bypasses the job queue
// ---------------------------------------------------------------------------

/**
 * Send a single email immediately without persisting a job.
 * Used for test sends and ticket emails where the caller manages persistence.
 */
export async function sendEmailDirect(params: {
  to:      string;
  subject: string;
  html:    string;
  text:    string;
}): Promise<{ success: boolean; message_id: string | null; error: string | null }> {
  const result = await resendAdapter.send({
    to:      params.to,
    from:    FROM_EMAIL,
    subject: params.subject,
    html:    params.html,
    text:    params.text,
  });

  return {
    success:    result.success,
    message_id: result.message_id,
    error:      result.error,
  };
}

// ---------------------------------------------------------------------------
// Audit helper
// ---------------------------------------------------------------------------

export async function writeNotificationAudit(params: {
  action:      AuditAction;
  performedBy: string | null;
  entityType:  string;
  entityId:    string;
  metadata?:   Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from('notification_audit_log').insert({
    action:       params.action,
    performed_by: params.performedBy,
    entity_type:  params.entityType,
    entity_id:    params.entityId,
    metadata:     params.metadata ?? {},
  });
}

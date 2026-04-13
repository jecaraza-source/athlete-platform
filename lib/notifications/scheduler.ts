// =============================================================================
// lib/notifications/scheduler.ts
// Campaign scheduler: picks up due scheduled campaigns, enqueues their jobs,
// and handles recurrence. Called at the top of each cron handler before the
// job-level processor runs.
//
// Execution order per cron tick:
//   1. processScheduledEmailCampaigns()  — campaign → jobs
//   2. processPendingEmailJobs()         — jobs → provider send
// =============================================================================

import { supabaseAdmin }       from '@/lib/supabase-admin';
import { enqueueEmailCampaign } from './email-service';
import { enqueuePushCampaign }  from './push-service';
import type { EmailCampaign, PushCampaign, RecurrenceType } from './types';

// ---------------------------------------------------------------------------
// Recurrence helpers
// ---------------------------------------------------------------------------

/**
 * Given the current scheduled_at timestamp and the recurrence type,
 * return the ISO string for the next occurrence.
 * Returns null for 'none' (one-shot campaigns).
 */
export function calculateNextOccurrence(
  currentScheduledAt: string,
  recurrence:         RecurrenceType,
  recurrenceConfig:   Record<string, unknown> = {}
): string | null {
  if (recurrence === 'none') return null;

  const base = new Date(currentScheduledAt);

  // Use UTC methods throughout to stay timezone-independent
  switch (recurrence) {
    case 'daily':
      base.setUTCDate(base.getUTCDate() + 1);
      break;

    case 'weekly':
      base.setUTCDate(base.getUTCDate() + 7);
      break;

    case 'monthly':
      base.setUTCMonth(base.getUTCMonth() + 1);
      break;

    case 'custom': {
      // custom uses recurrence_config.interval_minutes
      const intervalMinutes = Number(recurrenceConfig.interval_minutes ?? 60);
      base.setTime(base.getTime() + intervalMinutes * 60_000);
      break;
    }

    default:
      return null;
  }

  return base.toISOString();
}

// ---------------------------------------------------------------------------
// Email campaign scheduler
// ---------------------------------------------------------------------------

/**
 * Find all email campaigns that are due (scheduled_at <= now, status = 'scheduled'),
 * enqueue their individual email_jobs, and handle recurrence.
 *
 * Returns counts of campaigns dispatched and any that failed.
 */
export async function processScheduledEmailCampaigns(): Promise<{
  dispatched: number;
  failed:     number;
  errors:     string[];
}> {
  const now = new Date().toISOString();
  let dispatched = 0;
  let failed     = 0;
  const errors: string[] = [];

  // Fetch all due scheduled campaigns (process up to 20 per tick)
  const { data: campaigns, error: fetchErr } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (fetchErr || !campaigns || campaigns.length === 0) {
    return { dispatched, failed, errors };
  }

  for (const campaign of campaigns as EmailCampaign[]) {
    // Mark as 'sending' immediately to prevent duplicate pickup on next tick
    await supabaseAdmin
      .from('email_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaign.id);

    const { enqueued, error: enqErr } = await enqueueEmailCampaign(campaign);

    if (enqErr) {
      // Roll back to 'scheduled' so it can be retried next tick
      await supabaseAdmin
        .from('email_campaigns')
        .update({ status: 'scheduled' })
        .eq('id', campaign.id);

      errors.push(`Campaign ${campaign.id}: ${enqErr}`);
      failed++;
      continue;
    }

    // Determine final status
    if (campaign.recurrence !== 'none') {
      // Recurring: calculate next occurrence and keep as scheduled
      const nextRun = calculateNextOccurrence(
        campaign.scheduled_at!,
        campaign.recurrence,
        campaign.recurrence_config ?? {}
      );

      if (nextRun) {
        await supabaseAdmin
          .from('email_campaigns')
          .update({
            status:       'scheduled',
            scheduled_at: nextRun,
            sent_at:      now,
          })
          .eq('id', campaign.id);
      } else {
        // recurrence resolved to null (shouldn't happen but handle safely)
        await supabaseAdmin
          .from('email_campaigns')
          .update({ status: 'sent', sent_at: now })
          .eq('id', campaign.id);
      }
    } else {
      // One-shot: mark sent
      await supabaseAdmin
        .from('email_campaigns')
        .update({ status: 'sent', sent_at: now })
        .eq('id', campaign.id);
    }

    dispatched++;
  }

  return { dispatched, failed, errors };
}

// ---------------------------------------------------------------------------
// Push campaign scheduler
// ---------------------------------------------------------------------------

/**
 * Find all push campaigns that are due and enqueue their push_jobs.
 */
export async function processScheduledPushCampaigns(): Promise<{
  dispatched: number;
  failed:     number;
  errors:     string[];
}> {
  const now = new Date().toISOString();
  let dispatched = 0;
  let failed     = 0;
  const errors: string[] = [];

  const { data: campaigns, error: fetchErr } = await supabaseAdmin
    .from('push_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (fetchErr || !campaigns || campaigns.length === 0) {
    return { dispatched, failed, errors };
  }

  for (const campaign of campaigns as PushCampaign[]) {
    await supabaseAdmin
      .from('push_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaign.id);

    const { enqueued, error: enqErr } = await enqueuePushCampaign(campaign);

    if (enqErr) {
      await supabaseAdmin
        .from('push_campaigns')
        .update({ status: 'scheduled' })
        .eq('id', campaign.id);

      errors.push(`Campaign ${campaign.id}: ${enqErr}`);
      failed++;
      continue;
    }

    if (campaign.recurrence !== 'none') {
      const nextRun = calculateNextOccurrence(
        campaign.scheduled_at!,
        campaign.recurrence,
        campaign.recurrence_config ?? {}
      );

      await supabaseAdmin
        .from('push_campaigns')
        .update({
          status:       nextRun ? 'scheduled' : 'sent',
          scheduled_at: nextRun ?? campaign.scheduled_at,
          sent_at:      now,
        })
        .eq('id', campaign.id);
    } else {
      await supabaseAdmin
        .from('push_campaigns')
        .update({ status: 'sent', sent_at: now })
        .eq('id', campaign.id);
    }

    dispatched++;
  }

  return { dispatched, failed, errors };
}

// ---------------------------------------------------------------------------
// Scheduler health / metrics (used by admin dashboard)
// ---------------------------------------------------------------------------

export async function getSchedulerStatus() {
  const [emailScheduled, pushScheduled, emailFailing, pushFailing] = await Promise.all([
    supabaseAdmin
      .from('email_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'scheduled'),

    supabaseAdmin
      .from('push_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'scheduled'),

    supabaseAdmin
      .from('email_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed'),

    supabaseAdmin
      .from('push_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed'),
  ]);

  return {
    email_campaigns_scheduled: emailScheduled.count ?? 0,
    push_campaigns_scheduled:  pushScheduled.count  ?? 0,
    email_jobs_failed:         emailFailing.count   ?? 0,
    push_jobs_failed:          pushFailing.count    ?? 0,
  };
}

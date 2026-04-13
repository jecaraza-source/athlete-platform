// =============================================================================
// lib/notifications/push-service.ts
// Push notification campaign send service.
// Server-only — uses supabaseAdmin + OneSignal adapter.
// =============================================================================

import { supabaseAdmin }      from '@/lib/supabase-admin';
import { oneSignalAdapter }   from './providers/onesignal-adapter';
import { resolveAudience }    from './audience';
import { renderPushTemplate } from './template-utils';
import type { PushCampaign, PushJob } from './types';

const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

/**
 * Resolve the campaign's audience, look up their active device tokens,
 * and insert one push_job per device subscription.
 */
export async function enqueuePushCampaign(
  campaign: PushCampaign
): Promise<{ enqueued: number; error: string | null }> {
  if (!campaign.template_id) {
    return { enqueued: 0, error: 'Campaign has no template assigned.' };
  }

  const { data: template, error: tErr } = await supabaseAdmin
    .from('push_templates')
    .select('*')
    .eq('id', campaign.template_id)
    .single();

  if (tErr || !template) {
    return { enqueued: 0, error: 'Push template not found.' };
  }

  // Resolve recipients (email channel is irrelevant here; we filter by push prefs)
  const recipients = await resolveAudience({
    selection_mode:  campaign.selection_mode,
    audience_type:   campaign.audience_type,
    recipient_ids:   campaign.recipient_ids,
    audience_config: campaign.audience_config,
    channel:         'push',
  });

  if (recipients.length === 0) {
    return { enqueued: 0, error: null };
  }

  const profileIds   = recipients.map((r) => r.profile_id);
  const scheduledAt  = campaign.scheduled_at ?? new Date().toISOString();

  // Fetch active device tokens for the resolved profiles
  const { data: tokens, error: tokErr } = await supabaseAdmin
    .from('push_device_tokens')
    .select('id, profile_id, onesignal_player_id')
    .in('profile_id', profileIds)
    .eq('is_active', true)
    .not('onesignal_player_id', 'is', null);

  if (tokErr || !tokens || tokens.length === 0) {
    return { enqueued: 0, error: null };
  }

  // Build a profile → recipient map for variable rendering
  const recipientMap = new Map(recipients.map((r) => [r.profile_id, r]));

  const rows = tokens.map((tok) => {
    const r = recipientMap.get(tok.profile_id);
    const vars = {
      first_name: r?.first_name ?? '',
      last_name:  r?.last_name  ?? '',
      ...campaign.variable_overrides,
    };

    const { title, message } = renderPushTemplate(
      template.title,
      template.message,
      vars
    );

    return {
      campaign_id:          campaign.id,
      template_id:          template.id,
      recipient_profile_id: tok.profile_id,
      device_token_id:      tok.id,
      onesignal_player_id:  tok.onesignal_player_id,
      title,
      message,
      deep_link:            template.deep_link ?? null,
      extra_data:           template.extra_data ?? {},
      status:               'pending' as const,
      idempotency_key:      `push_campaign:${campaign.id}:token:${tok.id}`,
      scheduled_at:         scheduledAt,
    };
  });

  const { error: insErr } = await supabaseAdmin
    .from('push_jobs')
    .upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true });

  if (insErr) {
    return { enqueued: 0, error: insErr.message };
  }

  return { enqueued: rows.length, error: null };
}

// ---------------------------------------------------------------------------
// Process pending jobs (called by cron)
// ---------------------------------------------------------------------------

/**
 * Processes push jobs in batches, grouping by profile so one OneSignal
 * request can deliver to all a user's devices at once.
 */
export async function processPendingPushJobs(): Promise<{
  processed: number;
  failed:    number;
}> {
  const now = new Date().toISOString();

  const { data: jobs, error } = await supabaseAdmin
    .from('push_jobs')
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

  for (const job of jobs as PushJob[]) {
    if (!job.onesignal_player_id) {
      // No player ID — mark as failed immediately
      await supabaseAdmin
        .from('push_jobs')
        .update({ status: 'failed', last_error: 'No onesignal_player_id available.' })
        .eq('id', job.id);
      failed++;
      continue;
    }

    await supabaseAdmin
      .from('push_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id);

    const result = await oneSignalAdapter.send({
      player_ids:      [job.onesignal_player_id],
      title:           job.title,
      message:         job.message,
      deep_link:       job.deep_link ?? undefined,
      extra_data:      job.extra_data ?? {},
      idempotency_key: job.idempotency_key,
    });

    const newAttemptCount = job.attempt_count + 1;

    if (result.success) {
      await supabaseAdmin
        .from('push_jobs')
        .update({
          status:                   'sent',
          processed_at:             new Date().toISOString(),
          provider_notification_id: result.notification_id,
          provider_response:        result.raw,
          attempt_count:            newAttemptCount,
          last_error:               null,
        })
        .eq('id', job.id);

      await supabaseAdmin.from('push_deliveries').insert({
        job_id:                   job.id,
        status:                   'sent',
        provider_notification_id: result.notification_id,
        provider_response:        result.raw,
      });

      processed++;
    } else {
      const nextStatus     = newAttemptCount >= job.max_attempts ? 'failed' : 'retrying';
      const backoffMinutes = Math.pow(2, newAttemptCount);
      const retryAt        = new Date(Date.now() + backoffMinutes * 60_000).toISOString();

      // Mark invalid tokens so they get deactivated
      const isInvalidToken =
        result.error?.toLowerCase().includes('invalid') ||
        result.error?.toLowerCase().includes('not a subscriber');

      if (isInvalidToken && job.device_token_id) {
        await supabaseAdmin
          .from('push_device_tokens')
          .update({ is_active: false })
          .eq('id', job.device_token_id);
      }

      await supabaseAdmin
        .from('push_jobs')
        .update({
          status:           nextStatus,
          scheduled_at:     nextStatus === 'retrying' ? retryAt : job.scheduled_at,
          attempt_count:    newAttemptCount,
          last_error:       result.error,
          provider_response: result.raw,
        })
        .eq('id', job.id);

      await supabaseAdmin.from('push_deliveries').insert({
        job_id:            job.id,
        status:            isInvalidToken ? 'invalid_token' : 'failed',
        provider_response: result.raw,
      });

      failed++;
    }
  }

  return { processed, failed };
}

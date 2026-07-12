// =============================================================================
// lib/notifications/analytics.ts
// Query helpers for notification analytics — used by admin dashboards.
// Server-only.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// Email campaign analytics
// ---------------------------------------------------------------------------

export async function getEmailCampaignStats(campaignId?: string) {
  let query = supabaseAdmin
    .from('email_campaigns')
    .select('id, name, status, sent_at, created_at');

  if (campaignId) query = query.eq('id', campaignId);

  const { data: campaigns } = await query.order('created_at', { ascending: false }).limit(20);
  if (!campaigns) return [];

  const results = await Promise.all(
    campaigns.map(async (c) => {
      const { data: jobs } = await supabaseAdmin
        .from('email_jobs')
        .select('status')
        .eq('campaign_id', c.id);

      const counts = countStatuses(jobs ?? []);
      return { campaign_id: c.id, campaign_name: c.name, ...counts };
    })
  );

  return results;
}

export async function getEmailOverallStats() {
  const { data } = await supabaseAdmin
    .from('email_jobs')
    .select('status');

  return countStatuses(data ?? []);
}

// ---------------------------------------------------------------------------
// Push campaign analytics
// ---------------------------------------------------------------------------

export async function getPushCampaignStats(campaignId?: string) {
  let query = supabaseAdmin
    .from('push_campaigns')
    .select('id, name, status, sent_at, created_at');

  if (campaignId) query = query.eq('id', campaignId);

  const { data: campaigns } = await query.order('created_at', { ascending: false }).limit(20);
  if (!campaigns) return [];

  const results = await Promise.all(
    campaigns.map(async (c) => {
      const { data: jobs } = await supabaseAdmin
        .from('push_jobs')
        .select('status')
        .eq('campaign_id', c.id);

      const counts = countStatuses(jobs ?? []);
      return { campaign_id: c.id, campaign_name: c.name, ...counts };
    })
  );

  return results;
}

export async function getPushOverallStats() {
  const { data } = await supabaseAdmin
    .from('push_jobs')
    .select('status');

  return countStatuses(data ?? []);
}

export async function getActiveDeviceCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('push_device_tokens')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Ticket email analytics
// ---------------------------------------------------------------------------

export async function getTicketEmailStats(ticketId?: string) {
  let query = supabaseAdmin
    .from('ticket_email_jobs')
    .select('status, email_type, trigger_type');

  if (ticketId) query = query.eq('ticket_id', ticketId);

  const { data: jobs } = await query;
  if (!jobs) return { total: 0, sent: 0, failed: 0, by_type: {} };

  const byType: Record<string, number> = {};
  for (const job of jobs) {
    byType[job.email_type] = (byType[job.email_type] ?? 0) + 1;
  }

  const counts = countStatuses(jobs);

  return {
    total:   jobs.length,
    sent:    counts.sent,
    failed:  counts.failed,
    by_type: byType,
  };
}

export async function getTicketEmailHistory(ticketId: string) {
  const { data } = await supabaseAdmin
    .from('ticket_email_jobs')
    .select(`
      id, event_key, email_type, trigger_type, recipient_email,
      subject, status, scheduled_at, processed_at, created_at,
      triggered_by_profile:profiles!ticket_email_jobs_triggered_by_fkey(first_name, last_name),
      recipient_profile:profiles!ticket_email_jobs_recipient_profile_id_fkey(first_name, last_name),
      deliveries:ticket_email_deliveries(status, recorded_at)
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Audience breakdown
// ---------------------------------------------------------------------------

export async function getEmailAudienceBreakdown() {
  const { data: jobs } = await supabaseAdmin
    .from('email_jobs')
    .select(`
      recipient_profile_id,
      profile:profiles!email_jobs_recipient_profile_id_fkey(role)
    `);

  let athletes = 0;
  let staff    = 0;

  for (const job of jobs ?? []) {
    const profile = Array.isArray(job.profile) ? job.profile[0] : job.profile;
    if ((profile as { role: string } | null)?.role === 'athlete') {
      athletes++;
    } else {
      staff++;
    }
  }

  return { athletes, staff };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type JobRow = { status: string };

function countStatuses(jobs: JobRow[]) {
  const counts = {
    total_jobs: jobs.length,
    pending:    0,
    sent:       0,
    failed:     0,
    retrying:   0,
    delivered:  0,
    bounced:    0,
    opened:     0,
    clicked:    0,
    invalid_token: 0,
  };

  for (const j of jobs) {
    const s = j.status as keyof typeof counts;
    if (s in counts) (counts as Record<string, number>)[s]++;
  }

  return counts;
}

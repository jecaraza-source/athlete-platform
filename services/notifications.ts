import { supabase } from '@/lib/supabase';
import type { PushJob } from '@/types';

export type NotifyOptions = {
  notifyPush:     boolean;
  notifyEmail:    boolean;
  entityType:     'event' | 'ticket' | 'training';
  entityId:       string;
  /** Push notification title */
  pushTitle:      string;
  /** Push notification body */
  pushMessage:    string;
  emailSubject:   string;
  emailHtmlBody:  string;
  emailPlainBody: string;
};

/**
 * Queue push_jobs and/or email_jobs for a set of profile IDs.
 * Throws on failure — callers should wrap in try/catch.
 * Requires migration 026 (staff INSERT policies on push_jobs / email_jobs).
 *
 * Push jobs use status='sent' so recipients see them immediately in the
 * in-app notification bell without waiting for the background processor.
 * Email jobs use status='pending' so the web-server dispatcher sends them.
 */
export async function notifyProfiles(
  profileIds: string[],
  opts: NotifyOptions,
): Promise<void> {
  if (!profileIds.length || (!opts.notifyPush && !opts.notifyEmail)) return;

  const base = `mobile-${opts.entityType}-${opts.entityId}`;
  const ts   = Date.now();

  // ── Push notifications ─────────────────────────────────────────────────
  if (opts.notifyPush) {
    const pushRows = profileIds.map((pid, i) => ({
      recipient_profile_id: pid,
      title:                opts.pushTitle,
      message:              opts.pushMessage,
      idempotency_key:      `${base}-push-${pid}-${ts}-${i}`,
      // 'sent' = immediately visible in the in-app notification bell.
      // The OS-level push is handled separately by the web server worker.
      status:               'sent',
      // Pre-set read_at to null so the unread badge counts this job.
      read_at:              null,
    }));
    const { error } = await supabase.from('push_jobs').insert(pushRows);
    if (error) throw new Error(`push: ${error.message}`);
  }

  // ── Email notifications ─────────────────────────────────────────────────
  if (opts.notifyEmail) {
    // Fetch emails for all recipients in one query
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', profileIds);
    if (profilesErr) throw new Error(`email lookup: ${profilesErr.message}`);

    const withEmail = (profiles ?? []).filter(
      (p): p is { id: string; email: string } => !!p.email,
    );

    if (withEmail.length > 0) {
      const emailRows = withEmail.map((p, i) => ({
        recipient_profile_id: p.id,
        recipient_email:      p.email,
        subject:              opts.emailSubject,
        html_body:            opts.emailHtmlBody,
        plain_body:           opts.emailPlainBody,
        idempotency_key:      `${base}-email-${p.id}-${ts}-${i}`,
        status:               'pending',
      }));
      const { error } = await supabase.from('email_jobs').insert(emailRows);
      if (error) throw new Error(`email: ${error.message}`);
    }
  }
}

/** List push notifications sent to a profile, most recent first. */
export async function listPushNotifications(profileId: string, limit = 50): Promise<PushJob[]> {
  const { data, error } = await supabase
    .from('push_jobs')
    .select('*')
    .eq('recipient_profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PushJob[];
}

/**
 * Count unread notifications (status='sent' AND read_at IS NULL).
 * This drives the badge counter on the Alertas tab.
 */
export async function countPendingNotifications(profileId: string): Promise<number> {
  const { count } = await supabase
    .from('push_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_profile_id', profileId)
    .eq('status', 'sent')
    .is('read_at', null);
  return count ?? 0;
}

/**
 * Mark all unread notifications as read for a profile.
 * Sets read_at = now() on every row where read_at IS NULL.
 * Returns true on success, false on error.
 */
export async function markAllNotificationsAsRead(profileId: string): Promise<boolean> {
  const { error } = await supabase
    .from('push_jobs')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_profile_id', profileId)
    .is('read_at', null);
  if (error) {
    console.warn('[notifications] markAllAsRead error:', error.message);
    return false;
  }
  return true;
}

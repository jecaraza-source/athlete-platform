import { supabase } from '@/lib/supabase';
import type { PushJob } from '@/types';

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

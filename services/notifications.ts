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

/** Count unread/unprocessed notifications. */
export async function countPendingNotifications(profileId: string): Promise<number> {
  const { count } = await supabase
    .from('push_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_profile_id', profileId)
    .eq('status', 'sent');
  return count ?? 0;
}

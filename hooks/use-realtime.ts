/**
 * use-realtime.ts
 *
 * Generic Supabase Realtime hooks for mobile.
 *
 * Requirements:
 *  - The tables must be added to the supabase_realtime publication
 *    (done in migration 025_mobile_write_policies.sql).
 *  - Realtime only works in production builds and custom dev clients.
 *    In Expo Go the websocket connection is established but events may
 *    not fire if the RLS filter uses auth.uid() — this is a known Expo Go
 *    limitation. Use a development build for full realtime testing.
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

// ---------------------------------------------------------------------------
// useRealtimeTable
// ---------------------------------------------------------------------------
/**
 * Subscribes to postgres_changes on a given table and calls `onEvent`
 * whenever a matching change fires.
 *
 * @param table      - Supabase table name (e.g. 'tickets')
 * @param event      - Postgres event to listen for (default '*')
 * @param filter     - Optional row filter, e.g. 'status=eq.open'
 * @param onEvent    - Callback fired on every matching change
 * @param channelSuffix - Optional suffix to make channel names unique
 *
 * @example
 * useRealtimeTable('tickets', '*', undefined, () => reload());
 */
export function useRealtimeTable(
  table:   string,
  event:   RealtimeEvent = '*',
  filter:  string | undefined,
  onEvent: () => void,
  channelSuffix = '',
) {
  // Stable ref so the effect doesn't re-subscribe on every render
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const channelName = `rt_${table}${channelSuffix ? `_${channelSuffix}` : ''}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        () => onEventRef.current(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // Re-subscribe only when table/event/filter/suffix change (not onEvent)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, event, filter, channelSuffix]);
}

// ---------------------------------------------------------------------------
// useRealtimeTickets
// ---------------------------------------------------------------------------
/**
 * Calls `onRefresh` whenever any ticket row is inserted, updated, or deleted.
 * Used in the tickets list screen to auto-refresh without polling.
 */
export function useRealtimeTickets(onRefresh: () => void) {
  useRealtimeTable('tickets', '*', undefined, onRefresh, 'list');
}

// ---------------------------------------------------------------------------
// useRealtimeNotificationBadge
// ---------------------------------------------------------------------------
/**
 * Calls `onNewNotification` whenever a push_job row addressed to the current
 * user is inserted. Used in the tab bar to increment the badge count.
 */
export function useRealtimeNotificationBadge(onNewNotification: () => void) {
  const profileId = useAuthStore((s) => s.profile?.id);

  const filter = profileId
    ? `recipient_profile_id=eq.${profileId}`
    : undefined;

  // Only subscribe when we have a profile
  const stableCallback = useCallback(onNewNotification, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profileId) return;

    const channelName = `rt_push_jobs_${profileId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'push_jobs',
          filter,
        },
        () => stableCallback(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);
}

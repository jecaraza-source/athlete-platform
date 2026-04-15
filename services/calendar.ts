import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventParticipant = {
  first_name: string;
  last_name:  string;
};

export type CalendarEvent = {
  id:                    string;
  title:                 string;
  event_type:            string;
  sport_id:              string | null;
  start_at:              string;
  end_at:                string | null;
  status:                string;
  description:           string | null;
  created_by_profile_id: string | null;
  /** Athletes assigned to this event (populated for staff view). */
  participants:          EventParticipant[];
};

const FIELDS =
  'id, title, event_type, sport_id, start_at, end_at, status, description, created_by_profile_id';

/**
 * Returns the total count of events in a date range.
 * Useful for debugging — confirms whether ANY events exist in the range.
 */
export async function countEventsInRange(
  startISO: string,
  endISO: string,
): Promise<number> {
  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .gte('start_at', startISO)
    .lte('start_at', endISO);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch all events in a date range for staff/coaches/admins.
 * Simple query without nested joins for maximum compatibility.
 * Participants are fetched separately after events load.
 */
export async function listEventsInRange(
  startISO: string,
  endISO: string,
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(FIELDS)
    .gte('start_at', startISO)
    .lte('start_at', endISO)
    .order('start_at', { ascending: true });

  if (error) {
    console.warn('[calendar] listEventsInRange error:', error.message);
    return [];
  }

  // Map to CalendarEvent with empty participants array.
  // Participant names are fetched separately when needed.
  return (data ?? []).map((ev) => ({
    ...(ev as Omit<CalendarEvent, 'participants'>),
    participants: [],
  }));
}

/**
 * Fetch events where a specific athlete is a participant.
 * Two-step: get event IDs from event_participants, then fetch those events.
 */
export async function listEventsForAthlete(
  athleteId: string,
  startISO: string,
  endISO: string,
): Promise<CalendarEvent[]> {
  // Step 1 — get the event IDs this athlete is linked to
  const { data: parts, error: partErr } = await supabase
    .from('event_participants')
    .select('event_id')
    .eq('participant_id', athleteId);

  if (partErr) {
    console.warn('[calendar] listEventsForAthlete (step1) error:', partErr.message);
    return [];
  }
  if (!parts || parts.length === 0) {
    console.warn('[calendar] No event_participants found for athleteId:', athleteId);
    return [];
  }

  const eventIds = parts.map((p) => (p as { event_id: string }).event_id);
  console.warn('[calendar] athlete event IDs:', eventIds.length);

  // Step 2 — fetch those events within the requested month range
  const { data, error } = await supabase
    .from('events')
    .select(FIELDS)
    .in('id', eventIds)
    .gte('start_at', startISO)
    .lte('start_at', endISO)
    .order('start_at', { ascending: true });

  if (error) {
    console.warn('[calendar] listEventsForAthlete (step2) error:', error.message);
    return [];
  }
  return (data ?? []).map((ev) => ({
    ...(ev as Omit<CalendarEvent, 'participants'>),
    participants: [],
  }));
}

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
 * Fetch events visible to a specific athlete.
 *
 * An athlete sees an event if:
 *  (a) they are explicitly listed as a participant in event_participants, OR
 *  (b) the event has NO participants at all (global / public event).
 *
 * Strategy:
 *  1. Fetch all events in the date range.
 *  2. Fetch all event_participants rows for those events.
 *  3. Filter client-side using the two rules above.
 */
export async function listEventsForAthlete(
  athleteId: string,
  startISO: string,
  endISO: string,
): Promise<CalendarEvent[]> {
  // Step 1 — all events in the month range
  const { data: allEvents, error: eventsErr } = await supabase
    .from('events')
    .select(FIELDS)
    .gte('start_at', startISO)
    .lte('start_at', endISO)
    .order('start_at', { ascending: true });

  if (eventsErr || !allEvents || allEvents.length === 0) return [];

  const eventIds = allEvents.map((e) => (e as { id: string }).id);

  // Step 2 — participant records for all these events
  const { data: parts } = await supabase
    .from('event_participants')
    .select('event_id, participant_id')
    .in('event_id', eventIds);

  const participants = (parts ?? []) as { event_id: string; participant_id: string }[];

  // Set of event IDs that have at least one participant assigned
  const eventsWithParticipants = new Set(participants.map((p) => p.event_id));
  // Set of event IDs where THIS athlete is explicitly a participant
  const athleteEventIds = new Set(
    participants
      .filter((p) => p.participant_id === athleteId)
      .map((p) => p.event_id),
  );

  // Step 3 — include event if athlete is a participant OR event is global (no participants)
  const visible = allEvents.filter((ev) => {
    const id = (ev as { id: string }).id;
    return eventsWithParticipants.has(id)
      ? athleteEventIds.has(id)   // has participants → only if athlete is one of them
      : true;                      // no participants  → global event, always visible
  });

  return visible.map((ev) => ({
    ...(ev as Omit<CalendarEvent, 'participants'>),
    participants: [],
  }));
}

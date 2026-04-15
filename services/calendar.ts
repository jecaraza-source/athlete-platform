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

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch all events in a date range for staff/coaches.
 * Includes the list of assigned athletes per event.
 */
export async function listEventsInRange(
  startISO: string,
  endISO: string,
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      ${FIELDS},
      event_participants(
        athletes(first_name, last_name)
      )
    `)
    .gte('start_at', startISO)
    .lte('start_at', endISO)
    .order('start_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    // Supabase returns joined relations as arrays even for belongs-to.
    const rawParts = (row.event_participants ?? []) as { athletes: EventParticipant[] | null }[];
    const participants: EventParticipant[] = rawParts
      .flatMap((p) => p.athletes ?? [])
      .filter((a): a is EventParticipant => a != null);
    const { event_participants: _ep, ...ev } = row;
    return { ...(ev as Omit<CalendarEvent, 'participants'>), participants };
  });
}

/**
 * Fetch events where a specific athlete is a participant.
 * Two-step approach: first get the event IDs from event_participants,
 * then fetch those events in the requested date range.
 * The athlete_id is athletes.id (not profile_id).
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

  if (partErr) throw partErr;
  if (!parts || parts.length === 0) return [];

  const eventIds = parts.map((p) => (p as { event_id: string }).event_id);

  // Step 2 — fetch those events within the requested month range
  const { data, error } = await supabase
    .from('events')
    .select(FIELDS)
    .in('id', eventIds)
    .gte('start_at', startISO)
    .lte('start_at', endISO)
    .order('start_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((ev) => ({ ...(ev as Omit<CalendarEvent, 'participants'>), participants: [] }));
}

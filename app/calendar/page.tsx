import BackButton from '@/components/back-button';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/rbac/server';
import MonthCalendar from './month-calendar';
import EditEventCard from './edit-event-card';

export const dynamic = 'force-dynamic';

type EventRow = {
  id: string;
  title: string;
  event_type: string;
  start_at: string;
  end_at: string;
  status: string;
  description: string | null;
};

export default async function CalendarPage() {
  await requirePermission('view_calendar');

  const [
    { data, error },
    { data: profilesData },
    { data: athletesData },
    { data: participantsData },
  ] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select('id, title, event_type, start_at, end_at, status, description')
      .order('start_at', { ascending: true }),
    supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .order('last_name', { ascending: true }),
    supabaseAdmin
      .from('athletes')
      .select('id, first_name, last_name')
      .order('last_name', { ascending: true }),
    supabaseAdmin
      .from('event_participants')
      .select('event_id, participant_id'),
  ]);

  const events      = (data             ?? []) as EventRow[];
  const profiles    = (profilesData     ?? []) as { id: string; first_name: string; last_name: string }[];
  const athletes    = (athletesData     ?? []) as { id: string; first_name: string; last_name: string }[];
  const participants = (participantsData ?? []) as { event_id: string; participant_id: string }[];

  // Build a map: event_id → athletes who are participants
  const athleteById = Object.fromEntries(athletes.map((a) => [a.id, a]));
  const participantsByEvent: Record<string, { id: string; first_name: string; last_name: string }[]> = {};
  for (const p of participants) {
    const athlete = athleteById[p.participant_id];
    if (athlete) {
      (participantsByEvent[p.event_id] ??= []).push(athlete);
    }
  }

  return (
    <main className="p-8">
      <BackButton href="/dashboard" label="Back to Dashboard" />
      <h1 className="text-3xl font-bold mt-4 mb-6 text-sky-700">Calendar</h1>

      <MonthCalendar
        events={events}
        profiles={profiles}
        athletes={athletes}
        participants={participants}
      />

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          Error loading events: {error.message}
        </div>
      )}

      {!error && events.length === 0 && (
        <div className="rounded border border-gray-200 p-4 text-gray-600">
          No events found yet.
        </div>
      )}

      <div className="space-y-3">
        {events.map((event) => (
          <EditEventCard
            key={event.id}
            event={event}
            eventParticipants={participantsByEvent[event.id] ?? []}
          />
        ))}
      </div>
    </main>
  );
}
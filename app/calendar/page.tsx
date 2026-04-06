import Link from 'next/link';
import BackButton from '@/components/back-button';
import { supabaseAdmin } from '@/lib/supabase-admin';
import MonthCalendar from './month-calendar';
import EventStatusSelect from './event-status-select';

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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export default async function CalendarPage() {
  const [{ data, error }, { data: profilesData }] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select('id, title, event_type, start_at, end_at, status, description')
      .order('start_at', { ascending: true }),
    supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .order('last_name', { ascending: true }),
  ]);

  const events = (data ?? []) as EventRow[];
  const profiles = (profilesData ?? []) as { id: string; first_name: string; last_name: string }[];

  return (
    <main className="p-8">
      <BackButton href="/dashboard" label="Back to Dashboard" />
      <h1 className="text-3xl font-bold mt-4 mb-6">Calendar</h1>

      <MonthCalendar events={events} profiles={profiles} />

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

      <div className="space-y-4">
        {events.map((event) => (
          <div
            key={event.id}
            className="rounded-lg border border-gray-200 p-5"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{event.title}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Type: {event.event_type}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 capitalize">{event.status}</span>
                <EventStatusSelect eventId={event.id} currentStatus={event.status} />
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-700 space-y-1">
              <p><span className="font-medium">Start:</span> {formatDateTime(event.start_at)}</p>
              <p><span className="font-medium">End:</span> {formatDateTime(event.end_at)}</p>
              <p><span className="font-medium">Description:</span> {event.description ?? 'N/A'}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
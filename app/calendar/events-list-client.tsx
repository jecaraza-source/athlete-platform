'use client';

import { useMemo, useState } from 'react';
import EditEventCard from './edit-event-card';

type Athlete = { id: string; first_name: string; last_name: string };

type EventRow = {
  id: string;
  title: string;
  event_type: string;
  start_at: string;
  end_at: string;
  status: string;
  description: string | null;
};

export default function EventsListClient({
  events,
  athletes,
  participantsByEvent,
}: {
  events: EventRow[];
  athletes: Athlete[];
  participantsByEvent: Record<string, Athlete[]>;
}) {
  const [selectedAthleteId, setSelectedAthleteId] = useState('');

  const filtered = useMemo(() => {
    if (!selectedAthleteId) return events;
    return events.filter((e) =>
      (participantsByEvent[e.id] ?? []).some((a) => a.id === selectedAthleteId)
    );
  }, [events, participantsByEvent, selectedAthleteId]);

  return (
    <div>
      {/* Filter bar */}
      {athletes.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium text-gray-700 shrink-0">
            Filter by athlete
          </label>
          <select
            value={selectedAthleteId}
            onChange={(e) => setSelectedAthleteId(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">All events</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.first_name} {a.last_name}
              </option>
            ))}
          </select>

          {selectedAthleteId && (
            <button
              onClick={() => setSelectedAthleteId('')}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}

          <span className="text-xs text-gray-400">
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
            {selectedAthleteId ? ` for ${athletes.find(a => a.id === selectedAthleteId)?.first_name}` : ''}
          </span>
        </div>
      )}

      {/* Event list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-8 text-center text-sm text-gray-400">
          {selectedAthleteId ? 'No events found for this athlete.' : 'No events yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((event) => (
          <EditEventCard
              key={event.id}
              event={event}
              eventParticipants={participantsByEvent[event.id] ?? []}
              athletes={athletes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import EditEventCard from './edit-event-card';

type Athlete = { id: string; first_name: string; last_name: string };
type Sport   = { id: string; name: string; category_type: string };

type EventRow = {
  id: string;
  title: string;
  event_type: string;
  sport_id: string | null;
  sport_name: string | null;
  start_at: string;
  end_at: string;
  status: string;
  description: string | null;
};

export default function EventsListClient({
  events,
  athletes,
  participantsByEvent,
  sports = [],
}: {
  events: EventRow[];
  athletes: Athlete[];
  participantsByEvent: Record<string, Athlete[]>;
  sports?: Sport[];
}) {
  const [selectedAthleteId, setSelectedAthleteId] = useState('');
  const [selectedSportId,   setSelectedSportId]   = useState('');

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchesAthlete = !selectedAthleteId ||
        (participantsByEvent[e.id] ?? []).some((a) => a.id === selectedAthleteId);
      const matchesSport = !selectedSportId || e.sport_id === selectedSportId;
      return matchesAthlete && matchesSport;
    });
  }, [events, participantsByEvent, selectedAthleteId, selectedSportId]);

  return (
    <div>
      {/* Filter bar */}
      {(athletes.length > 0 || sports.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Sport filter */}
          {sports.length > 0 && (
            <select
              value={selectedSportId}
              onChange={(e) => setSelectedSportId(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">All sports</option>
              {sports.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* Athlete filter */}
          {athletes.length > 0 && (
            <select
              value={selectedAthleteId}
              onChange={(e) => setSelectedAthleteId(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">All athletes</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name}
                </option>
              ))}
            </select>
          )}

          {(selectedAthleteId || selectedSportId) && (
            <button
              onClick={() => { setSelectedAthleteId(''); setSelectedSportId(''); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear filters
            </button>
          )}

          <span className="text-xs text-gray-400">
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
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
              sports={sports}
            />
          ))}
        </div>
      )}
    </div>
  );
}

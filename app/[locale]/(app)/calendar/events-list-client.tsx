'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import EditEventCard from './edit-event-card';

type Athlete = { id: string; first_name: string; last_name: string; discipline?: string | null };
type Sport   = { id: string; name: string; category_type: string };
type Discipline = { value: string; label: string };

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
  disciplines = [],
}: {
  events: EventRow[];
  athletes: Athlete[];
  participantsByEvent: Record<string, Athlete[]>;
  sports?: Sport[];
  disciplines?: Discipline[];
}) {
  const t = useTranslations('calendar');
  const [selectedAthleteId,  setSelectedAthleteId]  = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('');

  // Build a set of athlete IDs that belong to the selected discipline
  const disciplineAthleteIds = useMemo(() => {
    if (!selectedDiscipline) return null;
    return new Set(
      athletes
        .filter((a) => a.discipline === selectedDiscipline)
        .map((a) => a.id)
    );
  }, [athletes, selectedDiscipline]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const participants = participantsByEvent[e.id] ?? [];
      const matchesAthlete = !selectedAthleteId ||
        participants.some((a) => a.id === selectedAthleteId);
      // Discipline filter: event must have at least one participant in the selected discipline
      const matchesDiscipline = !disciplineAthleteIds ||
        participants.some((a) => disciplineAthleteIds.has(a.id));
      return matchesAthlete && matchesDiscipline;
    });
  }, [events, participantsByEvent, selectedAthleteId, disciplineAthleteIds]);

  // Derive discipline options from athletes actually present in events (avoid empty entries)
  const availableDisciplines = useMemo(() => {
    if (disciplines.length > 0) return disciplines;
    const used = new Set(athletes.map((a) => a.discipline).filter(Boolean));
    return Array.from(used).map((v) => ({ value: v as string, label: v as string }));
  }, [disciplines, athletes]);

  return (
    <div>
      {/* Filter bar */}
      {(athletes.length > 0 || availableDisciplines.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Discipline filter — filters by athlete discipline via participants */}
          {availableDisciplines.length > 0 && (
            <select
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">{t('allDisciplines')}</option>
              {availableDisciplines.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
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
              <option value="">{t('allAthletes')}</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name}
                </option>
              ))}
            </select>
          )}

          {(selectedAthleteId || selectedDiscipline) && (
            <button
              onClick={() => { setSelectedAthleteId(''); setSelectedDiscipline(''); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {t('clearFilters')}
            </button>
          )}

          <span className="text-xs text-gray-400">
            {t('eventsCount', { count: filtered.length })}
          </span>
        </div>
      )}

      {/* Event list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-8 text-center text-sm text-gray-400">
          {selectedAthleteId ? t('noEventsForAthlete') : t('noEventsYet')}
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

'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import EditEventCard from './edit-event-card';

type Athlete    = { id: string; first_name: string; last_name: string; discipline?: string | null };
type Sport      = { id: string; name: string; category_type: string };
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
  const t      = useTranslations('calendar');
  const locale = useLocale();

  const [selectedAthleteId,  setSelectedAthleteId]  = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('');
  const [selectedEventType,  setSelectedEventType]  = useState('');
  const [selectedMonth,      setSelectedMonth]      = useState('');

  // Translated label map — covers English canonical keys AND Spanish aliases
  // that may be stored in the DB from earlier data entry.
  const eventTypeLabels: Record<string, string> = {
    // English canonical keys
    training:      t('typeTraining'),
    competition:   t('typeCompetition'),
    meeting:       t('typeMeeting'),
    medical:       t('typeMedical'),
    physio:        t('typePhysio'),
    nutrition:     t('typeNutrition'),
    psychology:    t('typePsychology'),
    evaluation:    t('typeEvaluation'),
    other:         t('typeOther'),
    // Spanish aliases
    entrenamiento: t('typeTraining'),
    competencia:   t('typeCompetition'),
    reunion:       t('typeMeeting'),
    reunión:       t('typeMeeting'),
    medico:        t('typeMedical'),
    médico:        t('typeMedical'),
    fisioterapia:  t('typePhysio'),
    nutricion:     t('typeNutrition'),
    nutrición:     t('typeNutrition'),
    psicologia:    t('typePsychology'),
    psicología:    t('typePsychology'),
    evaluacion:    t('typeEvaluation'),
    evaluación:    t('typeEvaluation'),
    otro:          t('typeOther'),
  };

  // Months available in the dataset ("YYYY-MM")
  const availableMonths = useMemo(() => {
    const seen = new Set<string>();
    for (const e of events) seen.add(e.start_at.slice(0, 7));
    return Array.from(seen).sort();
  }, [events]);

  // Event types actually present in the dataset
  const availableEventTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const e of events) seen.add(e.event_type);
    return Array.from(seen).sort();
  }, [events]);

  // Athlete IDs belonging to the selected discipline
  const disciplineAthleteIds = useMemo(() => {
    if (!selectedDiscipline) return null;
    return new Set(
      athletes.filter((a) => a.discipline === selectedDiscipline).map((a) => a.id)
    );
  }, [athletes, selectedDiscipline]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const participants = participantsByEvent[e.id] ?? [];
      const matchesAthlete    = !selectedAthleteId   || participants.some((a) => a.id === selectedAthleteId);
      const matchesDiscipline = !disciplineAthleteIds || participants.some((a) => disciplineAthleteIds.has(a.id));
      const matchesEventType  = !selectedEventType   || e.event_type === selectedEventType;
      const matchesMonth      = !selectedMonth       || e.start_at.startsWith(selectedMonth);
      return matchesAthlete && matchesDiscipline && matchesEventType && matchesMonth;
    });
  }, [events, participantsByEvent, selectedAthleteId, disciplineAthleteIds, selectedEventType, selectedMonth]);

  // Discipline options derived from athletes in the dataset
  const availableDisciplines = useMemo(() => {
    if (disciplines.length > 0) return disciplines;
    const used = new Set(athletes.map((a) => a.discipline).filter(Boolean));
    return Array.from(used).map((v) => ({ value: v as string, label: v as string }));
  }, [disciplines, athletes]);

  const hasFilters = !!(selectedAthleteId || selectedDiscipline || selectedEventType || selectedMonth);

  function formatMonth(ym: string) {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }

  return (
    <div>
      {/* Filter bar — always visible so month/type filters are accessible */}
      <div className="flex flex-wrap items-center gap-3 mb-4">

        {/* Month filter */}
        {availableMonths.length > 1 && (
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">{t('allMonths')}</option>
            {availableMonths.map((ym) => (
              <option key={ym} value={ym}>{formatMonth(ym)}</option>
            ))}
          </select>
        )}

        {/* Event-type filter */}
        {availableEventTypes.length > 1 && (
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">{t('allEventTypes')}</option>
            {availableEventTypes.map((type) => (
              <option key={type} value={type}>
                {eventTypeLabels[type] ?? type}
              </option>
            ))}
          </select>
        )}

        {/* Discipline filter */}
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

        {hasFilters && (
          <button
            onClick={() => {
              setSelectedAthleteId('');
              setSelectedDiscipline('');
              setSelectedEventType('');
              setSelectedMonth('');
            }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {t('clearFilters')}
          </button>
        )}

        <span className="text-xs text-gray-400">
          {t('eventsCount', { count: filtered.length })}
        </span>
      </div>

      {/* Event list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-8 text-center text-sm text-gray-400">
          {hasFilters ? t('noEventsForFilter') : t('noEventsYet')}
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

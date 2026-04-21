'use client';

import { useState } from 'react';
import NewEventForm from './new-event-form';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CalendarEvent = {
  id: string;
  title: string;
  event_type: string;
  sport_id: string | null;
  start_at: string;
  end_at: string;
};

type Athlete     = { id: string; first_name: string; last_name: string; discipline?: string | null };
type Discipline  = { value: string; label: string };
type Participant = { event_id: string; participant_id: string };
type View        = 'day' | 'week' | 'month';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const DAY_START = 6;   // 6 am
const DAY_END   = 22;  // 10 pm
const HOUR_H    = 60;  // px per hour
const HOURS     = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => i + DAY_START);

const TYPE_COLORS: Record<string, string> = {
  training:    'bg-blue-500',
  match:       'bg-red-500',
  competition: 'bg-red-500',
  meeting:     'bg-yellow-500',
  medical:     'bg-green-500',
  other:       'bg-gray-400',
};

const LEGEND = [
  { label: 'Entrenamiento', color: 'bg-blue-500'   },
  { label: 'Competencia',   color: 'bg-red-500'    },
  { label: 'Reunión',       color: 'bg-yellow-500' },
  { label: 'Médico',        color: 'bg-green-500'  },
  { label: 'Evaluación / Otro', color: 'bg-gray-400' },
];

function eventColor(type: string) { return TYPE_COLORS[type.toLowerCase()] ?? 'bg-gray-400'; }

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatHour(h: number) {
  if (h === 0)  return '12 am';
  if (h < 12)   return `${h} am`;
  if (h === 12) return '12 pm';
  return `${h - 12} pm`;
}

function getWeekDates(year: number, month: number, day: number): Date[] {
  const dow = new Date(year, month, day).getDay();
  return Array.from({ length: 7 }, (_, i) => new Date(year, month, day - dow + i));
}

// ---------------------------------------------------------------------------
// Month view (existing grid)
// ---------------------------------------------------------------------------

function MonthView({ events, year, month }: { events: CalendarEvent[]; year: number; month: number }) {
  const today    = new Date();
  const todayKey = toDateKey(today);

  const byDate: Record<string, CalendarEvent[]> = {};
  for (const e of events) { (byDate[e.start_at.slice(0,10)] ??= []).push(e); }

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-md overflow-hidden">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="bg-white min-h-[72px]" />;
          const dk      = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const dayEvts = byDate[dk] ?? [];
          const isToday = dk === todayKey;
          return (
            <div key={dk} className={`bg-white min-h-[72px] p-1.5 ${isToday ? 'ring-2 ring-inset ring-sky-500' : ''}`}>
              <span className={`text-xs font-medium inline-flex h-5 w-5 items-center justify-center rounded-full ${isToday ? 'bg-sky-600 text-white' : 'text-gray-700'}`}>
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvts.slice(0,3).map((e) => (
                  <div key={e.id} className={`truncate text-white text-[10px] leading-4 px-1 rounded ${eventColor(e.event_type)}`} title={e.title}>{e.title}</div>
                ))}
                {dayEvts.length > 3 && <div className="text-[10px] text-gray-400 px-1">+{dayEvts.length - 3} más</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Time grid — shared by Day and Week views
// ---------------------------------------------------------------------------

function TimeGrid({ dates, events }: { dates: Date[]; events: CalendarEvent[] }) {
  const today    = new Date();
  const todayKey = toDateKey(today);
  const nowH     = today.getHours() + today.getMinutes() / 60;

  const byDate: Record<string, CalendarEvent[]> = {};
  for (const e of events) { (byDate[e.start_at.slice(0,10)] ??= []).push(e); }

  const cols     = dates.length;
  const gridCols = `56px repeat(${cols}, 1fr)`;

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      {/* Sticky day-header row */}
      <div className="sticky top-0 bg-white z-10 border-b border-gray-200 grid" style={{ gridTemplateColumns: gridCols }}>
        <div />
        {dates.map((date) => {
          const dk      = toDateKey(date);
          const isToday = dk === todayKey;
          return (
            <div key={dk} className={`py-2 text-center border-l border-gray-100 ${isToday ? 'bg-sky-50' : ''}`}>
              <p className="text-xs text-gray-400">{DAYS_SHORT[date.getDay()]}</p>
              <p className={`text-sm font-bold ${isToday ? 'text-sky-600' : 'text-gray-800'}`}>{date.getDate()}</p>
            </div>
          );
        })}
      </div>

      {/* Scrollable hour rows */}
      <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
        {HOURS.map((hour) => (
          <div key={hour} className="grid border-t border-gray-100" style={{ gridTemplateColumns: gridCols, height: HOUR_H }}>
            {/* Time label */}
            <div className="px-2 pt-0.5 text-[10px] text-gray-400 text-right select-none whitespace-nowrap">{formatHour(hour)}</div>

            {/* Column per day */}
            {dates.map((date) => {
              const dk      = toDateKey(date);
              const isToday = dk === todayKey;

              const hourEvts = (byDate[dk] ?? []).filter((e) => new Date(e.start_at).getHours() === hour);

              return (
                <div key={dk} className={`border-l border-gray-100 relative ${isToday ? 'bg-sky-50/30' : ''}`}>
                  {/* Now indicator */}
                  {isToday && Math.floor(nowH) === hour && (
                    <div className="absolute left-0 right-0 h-px bg-sky-500 z-10 pointer-events-none" style={{ top: (nowH - hour) * HOUR_H }}>
                      <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-sky-500" />
                    </div>
                  )}

                  {/* Events */}
                  {hourEvts.map((e) => {
                    const start    = new Date(e.start_at);
                    const end      = new Date(e.end_at);
                    const topPx    = (start.getMinutes() / 60) * HOUR_H;
                    const durMin   = Math.max((end.getTime() - start.getTime()) / 60000, 30);
                    const heightPx = Math.min((durMin / 60) * HOUR_H, HOUR_H * 6);
                    return (
                      <div
                        key={e.id}
                        className={`absolute left-0.5 right-0.5 rounded px-1 text-white overflow-hidden z-10 ${eventColor(e.event_type)}`}
                        style={{ top: topPx, height: Math.max(heightPx, 18) }}
                        title={`${e.title} — ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      >
                        <p className="text-[10px] font-semibold leading-tight truncate">{e.title}</p>
                        <p className="text-[9px] opacity-80">{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MonthCalendar({
  events,
  currentProfileId,
  athletes = [],
  participants = [],
  sports = [],
  disciplines = [],
}: {
  events: CalendarEvent[];
  currentProfileId: string;
  athletes?: Athlete[];
  participants?: Participant[];
  sports?: { id: string; name: string; category_type: string }[];
  disciplines?: readonly Discipline[];
}) {
  const today = new Date();
  const [view,               setView]             = useState<View>('month');
  const [year,               setYear]             = useState(today.getFullYear());
  const [month,              setMonth]            = useState(today.getMonth());
  const [day,                setDay]              = useState(today.getDate());
  const [selectedUserId,     setSelectedUserId]   = useState('');
  const [selectedSportId,    setSelectedSportId]  = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('');

  // Apply athlete filter
  const athleteFiltered = selectedUserId
    ? (() => {
        const allowed = new Set(
          participants
            .filter((p) => p.participant_id === selectedUserId)
            .map((p) => p.event_id)
        );
        return events.filter((e) => allowed.has(e.id));
      })()
    : events;

  // Apply sport (sport_id) filter
  const sportFiltered = selectedSportId
    ? athleteFiltered.filter((e) => e.sport_id === selectedSportId)
    : athleteFiltered;

  // Apply discipline filter — shows events where at least one participant
  // athlete belongs to the selected discipline
  const visibleEvents = selectedDiscipline
    ? (() => {
        const discAthletes = new Set(
          athletes
            .filter((a) => a.discipline === selectedDiscipline)
            .map((a) => a.id)
        );
        const allowed = new Set(
          participants
            .filter((p) => discAthletes.has(p.participant_id))
            .map((p) => p.event_id)
        );
        return sportFiltered.filter((e) => allowed.has(e.id));
      })()
    : sportFiltered;

  function prev() {
    const offsets: Record<View, number> = { day: -1, week: -7, month: 0 };
    if (view === 'month') {
      if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
    } else {
      const d = new Date(year, month, day + offsets[view]);
      setYear(d.getFullYear()); setMonth(d.getMonth()); setDay(d.getDate());
    }
  }

  function next() {
    const offsets: Record<View, number> = { day: 1, week: 7, month: 0 };
    if (view === 'month') {
      if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
    } else {
      const d = new Date(year, month, day + offsets[view]);
      setYear(d.getFullYear()); setMonth(d.getMonth()); setDay(d.getDate());
    }
  }

  function goToday() {
    setYear(today.getFullYear()); setMonth(today.getMonth()); setDay(today.getDate());
  }

  function periodLabel() {
    if (view === 'month') return `${MONTHS[month]} ${year}`;
    if (view === 'day')
      return new Date(year, month, day).toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    const wk = getWeekDates(year, month, day);
    const [first, last] = [wk[0], wk[6]];
    if (first.getMonth() === last.getMonth())
      return `${MONTHS[first.getMonth()]} ${first.getDate()}–${last.getDate()}, ${first.getFullYear()}`;
    return `${MONTHS[first.getMonth()]} ${first.getDate()} – ${MONTHS[last.getMonth()]} ${last.getDate()}, ${first.getFullYear()}`;
  }

  const VIEW_LABELS: Record<View, string> = { day: 'Día', week: 'Semana', month: 'Mes' };

  return (
    <div className="rounded-xl border border-gray-200 p-5 mb-8">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={prev} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors">←</button>
          <button onClick={goToday} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors">Hoy</button>
          <button onClick={next} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors">→</button>
          <h2 className="font-semibold text-sm text-gray-800 ml-1">{periodLabel()}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Discipline filter */}
          {disciplines.length > 0 && (
            <select
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">Todas las disciplinas</option>
              {disciplines.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          )}

          {/* Athlete filter */}
          {athletes.length > 0 && (
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">Todos los atletas</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name}
                </option>
              ))}
            </select>
          )}

          {/* View switcher */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === v ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          <NewEventForm currentProfileId={currentProfileId} athletes={athletes} sports={sports} />
        </div>
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 pb-3 border-b border-gray-100">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${item.color}`} />
            <span className="text-xs text-gray-500">{item.label}</span>
          </span>
        ))}
      </div>

      {/* Active view */}
      {view === 'month' && <MonthView events={visibleEvents} year={year} month={month} />}
      {view === 'week'  && <TimeGrid  dates={getWeekDates(year, month, day)} events={visibleEvents} />}
      {view === 'day'   && <TimeGrid  dates={[new Date(year, month, day)]}    events={visibleEvents} />}
    </div>
  );
}

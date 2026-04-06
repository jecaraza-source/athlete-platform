'use client';

import { useState } from 'react';
import NewEventForm from './new-event-form';

type CalendarEvent = {
  id: string;
  title: string;
  event_type: string;
  start_at: string;
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  training: 'bg-blue-500',
  match: 'bg-red-500',
  competition: 'bg-red-500',
  meeting: 'bg-yellow-500',
  medical: 'bg-green-500',
  other: 'bg-gray-400',
};

function eventColor(type: string) {
  return EVENT_TYPE_COLORS[type.toLowerCase()] ?? 'bg-gray-400';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Profile = { id: string; first_name: string; last_name: string };

export default function MonthCalendar({ events, profiles }: { events: CalendarEvent[]; profiles: Profile[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  // Map events by "YYYY-MM-DD" date string
  const byDate: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    const key = e.start_at.slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(e);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = today.toISOString().slice(0, 10);

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  // Build grid cells: leading empty cells + day cells
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-lg border border-gray-200 p-5 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
          >
            ←
          </button>
          <h2 className="font-semibold text-base">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={next}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
          >
            →
          </button>
        </div>
        <NewEventForm profiles={profiles} />
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-md overflow-hidden">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="bg-white min-h-[72px]" />;
          }
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEvents = byDate[dateKey] ?? [];
          const isToday = dateKey === todayKey;

          return (
            <div
              key={dateKey}
              className={`bg-white min-h-[72px] p-1.5 ${isToday ? 'ring-2 ring-inset ring-blue-500' : ''}`}
            >
              <span
                className={`text-xs font-medium inline-flex h-5 w-5 items-center justify-center rounded-full ${
                  isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                }`}
              >
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className={`truncate text-white text-[10px] leading-4 px-1 rounded ${eventColor(e.event_type)}`}
                    title={e.title}
                  >
                    {e.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-gray-500 px-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

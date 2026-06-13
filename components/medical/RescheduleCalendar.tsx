'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  fetchAvailableSlots,
  confirmReschedule,
  type SlotInfo,
} from '@/app/[locale]/(app)/medical/appointments/[eventId]/actions';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  eventId: string;
  specialistId: string;
  serviceType: string;
  athleteId: string;
  athleteProfileId: string | null;
  originalStartAt: string;
  originalEndAt: string;
  prefillNotes: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onCancel: () => void;
};

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const DAY_NAMES = ['Do','Lu','Ma','Mi','Ju','Vi','Sa'];

function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function buildCalendarGrid(year: number, month: number): (number | null)[][] {
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function originalDuration(startAt: string, endAt: string): number {
  return Math.max(
    30,
    Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000),
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RescheduleCalendar({
  eventId,
  specialistId,
  serviceType,
  athleteId,
  athleteProfileId,
  originalStartAt,
  originalEndAt,
  prefillNotes,
  onSuccess,
  onError,
  onCancel,
}: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots,        setSlots]        = useState<SlotInfo[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes,        setNotes]        = useState(prefillNotes);

  const [isPending, startTransition] = useTransition();

  // When prefillNotes changes externally (from NoShowForm), sync it
  useEffect(() => {
    setNotes(prefillNotes);
  }, [prefillNotes]);

  // Fetch available slots whenever a date is selected
  useEffect(() => {
    if (!selectedDate) return;
    setSlots([]);
    setSelectedSlot(null);
    setLoadingSlots(true);
    fetchAvailableSlots(specialistId, selectedDate)
      .then(({ slots: s }) => setSlots(s))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, specialistId]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  const grid = buildCalendarGrid(viewYear, viewMonth);
  const duration = originalDuration(originalStartAt, originalEndAt);

  function handleConfirm() {
    if (!selectedDate || !selectedSlot) return;
    const [hStr, mStr] = selectedSlot.split(':');
    const start = new Date(`${selectedDate}T${hStr}:${mStr}:00`);
    const end   = new Date(start.getTime() + duration * 60_000);

    startTransition(async () => {
      const result = await confirmReschedule(
        eventId,
        start.toISOString(),
        end.toISOString(),
        notes,
        athleteId,
        athleteProfileId,
        specialistId,
        serviceType,
      );
      if (result?.error) {
        onError(result.error);
      } else {
        onSuccess();
      }
    });
  }

  // Friendly summary
  const summaryDate = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-MX', {
        weekday: 'long',
        day:     'numeric',
        month:   'long',
        year:    'numeric',
      })
    : null;
  const summarySlot = slots.find((s) => s.time === selectedSlot);

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-5 transition-all duration-300">
      <h3 className="font-semibold text-amber-800">Seleccionar nueva fecha y hora</h3>

      {/* ── PASO 1: Calendario ────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Paso 1 · Elige una fecha
        </p>

        <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors text-sm"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-gray-800 capitalize">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors text-sm"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          {grid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day, di) => {
                if (!day) return <div key={di} />;

                const dateKey = toDateKey(viewYear, viewMonth, day);
                const cellDate = new Date(viewYear, viewMonth, day);
                const isPast   = cellDate < today;
                const isToday  = cellDate.getTime() === today.getTime();
                const isSelected = selectedDate === dateKey;

                return (
                  <button
                    key={di}
                    type="button"
                    disabled={isPast}
                    onClick={() => !isPast && setSelectedDate(dateKey)}
                    aria-pressed={isSelected}
                    aria-label={dateKey}
                    className={[
                      'h-9 w-full flex items-center justify-center rounded-lg text-sm transition-colors',
                      isPast
                        ? 'text-gray-300 cursor-not-allowed'
                        : isSelected
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : isToday
                            ? 'border-2 border-indigo-300 text-indigo-700 font-semibold hover:bg-indigo-50'
                            : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700',
                    ].join(' ')}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── PASO 2: Slots ──────────────────────────────────────────────── */}
      {selectedDate && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Paso 2 · Elige un horario disponible
          </p>

          {loadingSlots ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              Cargando horarios...
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-500 py-2 italic">
              No hay horarios disponibles para esta fecha.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={slot.taken}
                  onClick={() => !slot.taken && setSelectedSlot(slot.time)}
                  aria-pressed={selectedSlot === slot.time}
                  className={[
                    'h-10 rounded-lg text-sm font-medium transition-colors border',
                    slot.taken
                      ? 'border-gray-200 bg-gray-100 text-gray-400 line-through cursor-not-allowed'
                      : selectedSlot === slot.time
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-400 hover:text-indigo-700',
                  ].join(' ')}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PASO 3: Notas ──────────────────────────────────────────────── */}
      {selectedDate && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Paso 3 · Notas del reagendamiento (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Motivo del reagendamiento..."
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
          />
        </div>
      )}

      {/* ── Summary ────────────────────────────────────────────────────── */}
      {summaryDate && summarySlot && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          <span className="font-medium capitalize">{summaryDate}</span>
          {' · '}
          <span className="font-medium">{summarySlot.label}</span>
        </div>
      )}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedDate || !selectedSlot || isPending}
          aria-busy={isPending}
          className="flex-1 flex items-center justify-center gap-2 h-12 rounded-lg bg-amber-600 text-white font-semibold text-base hover:bg-amber-500 active:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Confirmando...
            </>
          ) : (
            '🔄 Confirmar reagendamiento'
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="sm:w-32 h-12 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

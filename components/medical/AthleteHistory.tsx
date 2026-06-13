'use client';

import { useState } from 'react';
import Link from 'next/link';

type HistoryRow = {
  id: string;
  start_at: string;
  status: string;
  event_type: string;
};

type Props = {
  athleteId: string;
  history: HistoryRow[];
  currentEventId: string;
};

const STATUS_LABEL: Record<string, string> = {
  show:        'Atendida',
  no_show:     'No asistió',
  rescheduled: 'Reagendada',
  scheduled:   'Programada',
  cancelled:   'Cancelada',
};

const STATUS_DOT: Record<string, string> = {
  show:        'bg-emerald-500',
  no_show:     'bg-red-500',
  rescheduled: 'bg-amber-500',
  scheduled:   'bg-blue-400',
  cancelled:   'bg-gray-400',
};

export default function AthleteHistory({ athleteId, history, currentEventId }: Props) {
  const [open, setOpen] = useState(false);

  const total      = history.length;
  const shows      = history.filter((h) => h.status === 'show').length;
  const attendRate = total > 0 ? Math.round((shows / total) * 100) : null;
  const lastEvent  = history[0] ?? null; // already sorted desc

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Accordion trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Historial del atleta</span>
          {attendRate !== null && (
            <span className="text-xs text-gray-500">
              · {total} cita{total !== 1 ? 's' : ''} · {attendRate}% asistencia
            </span>
          )}
        </div>
        <span className="text-gray-400 text-xs select-none">{open ? '▲' : '▼'}</span>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{total}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total citas</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{shows}</p>
              <p className="text-xs text-gray-500 mt-0.5">Atendidas</p>
            </div>
            {attendRate !== null && (
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-center col-span-2 sm:col-span-1">
                <p className="text-2xl font-bold text-indigo-600">{attendRate}%</p>
                <p className="text-xs text-gray-500 mt-0.5">Asistencia</p>
              </div>
            )}
          </div>

          {/* Last visit */}
          {lastEvent ? (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Última cita registrada
              </p>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[lastEvent.status] ?? 'bg-gray-400'}`} />
                <span>
                  {new Date(lastEvent.start_at).toLocaleDateString('es-MX', {
                    weekday: 'short',
                    day:     'numeric',
                    month:   'short',
                    year:    'numeric',
                  })}
                </span>
                <span className="text-gray-400">·</span>
                <span>{STATUS_LABEL[lastEvent.status] ?? lastEvent.status}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Sin citas anteriores registradas.</p>
          )}

          {/* Recent list */}
          {history.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Últimas {history.length} citas
              </p>
              <ul className="divide-y divide-gray-100">
                {history.slice(0, 5).map((h) => (
                  <li key={h.id} className="flex items-center gap-3 py-1.5 text-sm text-gray-600">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[h.status] ?? 'bg-gray-400'}`} />
                    <span className="flex-1">
                      {new Date(h.start_at).toLocaleDateString('es-MX', {
                        day:   'numeric',
                        month: 'short',
                        year:  'numeric',
                      })}
                    </span>
                    <span className="text-xs text-gray-400">{STATUS_LABEL[h.status] ?? h.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Link to full record */}
          <Link
            href={`/athletes/${athleteId}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            Ver expediente completo →
          </Link>
        </div>
      )}
    </div>
  );
}

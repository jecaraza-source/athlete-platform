'use client';

import { useState } from 'react';
import EditSessionForm from './edit-session-form';

export type MedicalSessionWithMeta = {
  id: string;
  session_date: string;
  created_at: string;
  treatment_summary: string | null;
  pain_score: number | null;
  health_score: number | null;
  weight_kg: number | null;
  blood_pressure: string | null;
  adherence_score: number | null;
  notes: string | null;
  next_session_date: string | null;
};

type SortKey =
  | 'date_desc'
  | 'date_asc'
  | 'pain_desc'
  | 'pain_asc'
  | 'health_desc'
  | 'adherence_desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date_desc',      label: 'Fecha (más reciente)' },
  { value: 'date_asc',       label: 'Fecha (más antigua)' },
  { value: 'pain_desc',      label: 'Mayor dolor' },
  { value: 'pain_asc',       label: 'Menor dolor' },
  { value: 'health_desc',    label: 'Mayor salud' },
  { value: 'adherence_desc', label: 'Mayor adherencia' },
];

const NEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_THRESHOLD_MS;
}

function sortSessions(
  sessions: MedicalSessionWithMeta[],
  key: SortKey,
): MedicalSessionWithMeta[] {
  const s = [...sessions];
  switch (key) {
    case 'date_desc':
      return s.sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
    case 'date_asc':
      return s.sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime());
    case 'pain_desc':
      return s.sort((a, b) => (b.pain_score ?? -1) - (a.pain_score ?? -1));
    case 'pain_asc':
      return s.sort((a, b) => (a.pain_score ?? 11) - (b.pain_score ?? 11));
    case 'health_desc':
      return s.sort((a, b) => (b.health_score ?? -1) - (a.health_score ?? -1));
    case 'adherence_desc':
      return s.sort((a, b) => (b.adherence_score ?? -1) - (a.adherence_score ?? -1));
  }
}

export default function SessionsList({
  sessions,
}: {
  sessions: MedicalSessionWithMeta[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');
  const sorted = sortSessions(sessions, sortKey);

  return (
    <div>
      {sessions.length > 1 && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500">Ordenar por</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {sorted.map((s) => (
          <div key={s.id} className="relative">
            {isNew(s.created_at) && (
              <span className="absolute -top-1.5 right-0 z-10 inline-flex items-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm leading-none">
                Nuevo
              </span>
            )}
            <EditSessionForm session={s} />
          </div>
        ))}
      </div>
    </div>
  );
}

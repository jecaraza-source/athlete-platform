'use client';

import { useState } from 'react';
import EditSessionForm from './edit-session-form';
import DeleteSessionButton from './delete-session-button';

type TrainingSession = {
  id: string;
  athlete_id: string;
  session_date: string;
  title: string;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  athletes: { first_name: string; last_name: string } | null;
};

export type SessionSlot = {
  session: TrainingSession;
  /** Pre-rendered server node (AttachmentsLoader output). */
  attachmentNode: React.ReactNode;
};

type SortKey = 'date_desc' | 'date_asc' | 'athlete_asc' | 'athlete_desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date_desc',    label: 'Fecha (más reciente)' },
  { value: 'date_asc',     label: 'Fecha (más antigua)' },
  { value: 'athlete_asc',  label: 'Atleta (A → Z)' },
  { value: 'athlete_desc', label: 'Atleta (Z → A)' },
];

function athleteName(s: TrainingSession): string {
  if (!s.athletes) return '';
  return `${s.athletes.last_name} ${s.athletes.first_name}`.toLowerCase();
}

function sortSlots(slots: SessionSlot[], key: SortKey): SessionSlot[] {
  const s = [...slots];
  switch (key) {
    case 'date_desc':
      return s.sort((a, b) =>
        new Date(b.session.session_date).getTime() - new Date(a.session.session_date).getTime()
      );
    case 'date_asc':
      return s.sort((a, b) =>
        new Date(a.session.session_date).getTime() - new Date(b.session.session_date).getTime()
      );
    case 'athlete_asc':
      return s.sort((a, b) => athleteName(a.session).localeCompare(athleteName(b.session), 'es'));
    case 'athlete_desc':
      return s.sort((a, b) => athleteName(b.session).localeCompare(athleteName(a.session), 'es'));
  }
}

export default function TrainingSessionsList({
  slots,
  sessionDetailsLabel,
  unknownAthlete,
}: {
  slots: SessionSlot[];
  sessionDetailsLabel: string;
  unknownAthlete: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');
  const sorted = sortSlots(slots, sortKey);

  if (slots.length === 0) return null;

  return (
    <div>
      {/* Sort control */}
      {slots.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
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

      <div className="space-y-4">
        {sorted.map(({ session, attachmentNode }) => (
          <div key={session.id} className="rounded-lg border border-gray-200 p-5">
            {/* Session header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{session.title}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {session.athletes
                    ? `${session.athletes.first_name} ${session.athletes.last_name}`
                    : unknownAthlete}
                </p>
              </div>
              <div className="text-sm text-gray-600">
                {new Date(session.session_date).toLocaleDateString()}
              </div>
            </div>

            {/* Inline edit form */}
            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                {sessionDetailsLabel}
              </p>
              <EditSessionForm session={session} />
              <div className="mt-2 flex justify-end">
                <DeleteSessionButton sessionId={session.id} />
              </div>
            </div>

            {/* Attachments — pre-rendered server node */}
            <div className="mt-4">{attachmentNode}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

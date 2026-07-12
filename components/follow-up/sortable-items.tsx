'use client';

import { useState } from 'react';

export type SortableItem = {
  id: string;
  /** ISO date string used for date-based sorting. */
  date: string;
  /** Full athlete name (used for athlete A→Z / Z→A sorting). */
  athleteName: string;
  /** Status value — open / in_progress / closed / active / paused / completed */
  status?: string;
  /** Pre-rendered server content for this item. */
  node: React.ReactNode;
};

type SortKey =
  | 'date_desc' | 'date_asc'
  | 'athlete_asc' | 'athlete_desc'
  | 'status_asc' | 'status_desc';

// Maps status strings to a numeric priority (lower = more active)
const STATUS_PRIORITY: Record<string, number> = {
  open: 0, active: 0,
  in_progress: 1, paused: 1,
  closed: 2, completed: 2,
};

function statusPriority(s?: string): number {
  return s ? (STATUS_PRIORITY[s] ?? 1) : 1;
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date_desc',    label: 'Fecha (más reciente)' },
  { value: 'date_asc',     label: 'Fecha (más antigua)' },
  { value: 'athlete_asc',  label: 'Atleta (A → Z)' },
  { value: 'athlete_desc', label: 'Atleta (Z → A)' },
  { value: 'status_asc',   label: 'Estado (abierto primero)' },
  { value: 'status_desc',  label: 'Estado (cerrado primero)' },
];

function sortItems(items: SortableItem[], key: SortKey): SortableItem[] {
  const s = [...items];
  switch (key) {
    case 'date_desc':
      return s.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    case 'date_asc':
      return s.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    case 'athlete_asc':
      return s.sort((a, b) => a.athleteName.localeCompare(b.athleteName, 'es'));
    case 'athlete_desc':
      return s.sort((a, b) => b.athleteName.localeCompare(a.athleteName, 'es'));
    case 'status_asc':
      return s.sort((a, b) => statusPriority(a.status) - statusPriority(b.status));
    case 'status_desc':
      return s.sort((a, b) => statusPriority(b.status) - statusPriority(a.status));
  }
}

export default function SortableItems({
  items,
  emptyNode,
}: {
  items: SortableItem[];
  /** Rendered when the list is empty (pass the existing empty-state JSX). */
  emptyNode?: React.ReactNode;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');

  if (items.length === 0) return <>{emptyNode ?? null}</>;

  const sorted = sortItems(items, sortKey);

  return (
    <div>
      {items.length > 1 && (
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
        {sorted.map(({ id, node }) => (
          <div key={id}>{node}</div>
        ))}
      </div>
    </div>
  );
}

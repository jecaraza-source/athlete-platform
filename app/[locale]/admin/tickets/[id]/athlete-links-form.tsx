'use client';

import { useState, useTransition } from 'react';
import { setTicketAthletes } from '../actions';
import type { AthleteOption } from '@/lib/tickets/types';

interface Props {
  ticketId: string;
  currentAthleteIds: string[];
  athletes: AthleteOption[];
}

export default function AthleteLinksForm({
  ticketId,
  currentAthleteIds,
  athletes,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentAthleteIds));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [query, setQuery]   = useState('');

  function toggle(athleteId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(athleteId) ? next.delete(athleteId) : next.add(athleteId);
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await setTicketAthletes(ticketId, [...selected]);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(null);
        setSaved(true);
      }
    });
  }

  const hasChanges =
    selected.size !== currentAthleteIds.length ||
    [...selected].some((id) => !currentAthleteIds.includes(id));

  const filtered = query.trim()
    ? athletes.filter((a) =>
        `${a.first_name} ${a.last_name} ${a.athlete_code ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : athletes;

  return (
    <div className="space-y-3">
      {athletes.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No active athletes found.</p>
      ) : (
        <>
          {/* Search filter */}
          <input
            type="text"
            placeholder="Search athletes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <ul className="max-h-52 overflow-y-auto space-y-1 rounded-md border border-gray-200 p-2">
            {filtered.length === 0 ? (
              <li className="px-2 py-1.5 text-xs text-gray-400 italic">No results.</li>
            ) : (
              filtered.map((a) => (
                <li key={a.id}>
                  <label className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-gray-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="font-medium text-gray-800">
                      {a.first_name} {a.last_name}
                    </span>
                    {a.athlete_code && (
                      <span className="text-xs text-gray-400 font-mono">{a.athlete_code}</span>
                    )}
                  </label>
                </li>
              ))
            )}
          </ul>
        </>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending || !hasChanges}
          className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-40 transition-colors"
        >
          {isPending ? 'Saving…' : 'Save Athletes'}
        </button>
        {selected.size > 0 && (
          <span className="text-xs text-gray-500">{selected.size} linked</span>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {saved && !isPending && !hasChanges && (
        <p className="text-xs text-green-600">Athletes saved.</p>
      )}
    </div>
  );
}

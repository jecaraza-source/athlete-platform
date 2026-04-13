'use client';

import { useState, useTransition } from 'react';
import { setTicketAssignees } from '../actions';
import type { ProfileSummary } from '@/lib/rbac/types';

interface Props {
  ticketId: string;
  currentAssigneeIds: string[];
  profiles: ProfileSummary[];
}

export default function AssignTicketForm({
  ticketId,
  currentAssigneeIds,
  profiles,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentAssigneeIds));
  const [isPending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [saved, setSaved]   = useState(false);

  function toggle(profileId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(profileId) ? next.delete(profileId) : next.add(profileId);
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await setTicketAssignees(ticketId, [...selected]);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(null);
        setSaved(true);
      }
    });
  }

  const hasChanges =
    selected.size !== currentAssigneeIds.length ||
    [...selected].some((id) => !currentAssigneeIds.includes(id));

  return (
    <div className="space-y-3">
      {profiles.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No staff profiles found.</p>
      ) : (
        <ul className="max-h-52 overflow-y-auto space-y-1 rounded-md border border-gray-200 p-2">
          {profiles.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-gray-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="rounded border-gray-300"
                />
                <span className="font-medium text-gray-800">
                  {p.first_name} {p.last_name}
                </span>
                {p.role && (
                  <span className="text-xs text-gray-400 capitalize">{p.role.replace(/_/g, ' ')}</span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending || !hasChanges}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {isPending ? 'Saving…' : 'Save Assignees'}
        </button>
        {selected.size > 0 && (
          <span className="text-xs text-gray-500">{selected.size} selected</span>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {saved && !isPending && !hasChanges && (
        <p className="text-xs text-green-600">Assignees saved.</p>
      )}
    </div>
  );
}

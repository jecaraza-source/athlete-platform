'use client';

import { useState, useTransition } from 'react';
import { updateTicketStatus } from '../actions';
import type { TicketStatus } from '@/lib/tickets/types';

const ALL_STATUSES: { value: TicketStatus; label: string }[] = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved' },
  { value: 'closed',      label: 'Closed' },
];

interface Props {
  ticketId: string;
  currentStatus: TicketStatus;
  /** When false, the Closed option is hidden. */
  canClose: boolean;
}

export default function ChangeStatusForm({ ticketId, currentStatus, canClose }: Props) {
  const [status, setStatus]   = useState<TicketStatus>(currentStatus);
  const [isPending, startTransition] = useTransition();
  const [error, setError]     = useState<string | null>(null);

  const statuses = canClose
    ? ALL_STATUSES
    : ALL_STATUSES.filter((s) => s.value !== 'closed');

  function handleChange(newStatus: TicketStatus) {
    if (newStatus === status) return;
    const previous = status;
    setStatus(newStatus);
    setError(null);
    startTransition(async () => {
      const result = await updateTicketStatus(ticketId, newStatus);
      if (result?.error) {
        setStatus(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {statuses.map((s) => {
          const active = s.value === status;
          return (
            <button
              key={s.value}
              onClick={() => handleChange(s.value)}
              disabled={isPending || active}
              className={`rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors ${
                active
                  ? 'border-blue-400 bg-blue-50 text-blue-700 cursor-default'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              } disabled:opacity-60`}
            >
              {s.label}
              {active && <span className="ml-1 text-blue-500">✓</span>}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

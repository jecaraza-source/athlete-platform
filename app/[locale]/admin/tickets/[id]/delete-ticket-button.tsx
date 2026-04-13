'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteTicket } from '../actions';

export default function DeleteTicketButton({ ticketId }: { ticketId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTicket(ticketId);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
      } else {
        router.push('/admin/tickets');
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Delete this ticket?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null); }}
          disabled={isPending}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
    >
      Delete ticket
    </button>
  );
}

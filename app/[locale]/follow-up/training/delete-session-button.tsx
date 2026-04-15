'use client';

import { useState, useTransition } from 'react';
import { deleteTrainingSession } from './actions';

export default function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const [confirming, setConfirming]  = useState(false);
  const [error, setError]            = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTrainingSession(sessionId);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  if (error) {
    return <span className="text-xs text-red-600">{error}</span>;
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-xs text-gray-600">Delete?</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {isPending ? 'Deleting…' : 'Yes'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-500 hover:underline"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs text-red-500 hover:underline"
    >
      Delete
    </button>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { deleteDiscipline } from './actions';

export default function DeleteDisciplineButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDiscipline(id);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  if (error) {
    return <span className="text-xs text-red-600">{error}</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-red-500 hover:text-red-700 hover:underline transition-colors"
      >
        Eliminar
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-gray-500">¿Eliminar "{name}"?</span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="font-semibold text-red-600 hover:underline disabled:opacity-50"
      >
        {isPending ? 'Eliminando…' : 'Sí'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-gray-400 hover:text-gray-600 hover:underline"
      >
        No
      </button>
    </span>
  );
}

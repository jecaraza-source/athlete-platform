'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteActivity } from '@/lib/bitacora/actions';

interface DeleteActivityButtonProps {
  activityId: string;
  title:      string;
}

export function DeleteActivityButton({ activityId, title }: DeleteActivityButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${title}"?\nSe eliminarán también sus fotos. No se puede deshacer.`)) return;
    setBusy(true);
    const result = await deleteActivity(activityId);
    setBusy(false);
    if (result.error) { alert(result.error); return; }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      title="Eliminar actividad"
      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 font-medium transition-colors"
    >
      {busy ? '…' : '🗑'}
    </button>
  );
}

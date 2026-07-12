'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteNarrative } from '@/lib/bitacora/actions';

interface DeleteArticleButtonProps {
  narrativeId: string;
  locale:      string;
}

export function DeleteArticleButton({ narrativeId, locale }: DeleteArticleButtonProps) {
  const router  = useRouter();
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm('¿Eliminar este artículo de la Revista? Se borrará la narrativa aprobada. No se puede deshacer.')) return;
    setBusy(true);
    setError(null);
    const result = await deleteNarrative(narrativeId);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    router.push(`/${locale}/revista`);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="inline-flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        {busy ? 'Eliminando…' : '🗑 Eliminar artículo'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

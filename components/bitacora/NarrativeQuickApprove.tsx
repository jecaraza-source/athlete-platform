'use client';
// =============================================================================
// NarrativeQuickApprove
// Botones inline de aprobar / rechazar para filas de la lista admin
// con narrativa en estado 'borrador'. Permite gestionar la aprobación
// sin entrar al formulario de edición completo.
// =============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveNarrative, rejectNarrative } from '@/lib/bitacora/actions';

interface Props {
  narrativeId: string;
}

export function NarrativeQuickApprove({ narrativeId }: Props) {
  const router  = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'approved' | 'rejected'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setState('loading');
    setError(null);
    const result = await approveNarrative(narrativeId);
    if (result.error) {
      setError(result.error);
      setState('idle');
      return;
    }
    setState('approved');
    router.refresh();
  }

  async function handleReject() {
    setState('loading');
    setError(null);
    const result = await rejectNarrative(narrativeId);
    if (result.error) {
      setError(result.error);
      setState('idle');
      return;
    }
    setState('rejected');
    router.refresh();
  }

  if (state === 'approved') {
    return <span className="text-xs font-semibold text-green-600">✓ Aprobada</span>;
  }
  if (state === 'rejected') {
    return <span className="text-xs font-semibold text-red-500">✕ Rechazada</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      {error && (
        <span className="text-xs text-red-500" title={error}>⚠</span>
      )}
      <button
        type="button"
        disabled={state === 'loading'}
        onClick={handleApprove}
        className="text-xs font-semibold text-green-700 hover:text-green-900 hover:underline disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {state === 'loading' ? '…' : '✓ Aprobar'}
      </button>
      <span className="text-gray-200">|</span>
      <button
        type="button"
        disabled={state === 'loading'}
        onClick={handleReject}
        className="text-xs font-medium text-red-400 hover:text-red-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { autosaveNotes, confirmShow } from '@/app/[locale]/(app)/medical/appointments/[eventId]/actions';

type Props = {
  eventId: string;
  initialNotes: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
};

type SaveStatus = 'idle' | 'saving' | 'saved';

export default function ShowForm({ eventId, initialNotes, onSuccess, onError }: Props) {
  const [notes, setNotes]           = useState(initialNotes);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave: 1.5 s after the user stops typing
  useEffect(() => {
    if (notes === initialNotes) return;

    setSaveStatus('saving');
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const result = await autosaveNotes(eventId, notes);
      setSaveStatus(result?.error ? 'idle' : 'saved');
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmShow(eventId, notes);
      if (result?.error) {
        onError(result.error);
      } else {
        onSuccess();
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-4 transition-all duration-300">
      <h3 className="font-semibold text-emerald-800">Notas de la consulta</h3>

      <div className="relative">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Escribe las observaciones de la consulta..."
          className="w-full rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
          style={{ minHeight: '120px' }}
        />

        {/* Autosave indicator */}
        <div className="absolute bottom-2 right-3 text-xs text-gray-400">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Guardando...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-emerald-600 font-medium">✓ Guardado</span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        aria-busy={isPending}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-lg bg-emerald-600 text-white font-semibold text-base hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Guardando...
          </>
        ) : (
          '✅ Confirmar asistencia y guardar notas'
        )}
      </button>
    </div>
  );
}

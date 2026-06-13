'use client';

import { useState, useTransition } from 'react';
import { confirmNoShow } from '@/app/[locale]/(app)/medical/appointments/[eventId]/actions';

type Props = {
  eventId: string;
  athleteProfileId: string | null;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onSwitchToReschedule: (prefillNote: string) => void;
};

const NO_SHOW_REASONS = [
  { value: 'no_notice',   label: 'Sin aviso previo' },
  { value: 'gave_notice', label: 'Avisó con anticipación' },
  { value: 'emergency',   label: 'Emergencia personal' },
  { value: 'other',       label: 'Otro motivo' },
];

export default function NoShowForm({
  eventId,
  athleteProfileId,
  onSuccess,
  onError,
  onSwitchToReschedule,
}: Props) {
  const [reason, setReason]       = useState('');
  const [notes, setNotes]         = useState('');
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmNoShow(eventId, reason, notes, athleteProfileId);
      if (result?.error) {
        onError(result.error);
      } else {
        onSuccess();
      }
    });
  }

  function handleReschedule() {
    const prefill = [
      reason ? `Motivo inasistencia: ${NO_SHOW_REASONS.find((r) => r.value === reason)?.label ?? reason}` : '',
      notes   ? `Notas: ${notes}` : '',
    ].filter(Boolean).join('\n');
    onSwitchToReschedule(prefill);
  }

  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5 space-y-5 transition-all duration-300">
      <h3 className="font-semibold text-red-800">Registro de inasistencia</h3>

      {/* Reason */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Motivo (opcional)</legend>
        <div className="space-y-2">
          {NO_SHOW_REASONS.map((r) => (
            <label
              key={r.value}
              className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700"
            >
              <input
                type="radio"
                name="no_show_reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="accent-red-600 w-4 h-4"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Additional notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notas adicionales
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Observaciones opcionales..."
          className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition"
        />
      </div>

      {/* Reschedule prompt */}
      <div className="rounded-lg border border-red-200 bg-white p-4 space-y-2">
        <p className="text-sm font-medium text-gray-700">¿Deseas proponer un reagendamiento?</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleReschedule}
            disabled={isPending}
            className="flex-1 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            Sí, abrir calendario →
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            aria-busy={isPending}
            className="flex-1 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                Registrando...
              </span>
            ) : (
              'No, solo registrar inasistencia'
            )}
          </button>
        </div>
      </div>

      {/* Main confirm button */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        aria-busy={isPending}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-lg bg-red-600 text-white font-semibold text-base hover:bg-red-500 active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Registrando...
          </>
        ) : (
          '❌ Confirmar No Show'
        )}
      </button>
    </div>
  );
}

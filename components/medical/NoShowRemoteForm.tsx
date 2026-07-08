'use client';

import { useState, useTransition } from 'react';
import { confirmNoShowRemote } from '@/app/[locale]/(app)/medical/appointments/[eventId]/actions';

type Props = {
  eventId: string;
  athleteProfileId: string | null;
  onSuccess: () => void;
  onError: (msg: string) => void;
};

const CONTACT_METHODS = [
  { value: 'llamada',  label: '📞 Llamada telefónica' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'mensaje',  label: '✉️ Mensaje de texto' },
  { value: 'otro',     label: 'Otro medio' },
];

export default function NoShowRemoteForm({
  eventId,
  athleteProfileId,
  onSuccess,
  onError,
}: Props) {
  const [method, setMethod] = useState('');
  const [notes, setNotes]   = useState('');
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!method) { onError('Selecciona el medio de contacto.'); return; }
    startTransition(async () => {
      const result = await confirmNoShowRemote(eventId, method, notes, athleteProfileId);
      if (result?.error) { onError(result.error); }
      else { onSuccess(); }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-5 space-y-5 transition-all duration-300">
      <h3 className="font-semibold text-orange-800">📞 No asistió — atendido de forma remota</h3>
      <p className="text-sm text-orange-700">
        El atleta no asistió presencialmente pero fue contactado vía llamada o mensaje.
      </p>

      {/* Método de contacto */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">
          Medio de contacto <span className="text-red-500">*</span>
        </legend>
        <div className="space-y-2">
          {CONTACT_METHODS.map((m) => (
            <label
              key={m.value}
              className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700"
            >
              <input
                type="radio"
                name="contact_method"
                value={m.value}
                checked={method === m.value}
                onChange={() => setMethod(m.value)}
                className="accent-orange-600 w-4 h-4"
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Notas de la consulta remota */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notas de la consulta remota
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Resumen de lo tratado en la llamada / mensaje..."
          className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
        />
      </div>

      {/* Confirmar */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        aria-busy={isPending}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-lg bg-orange-600 text-white font-semibold text-base hover:bg-orange-500 active:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Registrando...
          </>
        ) : (
          '📞 Confirmar atención remota'
        )}
      </button>
    </div>
  );
}

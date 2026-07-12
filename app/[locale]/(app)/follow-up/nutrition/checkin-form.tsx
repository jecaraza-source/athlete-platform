'use client';

import { useRef, useState, useTransition } from 'react';
import { createNutritionCheckin } from './actions';
import EditCheckinForm from './edit-checkin-form';

type Person = {
  id: string;
  first_name: string;
  last_name: string;
};

type NutritionCheckin = {
  id: string;
  checkin_date: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
  adherence_score: number | null;
  notes: string | null;
  next_actions: string | null;
};

export default function CheckinForm({
  athleteId,
  nutritionists,
  previousCheckins,
}: {
  athleteId: string;
  nutritionists: Person[];
  previousCheckins: NutritionCheckin[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createNutritionCheckin(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setOpen(false);
        formRef.current?.reset();
      }
    });
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Check-in history — always visible with edit buttons */}
      {previousCheckins.length > 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Historial de check-ins ({previousCheckins.length})
          </p>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {previousCheckins.map((c) => (
              <EditCheckinForm key={c.id} checkin={c} />
            ))}
          </div>
        </div>
      )}

      {/* New check-in toggle */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
        >
          + Nuevo check-in
        </button>
      ) : (
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <h3 className="font-semibold text-sm mb-3">Nuevo Check-in</h3>

          {error && (
            <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <form ref={formRef} action={handleSubmit} className="space-y-3">
            <input type="hidden" name="athlete_id" value={athleteId} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" htmlFor={`checkin_date_${athleteId}`}>
                  Fecha <span className="text-red-500">*</span>
                </label>
                <input
                  id={`checkin_date_${athleteId}`}
                  name="checkin_date"
                  type="date"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" htmlFor={`nutritionist_${athleteId}`}>
                  Nutricionista <span className="text-red-500">*</span>
                </label>
                <select
                  id={`nutritionist_${athleteId}`}
                  name="nutritionist_profile_id"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                >
                  <option value="">Seleccionar…</option>
                  {nutritionists.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.first_name} {n.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" htmlFor={`weight_${athleteId}`}>
                  Peso (kg)
                </label>
                <input
                  id={`weight_${athleteId}`}
                  name="weight_kg"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="ej. 72.5"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" htmlFor={`body_fat_${athleteId}`}>
                  % Grasa corporal
                </label>
                <input
                  id={`body_fat_${athleteId}`}
                  name="body_fat_percent"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="ej. 18.5"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" htmlFor={`adherence_${athleteId}`}>
                  Adherencia (1–10)
                </label>
                <input
                  id={`adherence_${athleteId}`}
                  name="adherence_score"
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  placeholder="ej. 7"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" htmlFor={`notes_${athleteId}`}>
                Notas
              </label>
              <textarea
                id={`notes_${athleteId}`}
                name="notes"
                rows={2}
                placeholder="Observaciones, notas de cumplimiento…"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" htmlFor={`next_actions_${athleteId}`}>
                Próximas acciones
              </label>
              <textarea
                id={`next_actions_${athleteId}`}
                name="next_actions"
                rows={2}
                placeholder="Ajustes o recomendaciones para el próximo período…"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Guardando…' : 'Guardar check-in'}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null); }}
                className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

'use client';

import { useRef, useState, useTransition } from 'react';
import { updateNutritionCheckin } from './actions';

type NutritionCheckin = {
  id: string;
  checkin_date: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
  adherence_score: number | null;
  notes: string | null;
  next_actions: string | null;
};

export default function EditCheckinForm({ checkin }: { checkin: NutritionCheckin }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateNutritionCheckin(checkin.id, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
      }
    });
  }

  if (!editing) {
    return (
      <div className="rounded border border-gray-200 bg-white p-2.5 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-gray-700">
          <span className="font-medium">{new Date(checkin.checkin_date).toLocaleDateString()}</span>
          {checkin.weight_kg != null && <span>{checkin.weight_kg} kg</span>}
          {checkin.body_fat_percent != null && <span>{checkin.body_fat_percent}% BF</span>}
          {checkin.adherence_score != null && <span>Adherencia: {checkin.adherence_score}/10</span>}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto text-xs text-blue-600 hover:underline"
          >
            Editar
          </button>
        </div>
        {checkin.notes && (
          <p className="mt-1 text-gray-500 text-xs" title={checkin.notes}>{checkin.notes}</p>
        )}
        {checkin.next_actions && (
          <p className="mt-0.5 text-xs text-gray-400 italic">{checkin.next_actions}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-sm">
      {error && (
        <p className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">{error}</p>
      )}
      <form ref={formRef} action={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="block text-xs font-medium mb-0.5">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              name="checkin_date"
              type="date"
              required
              defaultValue={checkin.checkin_date}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Peso (kg)</label>
            <input
              name="weight_kg"
              type="number"
              step="0.01"
              min="0"
              defaultValue={checkin.weight_kg ?? ''}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">% Grasa corporal</label>
            <input
              name="body_fat_percent"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={checkin.body_fat_percent ?? ''}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Adherencia (1–10)</label>
            <input
              name="adherence_score"
              type="number"
              min="1"
              max="10"
              step="1"
              defaultValue={checkin.adherence_score ?? ''}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-0.5">Notas</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={checkin.notes ?? ''}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-0.5">Próximas acciones</label>
          <textarea
            name="next_actions"
            rows={2}
            defaultValue={checkin.next_actions ?? ''}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-0.5 text-amber-700">
            Motivo de la edición
          </label>
          <textarea
            name="edit_reason"
            rows={2}
            placeholder="¿Por qué se modifica esta información?"
            className="w-full rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs resize-none placeholder:text-amber-400"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(null); }}
            className="rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

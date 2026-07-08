'use client';

import { useRef, useState, useTransition } from 'react';
import { updatePhysioCase } from './actions';

type Props = {
  caseId: string;
  openedAt: string;
  athleteName: string;
  profileName: string;
  injuryType: string | null;
};

export default function EditCaseForm({ caseId, openedAt, athleteName, profileName, injuryType }: Props) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updatePhysioCase(caseId, formData);
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
      <div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{athleteName}</h2>
            <p className="text-sm text-gray-600 mt-1">
              Fisioterapeuta: {profileName}
              {injuryType ? ` · ${injuryType}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="text-sm text-gray-500">{new Date(openedAt).toLocaleDateString()}</span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
            >
              ✏️ Editar caso
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
      {error && (
        <p className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">{error}</p>
      )}
      <form ref={formRef} action={handleSubmit} className="space-y-2">
        <div>
          <label className="block text-xs font-medium mb-0.5">
            Fecha de apertura <span className="text-red-500">*</span>
          </label>
          <input
            name="opened_at"
            type="date"
            required
            defaultValue={openedAt}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
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

'use client';

import { useRef, useState, useTransition } from 'react';
import { createDiscipline } from './actions';

export default function NewDisciplineForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createDiscipline(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setOpen(false);
        formRef.current?.reset();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
      >
        + Nueva disciplina
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
      <h3 className="text-base font-semibold text-indigo-800 mb-4">Nueva Disciplina</h3>

      {error && (
        <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form ref={formRef} action={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="disc-name">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="disc-name"
              name="name"
              type="text"
              required
              placeholder="ej. Judo, Swimming…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="disc-category">
              Categoría
            </label>
            <select
              id="disc-category"
              name="category_type"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="individual">Individual</option>
              <option value="team">Equipo</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Guardando…' : 'Guardar disciplina'}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null); }}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-white transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

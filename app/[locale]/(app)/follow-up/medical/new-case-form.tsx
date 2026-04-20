'use client';

import { useRef, useState, useTransition } from 'react';
import { createMedicalCase } from './actions';

type Person = { id: string; first_name: string; last_name: string };

export default function NewCaseForm({
  athletes,
  doctors,
}: {
  athletes: Person[];
  doctors: Person[];
}) {
  const [open, setOpen]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createMedicalCase(formData);
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
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Nuevo caso
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold mb-4">Nuevo Caso Médico</h2>

          {error && (
            <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Athlete */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="med-athlete">
                  Atleta <span className="text-red-500">*</span>
                </label>
                <select
                  id="med-athlete"
                  name="athlete_id"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar atleta…</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Medical professional */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="med-doctor">
                  Profesional médico
                </label>
                <select
                  id="med-doctor"
                  name="doctor_profile_id"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar profesional…</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.first_name} {d.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Condition / Diagnosis */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="med-condition">
                  Condición / Diagnóstico
                </label>
                <input
                  id="med-condition"
                  name="condition"
                  type="text"
                  placeholder="ej. Hipertensión, Diabetes tipo 2…"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {/* Opened on */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="med-opened">
                  Fecha de apertura <span className="text-red-500">*</span>
                </label>
                <input
                  id="med-opened"
                  name="opened_at"
                  type="date"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="med-status">
                  Estado
                </label>
                <select
                  id="med-status"
                  name="status"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="open">Abierto</option>
                  <option value="in_progress">En progreso</option>
                  <option value="closed">Cerrado</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="med-notes">
                Notas
              </label>
              <textarea
                id="med-notes"
                name="notes"
                rows={2}
                placeholder="Antecedentes, información de referencia, contexto…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Guardando…' : 'Guardar caso'}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null); }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
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

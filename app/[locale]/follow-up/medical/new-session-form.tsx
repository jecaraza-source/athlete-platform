'use client';

import { useRef, useState, useTransition } from 'react';
import { createMedicalSession } from './actions';

type CaseOption = { id: string; label: string };

export default function NewMedicalSessionForm({ cases }: { cases: CaseOption[] }) {
  const [open, setOpen]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createMedicalSession(formData);
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
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
        >
          + Add session
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 p-4 mt-2">
          <h3 className="font-semibold mb-3 text-sm">New Medical Session</h3>

          {error && (
            <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <form ref={formRef} action={handleSubmit} className="space-y-3">
            {/* Case + Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="ms-case">
                  Case <span className="text-red-500">*</span>
                </label>
                <select
                  id="ms-case"
                  name="medical_case_id"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select case…</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="ms-date">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="ms-date"
                  name="session_date"
                  type="date"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Physio-style scores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="ms-pain">
                  Pain (1–10)
                </label>
                <input
                  id="ms-pain"
                  name="pain_score"
                  type="number"
                  min="1" max="10" step="1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="ms-health">
                  Health (1–10)
                </label>
                <input
                  id="ms-health"
                  name="health_score"
                  type="number"
                  min="1" max="10" step="1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="ms-adherence">
                  Adherence (1–10)
                </label>
                <input
                  id="ms-adherence"
                  name="adherence_score"
                  type="number"
                  min="1" max="10" step="1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="ms-next">
                  Next session
                </label>
                <input
                  id="ms-next"
                  name="next_session_date"
                  type="date"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Nutrition-style metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="ms-weight">
                  Weight (kg)
                </label>
                <input
                  id="ms-weight"
                  name="weight_kg"
                  type="number"
                  min="0" step="0.1"
                  placeholder="e.g. 72.5"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="ms-bp">
                  Blood pressure
                </label>
                <input
                  id="ms-bp"
                  name="blood_pressure"
                  type="text"
                  placeholder="e.g. 120/80 mmHg"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Treatment summary */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="ms-treatment">
                Treatment summary <span className="text-red-500">*</span>
              </label>
              <textarea
                id="ms-treatment"
                name="treatment_summary"
                rows={2}
                required
                placeholder="Describe the treatment, medication, or procedure…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="ms-notes">
                Notes
              </label>
              <textarea
                id="ms-notes"
                name="notes"
                rows={2}
                placeholder="Additional observations, next actions…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null); }}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

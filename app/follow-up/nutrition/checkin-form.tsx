'use client';

import { useRef, useState, useTransition } from 'react';
import { createNutritionCheckin } from './actions';

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

  const latest = previousCheckins[0];

  if (!open) {
    return (
      <div className="mt-4 space-y-3">
        {latest && (
          <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">Latest Check-in</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm text-gray-700">
              <p><span className="font-medium">Date:</span> {new Date(latest.checkin_date).toLocaleDateString()}</p>
              {latest.weight_kg != null && (
                <p><span className="font-medium">Weight:</span> {latest.weight_kg} kg</p>
              )}
              {latest.body_fat_percent != null && (
                <p><span className="font-medium">Body fat:</span> {latest.body_fat_percent}%</p>
              )}
              {latest.adherence_score != null && (
                <p><span className="font-medium">Adherence:</span> {latest.adherence_score}/10</p>
              )}
            </div>
            {latest.notes && (
              <p className="mt-2 text-sm text-gray-600"><span className="font-medium">Notes:</span> {latest.notes}</p>
            )}
            {latest.next_actions && (
              <p className="mt-1 text-sm text-gray-600"><span className="font-medium">Next actions:</span> {latest.next_actions}</p>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
        >
          + New check-in
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {previousCheckins.length > 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Check-in History ({previousCheckins.length})
          </p>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {previousCheckins.map((c) => (
              <div key={c.id} className="rounded border border-gray-200 bg-white p-2.5 text-sm">
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-gray-700">
                  <span className="font-medium">{new Date(c.checkin_date).toLocaleDateString()}</span>
                  {c.weight_kg != null && <span>{c.weight_kg} kg</span>}
                  {c.body_fat_percent != null && <span>{c.body_fat_percent}% BF</span>}
                  {c.adherence_score != null && <span>Adherence: {c.adherence_score}/10</span>}
                </div>
                {c.notes && (
                  <p className="mt-1 text-gray-500 text-xs truncate" title={c.notes}>{c.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-md border border-gray-200 bg-white p-4">
        <h3 className="font-semibold text-sm mb-3">New Check-in</h3>

        {error && (
          <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <form ref={formRef} action={handleSubmit} className="space-y-3">
          {/* Hidden athlete id */}
          <input type="hidden" name="athlete_id" value={athleteId} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" htmlFor={`checkin_date_${athleteId}`}>
                Check-in date <span className="text-red-500">*</span>
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
                Nutritionist <span className="text-red-500">*</span>
              </label>
              <select
                id={`nutritionist_${athleteId}`}
                name="nutritionist_profile_id"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">Select…</option>
                {nutritionists.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.first_name} {n.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" htmlFor={`weight_${athleteId}`}>
                Weight (kg)
              </label>
              <input
                id={`weight_${athleteId}`}
                name="weight_kg"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 72.5"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" htmlFor={`body_fat_${athleteId}`}>
                Body fat (%)
              </label>
              <input
                id={`body_fat_${athleteId}`}
                name="body_fat_percent"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="e.g. 18.5"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" htmlFor={`adherence_${athleteId}`}>
                Adherence score (1–10)
              </label>
              <input
                id={`adherence_${athleteId}`}
                name="adherence_score"
                type="number"
                min="1"
                max="10"
                step="1"
                placeholder="e.g. 7"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" htmlFor={`notes_${athleteId}`}>
              Notes
            </label>
            <textarea
              id={`notes_${athleteId}`}
              name="notes"
              rows={2}
              placeholder="Observations, compliance notes…"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" htmlFor={`next_actions_${athleteId}`}>
              Next actions
            </label>
            <textarea
              id={`next_actions_${athleteId}`}
              name="next_actions"
              rows={2}
              placeholder="Adjustments or recommendations for next period…"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving…' : 'Save check-in'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

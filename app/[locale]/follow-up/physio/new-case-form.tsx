'use client';

import { useRef, useState, useTransition } from 'react';
import { createPhysioCase } from './actions';

type Person = { id: string; first_name: string; last_name: string };
type Injury = { id: string; injury_type: string; athlete_id: string };

export default function NewCaseForm({
  athletes,
  physios,
  injuries,
}: {
  athletes: Person[];
  physios: Person[];
  injuries: Injury[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedAthlete, setSelectedAthlete] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const athleteInjuries = injuries.filter((i) => i.athlete_id === selectedAthlete);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createPhysioCase(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setOpen(false);
        setSelectedAthlete('');
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
          + New case
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold mb-4">New Physio Case</h2>

          {error && (
            <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="athlete_id">
                  Athlete <span className="text-red-500">*</span>
                </label>
                <select
                  id="athlete_id"
                  name="athlete_id"
                  required
                  value={selectedAthlete}
                  onChange={(e) => setSelectedAthlete(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select athlete…</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="physio_profile_id">
                  Physio <span className="text-red-500">*</span>
                </label>
                <select
                  id="physio_profile_id"
                  name="physio_profile_id"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select physio…</option>
                  {physios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="injury_id">
                  Injury
                </label>
                <select
                  id="injury_id"
                  name="injury_id"
                  disabled={!selectedAthlete}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">
                    {selectedAthlete ? 'Select injury (optional)…' : 'Select athlete first'}
                  </option>
                  {athleteInjuries.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.injury_type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="opened_at">
                  Opened on <span className="text-red-500">*</span>
                </label>
                <input
                  id="opened_at"
                  name="opened_at"
                  type="date"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Saving…' : 'Save case'}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null); setSelectedAthlete(''); }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
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

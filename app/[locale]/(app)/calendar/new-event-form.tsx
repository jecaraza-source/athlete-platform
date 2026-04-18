'use client';

import { useRef, useState, useTransition } from 'react';
import { createEvent } from './actions';

const EVENT_TYPES = [
  'training',
  'competition',
  'meeting',
  'medical',
  'evaluation',
  'other',
];

const STATUSES = ['scheduled', 'completed', 'cancelled'];

type Profile = { id: string; first_name: string; last_name: string };
type Athlete = { id: string; first_name: string; last_name: string };
type Sport  = { id: string; name: string; category_type: string };
type ParticipationMode = 'none' | 'individual' | 'group';

export default function NewEventForm({
  profiles,
  athletes = [],
  sports = [],
}: {
  profiles: Profile[];
  athletes?: Athlete[];
  sports?: Sport[];
}) {
  const [open,    setOpen]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const [mode,       setMode]       = useState<ParticipationMode>('none');
  const [allChecked, setAllChecked] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  function toggleAll(checked: boolean) {
    setAllChecked(checked);
    setCheckedIds(checked ? new Set(athletes.map((a) => a.id)) : new Set());
  }

  function toggleAthlete(id: string, checked: boolean) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
    setAllChecked(false);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createEvent(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setOpen(false);
        setMode('none');
        setAllChecked(false);
        setCheckedIds(new Set());
        formRef.current?.reset();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        + New event
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-white p-4">
      <h3 className="font-semibold text-sm mb-3">New Event</h3>

      {error && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <form ref={formRef} action={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1" htmlFor="ev_title">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="ev_title"
              name="title"
              type="text"
              required
              placeholder="e.g. Morning training"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1" htmlFor="ev_created_by">
              Created by <span className="text-red-500">*</span>
            </label>
            <select
              id="ev_created_by"
              name="created_by_profile_id"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Sport */}
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="ev_sport">
              Sport
            </label>
            <select
              id="ev_sport"
              name="sport_id"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">All sports / General</option>
              {sports.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.category_type === 'team' ? ' (team)' : ' (individual)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="ev_type">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="ev_type"
              name="event_type"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="ev_status">
              Status
            </label>
            <select
              id="ev_status"
              name="status"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="ev_start">
              Start <span className="text-red-500">*</span>
            </label>
            <input
              id="ev_start"
              name="start_at"
              type="datetime-local"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="ev_end">
              End <span className="text-red-500">*</span>
            </label>
            <input
              id="ev_end"
              name="end_at"
              type="datetime-local"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1" htmlFor="ev_desc">
              Description
            </label>
            <textarea
              id="ev_desc"
              name="description"
              rows={2}
              placeholder="Optional details…"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm resize-none"
            />
          </div>

          {/* ── Participants ───────────────────────────────────────── */}
          {athletes.length > 0 && (
            <div className="sm:col-span-2">
              <p className="block text-xs font-medium mb-2">Participants</p>

              {/* Mode selector */}
              <div className="flex flex-wrap gap-4 mb-3">
                {([
                  { value: 'none',       label: 'No specific athletes' },
                  { value: 'individual', label: 'Individual athlete' },
                  { value: 'group',      label: 'Group of athletes' },
                ] as { value: ParticipationMode; label: string }[]).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700">
                    <input
                      type="radio"
                      name="_participation_mode"
                      value={opt.value}
                      checked={mode === opt.value}
                      onChange={() => { setMode(opt.value); setCheckedIds(new Set()); setAllChecked(false); }}
                      className="accent-sky-600"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              {/* Individual — single dropdown */}
              {mode === 'individual' && (
                <select
                  name="athlete_id"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                >
                  <option value="">Select athlete…</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))}
                </select>
              )}

              {/* Group — checkbox list */}
              {mode === 'group' && (
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-44 overflow-y-auto">
                  {/* Select-all row */}
                  <label className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-sky-600"
                    />
                    <span className="text-xs font-semibold text-gray-700">Select all athletes</span>
                  </label>

                  {/* Individual athletes */}
                  {athletes.map((a) => (
                    <label key={a.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        name="athlete_id"
                        value={a.id}
                        checked={checkedIds.has(a.id)}
                        onChange={(e) => toggleAthlete(a.id, e.target.checked)}
                        className="h-3.5 w-3.5 rounded accent-sky-600"
                      />
                      <span className="text-xs text-gray-700">
                        {a.first_name} {a.last_name}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* ── Notify participants ─────────────────────────────── */}
              {mode !== 'none' && (
                <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-xs font-medium text-gray-700 mb-2">Notify participants</p>
                  <div className="flex flex-wrap gap-5">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-700">
                      <input
                        type="checkbox"
                        name="notify_email"
                        value="on"
                        className="h-3.5 w-3.5 rounded accent-sky-600"
                      />
                      Email
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-700">
                      <input
                        type="checkbox"
                        name="notify_push"
                        value="on"
                        className="h-3.5 w-3.5 rounded accent-sky-600"
                      />
                      Push notification
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save event'}
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
  );
}

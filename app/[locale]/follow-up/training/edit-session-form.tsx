'use client';

import { useRef, useState, useTransition } from 'react';
import { updateTrainingSession } from './actions';

type TrainingSession = {
  id: string;
  title: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
};

export default function EditSessionForm({ session }: { session: TrainingSession }) {
  const [editing, setEditing]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateTrainingSession(session.id, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
      }
    });
  }

  // ── Read view ──────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="font-medium text-gray-700">
            {new Date(session.session_date).toLocaleDateString()}
          </span>
          <span className="text-gray-600">{session.title}</span>
          {(session.start_time || session.end_time) && (
            <span className="text-xs text-gray-500">
              {session.start_time ?? ''}
              {session.start_time && session.end_time ? ' – ' : ''}
              {session.end_time ?? ''}
            </span>
          )}
          {session.location && (
            <span className="text-xs text-gray-500">📍 {session.location}</span>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto text-xs text-blue-600 hover:underline"
          >
            Edit
          </button>
        </div>
        {session.notes && (
          <p className="mt-1 text-xs text-gray-400 italic">{session.notes}</p>
        )}
      </div>
    );
  }

  // ── Edit view ──────────────────────────────────────────────────────────────
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-sm">
      {error && (
        <p className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <form ref={formRef} action={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium mb-0.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              defaultValue={session.title}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              name="session_date"
              type="date"
              required
              defaultValue={session.session_date}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Location</label>
            <input
              name="location"
              type="text"
              defaultValue={session.location ?? ''}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Start time</label>
            <input
              name="start_time"
              type="time"
              defaultValue={session.start_time ?? ''}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">End time</label>
            <input
              name="end_time"
              type="time"
              defaultValue={session.end_time ?? ''}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-0.5">Notes</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={session.notes ?? ''}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Done'}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(null); }}
            className="rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

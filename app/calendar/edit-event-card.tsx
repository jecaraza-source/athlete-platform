'use client';

import { useRef, useState, useTransition } from 'react';
import { updateEvent } from './actions';

const EVENT_TYPES = [
  'training', 'match', 'competition',
  'meeting', 'medical', 'evaluation', 'other',
];

const STATUSES = ['scheduled', 'completed', 'cancelled'];

const TYPE_COLORS: Record<string, string> = {
  training:    'bg-blue-100 text-blue-700',
  match:       'bg-red-100 text-red-700',
  competition: 'bg-red-100 text-red-700',
  meeting:     'bg-yellow-100 text-yellow-700',
  medical:     'bg-green-100 text-green-700',
  evaluation:  'bg-violet-100 text-violet-700',
  other:       'bg-gray-100 text-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled:  'bg-sky-100 text-sky-700',
  completed:  'bg-emerald-100 text-emerald-700',
  cancelled:  'bg-gray-100 text-gray-500 line-through',
};

type Event = {
  id: string;
  title: string;
  event_type: string;
  start_at: string;
  end_at: string;
  status: string;
  description: string | null;
};

function formatDateTime(v: string) {
  return new Date(v).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Convert an ISO datetime string to the value expected by <input type="datetime-local"> */
function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventCard({ event: initial }: { event: Event }) {
  const [event,   setEvent]   = useState<Event>(initial);
  const [editing, setEditing] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateEvent(event.id, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
        // Optimistically update local state so the card reflects the change
        setEvent({
          ...event,
          title:       formData.get('title')       as string,
          event_type:  formData.get('event_type')  as string,
          start_at:    formData.get('start_at')    as string,
          end_at:      formData.get('end_at')      as string,
          status:      formData.get('status')      as string,
          description: (formData.get('description') as string) || null,
        });
      }
    });
  }

  // ── View mode ───────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="rounded-xl border border-gray-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">{event.title}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_COLORS[event.event_type] ?? 'bg-gray-100 text-gray-600'}`}>
                {event.event_type}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[event.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {event.status}
              </span>
            </div>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            Edit
          </button>
        </div>

        <div className="mt-3 text-sm text-gray-600 space-y-1">
          <p><span className="font-medium text-gray-700">Start:</span> {formatDateTime(event.start_at)}</p>
          <p><span className="font-medium text-gray-700">End:</span>   {formatDateTime(event.end_at)}</p>
          {event.description && (
            <p><span className="font-medium text-gray-700">Notes:</span> {event.description}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Edit Event</h3>

      {error && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">{error}</p>
      )}

      <form ref={formRef} action={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Title */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1" htmlFor={`ee-title-${event.id}`}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id={`ee-title-${event.id}`}
              name="title"
              type="text"
              required
              defaultValue={event.title}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor={`ee-type-${event.id}`}>
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id={`ee-type-${event.id}`}
              name="event_type"
              required
              defaultValue={event.event_type}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor={`ee-status-${event.id}`}>
              Status
            </label>
            <select
              id={`ee-status-${event.id}`}
              name="status"
              defaultValue={event.status}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Start */}
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor={`ee-start-${event.id}`}>
              Start <span className="text-red-500">*</span>
            </label>
            <input
              id={`ee-start-${event.id}`}
              name="start_at"
              type="datetime-local"
              required
              defaultValue={toDatetimeLocal(event.start_at)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* End */}
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor={`ee-end-${event.id}`}>
              End <span className="text-red-500">*</span>
            </label>
            <input
              id={`ee-end-${event.id}`}
              name="end_at"
              type="datetime-local"
              required
              defaultValue={toDatetimeLocal(event.end_at)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1" htmlFor={`ee-desc-${event.id}`}>
              Description
            </label>
            <textarea
              id={`ee-desc-${event.id}`}
              name="description"
              rows={2}
              defaultValue={event.description ?? ''}
              placeholder="Optional notes…"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm resize-none focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(null); }}
            className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

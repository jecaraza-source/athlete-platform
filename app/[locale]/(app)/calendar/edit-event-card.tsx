'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateEvent, deleteEvent } from './actions';


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

type Participant = { id: string; first_name: string; last_name: string };
type Sport        = { id: string; name: string; category_type: string };
type ParticipationMode = 'none' | 'individual' | 'group';

type Event = {
  id: string;
  title: string;
  event_type: string;
  sport_id: string | null;
  sport_name: string | null;
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

export default function EditEventCard({
  event: initial,
  eventParticipants = [],
  athletes = [],
  sports = [],
}: {
  event: Event;
  eventParticipants?: Participant[];
  athletes?: Participant[];
  sports?: Sport[];
}) {
  const t  = useTranslations('calendar');
  const tc = useTranslations('common');

  const EVENT_TYPES = [
    { value: 'training',    label: t('typeTraining')    },
    { value: 'competition', label: t('typeCompetition') },
    { value: 'meeting',     label: t('typeMeeting')     },
    { value: 'medical',     label: t('typeMedical')     },
    { value: 'evaluation',  label: t('typeEvaluation')  },
    { value: 'other',       label: t('typeOther')       },
  ];
  const STATUSES = [
    { value: 'scheduled', label: t('statusScheduled') },
    { value: 'completed', label: t('statusCompleted')  },
    { value: 'cancelled', label: t('statusCancelled')  },
  ];
  const EVENT_TYPE_LABEL = Object.fromEntries(EVENT_TYPES.map((et) => [et.value, et.label]));
  const STATUS_LABEL     = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

  const [event,      setEvent]      = useState<Event>(initial);
  const [participants, setParticipants] = useState<Participant[]>(eventParticipants);
  const [editing,    setEditing]    = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [isPending,  startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Participation state in edit mode
  const [editMode,      setEditMode]      = useState<ParticipationMode>('none');
  const [editSingleId,  setEditSingleId]  = useState('');
  const [editCheckedIds, setEditCheckedIds] = useState<Set<string>>(new Set());
  const [allChecked,    setAllChecked]    = useState(false);

  // Row has been deleted — remove from DOM
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;

  /** Open the edit form, pre-populating participant selection from current state. */
  function openEdit() {
    if (participants.length === 0) {
      setEditMode('none');
      setEditSingleId('');
      setEditCheckedIds(new Set());
    } else if (participants.length === 1) {
      setEditMode('individual');
      setEditSingleId(participants[0].id);
      setEditCheckedIds(new Set());
    } else {
      setEditMode('group');
      const ids = new Set(participants.map((p) => p.id));
      setEditCheckedIds(ids);
      setAllChecked(ids.size === athletes.length && athletes.length > 0);
      setEditSingleId('');
    }
    setEditing(true);
  }

  function toggleAll(checked: boolean) {
    setAllChecked(checked);
    setEditCheckedIds(checked ? new Set(athletes.map((a) => a.id)) : new Set());
  }

  function toggleAthlete(id: string, checked: boolean) {
    setEditCheckedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
    setAllChecked(false);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteEvent(event.id);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
      } else {
        setDeleted(true);
      }
    });
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateEvent(event.id, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
        // Optimistically update event fields
        const newSportId = (formData.get('sport_id') as string) || null;
        const newSportName = sports.find(s => s.id === newSportId)?.name ?? null;
        setEvent({
          ...event,
          title:       formData.get('title')       as string,
          event_type:  formData.get('event_type')  as string,
          sport_id:    newSportId,
          sport_name:  newSportName,
          start_at:    formData.get('start_at')    as string,
          end_at:      formData.get('end_at')      as string,
          status:      formData.get('status')      as string,
          description: (formData.get('description') as string) || null,
        });
        // Optimistically update participants list
        const selectedIds = formData.getAll('athlete_id') as string[];
        setParticipants(athletes.filter((a) => selectedIds.includes(a.id)));
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
              {EVENT_TYPE_LABEL[event.event_type] ?? event.event_type}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[event.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABEL[event.status] ?? event.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openEdit}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              {t('editBtn')}
            </button>

            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
              >
              {t('deleteBtn')}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500">{t('deleteConfirmMsg')}</span>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="font-semibold text-red-600 hover:underline disabled:opacity-50"
                >
                  {isPending ? tc('deleting') : tc('yes')}
                </button>
                <button
                  onClick={() => { setConfirming(false); setError(null); }}
                  className="text-gray-400 hover:text-gray-600 hover:underline"
                >
                  {tc('no')}
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 text-sm text-gray-600 space-y-1.5">
          <p><span className="font-medium text-gray-700">{t('displayStart')}</span> {formatDateTime(event.start_at)}</p>
          <p><span className="font-medium text-gray-700">{t('displayEnd')}</span>   {formatDateTime(event.end_at)}</p>
          {event.sport_name && (
            <p><span className="font-medium text-gray-700">{t('displayDiscipline')}</span> {event.sport_name}</p>
          )}
          {event.description && (
            <p><span className="font-medium text-gray-700">{t('displayNotes')}</span> {event.description}</p>
          )}
          {participants.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="font-medium text-gray-700 shrink-0">{t('displayParticipants')}</span>
              {participants.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                >
                  {a.first_name} {a.last_name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('editEventTitle')}</h3>

      {error && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">{error}</p>
      )}

      <form ref={formRef} action={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Title */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1" htmlFor={`ee-title-${event.id}`}>
              {t('titleLabel')} <span className="text-red-500">*</span>
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

          {/* Discipline */}
          {sports.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1" htmlFor={`ee-sport-${event.id}`}>
                {t('disciplineLabel')}
              </label>
              <select
                id={`ee-sport-${event.id}`}
                name="sport_id"
                defaultValue={event.sport_id ?? ''}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">{t('noDiscipline')}</option>
                {sports.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.category_type === 'team' ? ' (equipo)' : ' (individual)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Type */}
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor={`ee-type-${event.id}`}>
              {t('typeLabel')} <span className="text-red-500">*</span>
            </label>
            <select
              id={`ee-type-${event.id}`}
              name="event_type"
              required
              defaultValue={event.event_type}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor={`ee-status-${event.id}`}>
              {t('statusLabel')}
            </label>
            <select
              id={`ee-status-${event.id}`}
              name="status"
              defaultValue={event.status}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Start */}
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor={`ee-start-${event.id}`}>
              {t('startLabel')} <span className="text-red-500">*</span>
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
              {t('endLabel')} <span className="text-red-500">*</span>
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
              {t('descriptionLabel')}
            </label>
            <textarea
              id={`ee-desc-${event.id}`}
              name="description"
              rows={2}
              defaultValue={event.description ?? ''}
              placeholder={t('descriptionPlaceholder')}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm resize-none focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Participants */}
          {athletes.length > 0 && (
            <div className="sm:col-span-2">
              <p className="block text-xs font-medium mb-2">{t('participantsLabel')}</p>

              {/* Mode radio */}
              <div className="flex flex-wrap gap-4 mb-3">
                {([
                  { value: 'none',       label: t('noSpecificAthletes') },
                  { value: 'individual', label: t('individualAthlete')  },
                  { value: 'group',      label: t('groupAthletes')      },
                ] as { value: ParticipationMode; label: string }[]).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700">
                    <input
                      type="radio"
                      name="_ep_mode"
                      value={opt.value}
                      checked={editMode === opt.value}
                      onChange={() => {
                        setEditMode(opt.value);
                        setEditCheckedIds(new Set());
                        setEditSingleId('');
                        setAllChecked(false);
                      }}
                      className="accent-sky-600"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              {/* Individual — single dropdown */}
              {editMode === 'individual' && (
                <select
                  name="athlete_id"
                  value={editSingleId}
                  onChange={(e) => setEditSingleId(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm"
                >
                  <option value="">{t('selectAthlete')}</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))}
                </select>
              )}

              {/* Group — checkbox list */}
              {editMode === 'group' && (
                <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 max-h-44 overflow-y-auto">
                  <label className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-sky-600"
                    />
                    <span className="text-xs font-semibold text-gray-700">{t('selectAllAthletes')}</span>
                  </label>
                  {athletes.map((a) => (
                    <label key={a.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-sky-50 transition-colors">
                      <input
                        type="checkbox"
                        name="athlete_id"
                        value={a.id}
                        checked={editCheckedIds.has(a.id)}
                        onChange={(e) => toggleAthlete(a.id, e.target.checked)}
                        className="h-3.5 w-3.5 rounded accent-sky-600"
                      />
                      <span className="text-xs text-gray-700">{a.first_name} {a.last_name}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* ── Notify participants ─────────────────────────────── */}
              {editMode !== 'none' && (
                <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-xs font-medium text-gray-700 mb-2">{t('notifyChanges')}</p>
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
                      {t('pushNotification')}
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? tc('saving') : tc('saveChanges')}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(null); }}
            className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-white transition-colors"
          >
            {tc('cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}

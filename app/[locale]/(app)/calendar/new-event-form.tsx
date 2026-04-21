'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createEvent } from './actions';


type Athlete = { id: string; first_name: string; last_name: string };
type Sport  = { id: string; name: string; category_type: string };
type ParticipationMode = 'none' | 'individual' | 'group';

export default function NewEventForm({
  currentProfileId,
  athletes = [],
  sports = [],
}: {
  currentProfileId: string;
  athletes?: Athlete[];
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
        {t('newEvent')}
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-white p-4">
      <h3 className="font-semibold text-sm mb-3">{t('newEventTitle')}</h3>

      {error && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <form ref={formRef} action={handleSubmit} className="space-y-3">
        <input type="hidden" name="created_by_profile_id" value={currentProfileId} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1" htmlFor="ev_title">
              {t('titleLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              id="ev_title"
              name="title"
              type="text"
              required
              placeholder={t('titlePlaceholder')}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>

          {/* Discipline */}
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="ev_sport">
              {t('disciplineLabel')}
            </label>
            <select
              id="ev_sport"
              name="sport_id"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">{t('noDiscipline')}</option>
              {sports.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.category_type === 'team' ? ' (equipo)' : ' (individual)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="ev_type">
              {t('typeLabel')} <span className="text-red-500">*</span>
            </label>
            <select
              id="ev_type"
              name="event_type"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">{t('selectType')}</option>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="ev_status">
              {t('statusLabel')}
            </label>
            <select
              id="ev_status"
              name="status"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="ev_start">
              {t('startLabel')} <span className="text-red-500">*</span>
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
              {t('endLabel')} <span className="text-red-500">*</span>
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
              {t('descriptionLabel')}
            </label>
            <textarea
              id="ev_desc"
              name="description"
              rows={2}
              placeholder={t('descriptionPlaceholder')}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm resize-none"
            />
          </div>

          {/* ── Participants ───────────────────────────────────────── */}
          {athletes.length > 0 && (
            <div className="sm:col-span-2">
              <p className="block text-xs font-medium mb-2">{t('participantsLabel')}</p>

              {/* Mode selector */}
              <div className="flex flex-wrap gap-4 mb-3">
                {([
                  { value: 'none',       label: t('noSpecificAthletes') },
                  { value: 'individual', label: t('individualAthlete')  },
                  { value: 'group',      label: t('groupAthletes')      },
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
                  <option value="">{t('selectAthlete')}</option>
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
                    <span className="text-xs font-semibold text-gray-700">{t('selectAllAthletes')}</span>
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
                  <p className="text-xs font-medium text-gray-700 mb-2">{t('notifyParticipants')}</p>
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

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? tc('saving') : t('saveEvent')}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null); }}
            className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            {tc('cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}

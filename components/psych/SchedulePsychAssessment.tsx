'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { schedulePsychAssessment } from '@/app/[locale]/(app)/dashboard/mental-health/actions';
import { filterAthleteOptions } from '@/lib/psych/athlete-search';

type Option = { id: string; label: string };

export function SchedulePsychAssessment({ athletes, instruments }: { athletes: Option[]; instruments: Option[] }) {
  const t = useTranslations('psych.clinical.schedule');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [athleteQuery, setAthleteQuery] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const matchingAthletes = useMemo(() => filterAthleteOptions(athletes, athleteQuery), [athletes, athleteQuery]);
  // Keep the current selection visible even if it no longer matches the search.
  const selectedAthlete = athletes.find((athlete) => athlete.id === athleteId);
  const athleteOptions = selectedAthlete && !matchingAthletes.includes(selectedAthlete)
    ? [selectedAthlete, ...matchingAthletes]
    : matchingAthletes;

  function updateQuery(query: string) {
    setAthleteQuery(query);
    // Preselect the athlete when the search narrows to a single match.
    const matches = filterAthleteOptions(athletes, query);
    if (query.trim() && matches.length === 1) setAthleteId(matches[0].id);
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await schedulePsychAssessment({
        athleteId: String(formData.get('athleteId') ?? ''),
        instrumentId: String(formData.get('instrumentId') ?? ''),
        scheduledFor: String(formData.get('scheduledFor') ?? ''),
      });
      setError(result.error ?? null);
      setSuccess(result.error ? null : t('success'));
    });
  }
  return <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">{t('eyebrow')}</p>
    <h2 className="mt-1 text-2xl font-bold text-[#2D2D2D]">{t('title')}</h2>
    <form action={submit} className="mt-4 grid gap-3 md:grid-cols-3">
      <div className="flex flex-col gap-2">
        <input
          type="search"
          value={athleteQuery}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder={t('searchAthlete')}
          aria-label={t('searchAthlete')}
          aria-controls="psych-schedule-athlete"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          id="psych-schedule-athlete"
          required
          name="athleteId"
          value={athleteId}
          onChange={(event) => setAthleteId(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>{t('selectAthlete')}</option>
          {athleteOptions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        {athleteQuery.trim() && <p className="text-xs text-gray-500" aria-live="polite">{t('athleteMatches', { count: matchingAthletes.length })}</p>}
      </div>
      <select required name="instrumentId" defaultValue="" className="self-start rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="" disabled>{t('selectInstrument')}</option>{instruments.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select>
      <div className="flex gap-2 self-start"><input required name="scheduledFor" type="datetime-local" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" /><button disabled={isPending} className="rounded-lg bg-[#C0172C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isPending ? t('submitting') : t('submit')}</button></div>
    </form>
    {error && <p className="mt-3 text-sm text-red-700">{error}</p>}{success && <p className="mt-3 text-sm text-green-700">{success}</p>}
  </section>;
}

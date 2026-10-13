'use client';

import { useState, useTransition } from 'react';
import { schedulePsychAssessment } from '@/app/[locale]/(app)/dashboard/mental-health/actions';

type Option = { id: string; label: string };

export function SchedulePsychAssessment({ athletes, instruments }: { athletes: Option[]; instruments: Option[] }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await schedulePsychAssessment({
        athleteId: String(formData.get('athleteId') ?? ''),
        instrumentId: String(formData.get('instrumentId') ?? ''),
        scheduledFor: String(formData.get('scheduledFor') ?? ''),
      });
      setError(result.error ?? null);
      setSuccess(result.error ? null : 'Evaluación programada y notificación encolada.');
    });
  }
  return <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Programar</p>
    <h2 className="mt-1 text-2xl font-bold text-[#2D2D2D]">Nueva evaluación psicológica</h2>
    <form action={submit} className="mt-4 grid gap-3 md:grid-cols-3">
      <select required name="athleteId" defaultValue="" className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="" disabled>Selecciona atleta</option>{athletes.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
      <select required name="instrumentId" defaultValue="" className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="" disabled>Selecciona examen</option>{instruments.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select>
      <div className="flex gap-2"><input required name="scheduledFor" type="datetime-local" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" /><button disabled={isPending} className="rounded-lg bg-[#C0172C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isPending ? 'Programando…' : 'Programar'}</button></div>
    </form>
    {error && <p className="mt-3 text-sm text-red-700">{error}</p>}{success && <p className="mt-3 text-sm text-green-700">{success}</p>}
  </section>;
}

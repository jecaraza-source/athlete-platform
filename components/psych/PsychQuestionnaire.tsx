'use client';

import { FormEvent, useState, useTransition } from 'react';
import { calculatePsychScores, type CalculatedScore } from '@/lib/psych/scoring';

type ResponseOption = {
  value: string;
  label: string;
};

type InstrumentItem = {
  item_code: string;
  item_order: number;
  prompt_text: string;
  response_options: unknown;
  subscale_code: string;
  is_reverse_scored: boolean;
};

type Props = {
  assessmentId: string;
  instrumentCode: string;
  instrumentName: string;
  items: InstrumentItem[];
};

function normaliseOptions(value: unknown): ResponseOption[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((option) => {
    if (typeof option === 'string' || typeof option === 'number') {
      const normalised = String(option);
      return [{ value: normalised, label: normalised }];
    }
    if (
      option &&
      typeof option === 'object' &&
      'value' in option &&
      typeof option.value === 'string'
    ) {
      return [{
        value: option.value,
        label: 'label' in option && typeof option.label === 'string'
          ? option.label
          : option.value,
      }];
    }
    return [];
  });
}

const SCORE_LABELS: Record<string, string> = {
  cognitive_anxiety: 'Ansiedad cognitiva',
  somatic_anxiety: 'Ansiedad somática',
  self_confidence: 'Autoconfianza',
  trait_competitive_anxiety: 'Ansiedad competitiva',
  physical_emotional_exhaustion: 'Agotamiento físico/emocional',
  reduced_sense_of_accomplishment: 'Reducción del sentido de logro',
  sport_devaluation: 'Devaluación del deporte',
};

export function PsychQuestionnaire({ assessmentId, instrumentCode, instrumentName, items }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scores, setScores] = useState<CalculatedScore[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const responses = items.map((item) => ({
      item_code: item.item_code,
      raw_value: String(formData.get(item.item_code) ?? ''),
    }));

    if (responses.some((response) => !response.raw_value)) {
      setError('Responde todos los reactivos antes de enviar el cuestionario.');
      setMessage(null);
      setScores(null);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/psych/assessments/${assessmentId}/responses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responses }),
        });
        const result = await response.json().catch(() => ({}));

        if (response.status === 501 && result.code === 'PSYCH_SCORING_NOT_IMPLEMENTED') {
          setMessage('Tus respuestas fueron registradas. La interpretación estará disponible cuando sea revisada por el equipo de salud mental.');
          setError(null);
          return;
        }
        if (!response.ok) {
          setError(result.error ?? 'No fue posible registrar tus respuestas.');
          setMessage(null);
          setScores(null);
          return;
        }

        setMessage(result.message ?? 'Tus respuestas fueron registradas.');
        setScores(calculatePsychScores(instrumentCode, items, responses));
        setError(null);
      } catch {
        setError('No fue posible conectar con el servidor. Intenta nuevamente.');
        setMessage(null);
        setScores(null);
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-red-100 bg-white shadow-sm">
      <div className="border-b border-red-100 bg-red-50 px-6 py-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Cuestionario disponible</p>
        <h2 className="mt-1 text-xl font-bold text-[#2D2D2D]">{instrumentName}</h2>
        <p className="mt-1 text-sm text-gray-600">Tus respuestas son confidenciales y serán revisadas por personal autorizado.</p>
      </div>

      <div className="space-y-6 p-6">
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {message && <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>}
        {scores && scores.length > 0 && (
          <section className="rounded-xl border border-green-200 bg-green-50 p-4" aria-live="polite">
            <h3 className="text-sm font-bold text-green-900">Puntuaciones registradas</h3>
            <p className="mt-1 text-xs text-green-800">Son resultados de seguimiento; la interpretación corresponde al equipo de salud mental.</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {scores.map((score) => (
                <div key={score.subscaleCode} className="rounded-lg bg-white px-3 py-2">
                  <dt className="text-xs font-medium text-gray-600">{SCORE_LABELS[score.subscaleCode] ?? score.subscaleCode}</dt>
                  <dd className="mt-0.5 text-lg font-bold text-[#2D2D2D]">
                    {score.rawScore}
                    {score.band && <span className="ml-2 text-xs font-semibold text-[#C0172C]">{score.band}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {items.map((item) => {
          const options = normaliseOptions(item.response_options);
          return (
            <fieldset key={item.item_code} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
              <legend className="text-sm font-semibold text-[#2D2D2D]">
                <span className="mr-2 text-[#C0172C]">{item.item_order}.</span>
                {item.prompt_text}
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {options.map((option) => (
                  <label
                    key={option.value}
                    className="cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:border-[#C0172C] hover:bg-red-50 has-[:checked]:border-[#C0172C] has-[:checked]:bg-red-50 has-[:checked]:text-[#C0172C]"
                  >
                    <input className="sr-only" type="radio" name={item.item_code} value={option.value} />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="flex justify-end border-t border-gray-100 px-6 py-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[#C0172C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C1000E] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Enviando…' : 'Enviar respuestas'}
        </button>
      </div>
    </form>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { approvePsychAssessment, savePsychClinicalReview, savePsychScoreInterpretation } from '@/app/[locale]/(app)/dashboard/mental-health/actions';

type Score = {
  id: string;
  subscaleCode: string;
  rawScore: number;
  band: string | null;
  interpretationText: string | null;
};

type Response = {
  itemCode: string;
  rawValue: string;
  createdAt: string;
};

type Props = {
  assessmentId: string;
  assessmentStatus: string;
  published: boolean;
  clinicalSummary: string;
  reviewedAt: string | null;
  approvedAt: string | null;
  canEdit: boolean;
  canPublish: boolean;
  scores: Score[];
  responses: Response[];
};

export function AssessmentDetailEditor({
  assessmentId,
  assessmentStatus,
  published,
  clinicalSummary,
  reviewedAt,
  approvedAt,
  canEdit,
  canPublish,
  scores,
  responses,
}: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, startPublishing] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isApproving, startApproving] = useTransition();

  function publish() {
    startPublishing(async () => {
      const response = await fetch(`/api/psych/assessments/${assessmentId}/publish`, { method: 'PATCH' });
      const result = await response.json().catch(() => ({}));
      setError(response.ok ? null : (result.error ?? 'No fue posible publicar el assessment.'));
      setMessage(response.ok ? 'Assessment publicado para el atleta.' : null);
    });
  }

  function saveInterpretation(scoreId: string, form: HTMLFormElement) {
    const interpretationText = String(new FormData(form).get('interpretation_text') ?? '');
    startSaving(async () => {
      const result = await savePsychScoreInterpretation({ scoreId, interpretationText });
      setError(result.error ?? null);
      setMessage(result.error ? null : 'Interpretación guardada.');
    });
  }

  function saveClinicalReview(form: HTMLFormElement) {
    const summary = String(new FormData(form).get('clinical_summary') ?? '');
    startSaving(async () => {
      const result = await savePsychClinicalReview({ assessmentId, clinicalSummary: summary });
      setError(result.error ?? null);
      setMessage(result.error ? null : 'Resumen clínico guardado.');
    });
  }

  function approve() {
    startApproving(async () => {
      const result = await approvePsychAssessment({ assessmentId });
      setError(result.error ?? null);
      setMessage(result.error ? null : 'Evaluación aprobada para publicación.');
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Interpretación clínica</p>
            <h2 className="mt-1 text-xl font-bold text-[#2D2D2D]">Revisión y puntajes</h2>
          </div>
          {published ? <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">Publicado</span> : assessmentStatus === 'approved' && canPublish ? (
            <button type="button" onClick={publish} disabled={isPublishing} className="rounded-lg bg-[#C0172C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C1000E] disabled:opacity-60">
              {isPublishing ? 'Publicando…' : 'Publicar al atleta'}
            </button>
          ) : (
            <div className="text-right">
              <button type="button" disabled className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500">
                Publicar al atleta
              </button>
              <p className="mt-1 max-w-52 text-xs text-gray-500">Disponible después de la aprobación clínica.</p>
            </div>
          )}
        </header>
        <div className="space-y-4 p-6">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>}
          <form onSubmit={(event) => { event.preventDefault(); saveClinicalReview(event.currentTarget); }} className="rounded-xl border border-gray-200 p-4">
            <p className="font-semibold text-[#2D2D2D]">Resumen clínico</p>
            <textarea name="clinical_summary" defaultValue={clinicalSummary} disabled={!canEdit} rows={4} placeholder="Resumen clínico y recomendaciones para el atleta…" className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-[#C0172C] focus:outline-none focus:ring-2 focus:ring-red-100 disabled:bg-gray-50" />
            {canEdit && <div className="mt-3 flex justify-end"><button type="submit" disabled={isSaving} className="rounded-lg border border-[#C0172C] px-3 py-2 text-sm font-semibold text-[#C0172C] hover:bg-red-50 disabled:opacity-60">{isSaving ? 'Guardando…' : 'Guardar resumen'}</button></div>}
          </form>
          {scores.length === 0 ? <p className="text-sm text-gray-500">Este instrumento no tiene scoring automático validado; requiere revisión clínica manual.</p> : scores.map((score) => (
            <form key={score.id} onSubmit={(event) => { event.preventDefault(); saveInterpretation(score.id, event.currentTarget); }} className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold capitalize text-[#2D2D2D]">{score.subscaleCode.replaceAll('_', ' ')}</p>
                  <p className="mt-1 text-sm text-gray-600">Puntaje: {score.rawScore}</p>
                </div>
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-[#C0172C]">{score.band ?? 'Sin banda'}</span>
              </div>
              <textarea name="interpretation_text" defaultValue={score.interpretationText ?? ''} disabled={!canEdit} rows={4} placeholder="Interpretación clínica para esta subescala…" className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-[#C0172C] focus:outline-none focus:ring-2 focus:ring-red-100 disabled:bg-gray-50" />
              {canEdit && <div className="mt-3 flex justify-end"><button type="submit" disabled={isSaving} className="rounded-lg border border-[#C0172C] px-3 py-2 text-sm font-semibold text-[#C0172C] hover:bg-red-50 disabled:opacity-60">{isSaving ? 'Guardando…' : 'Guardar interpretación'}</button></div>}
            </form>
          ))}
          {assessmentStatus === 'under_review' && canEdit && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">Guarda el resumen clínico y las interpretaciones requeridas antes de aprobar.</p>
              <button type="button" onClick={approve} disabled={isApproving} className="rounded-lg bg-[#C0172C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C1000E] disabled:opacity-60">{isApproving ? 'Aprobando…' : 'Aprobar evaluación'}</button>
            </div>
          )}
          {(reviewedAt || approvedAt) && <p className="text-xs text-gray-500">Revisión: {reviewedAt ? new Date(reviewedAt).toLocaleString('es-MX') : 'pendiente'} · Aprobación: {approvedAt ? new Date(approvedAt).toLocaleString('es-MX') : 'pendiente'}</p>}
        </div>
      </section>
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <header className="border-b border-gray-100 px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Datos clínicos</p>
          <h2 className="mt-1 text-xl font-bold text-[#2D2D2D]">Respuestas crudas</h2>
        </header>
        <div className="max-h-[720px] divide-y divide-gray-100 overflow-y-auto">
          {responses.length === 0 ? <p className="px-6 py-8 text-sm text-gray-500">No hay respuestas registradas.</p> : responses.map((response) => (
            <div key={response.itemCode} className="flex items-center justify-between gap-3 px-6 py-3">
              <div><p className="font-mono text-xs font-semibold text-[#2D2D2D]">{response.itemCode}</p><p className="mt-1 text-xs text-gray-500">{new Date(response.createdAt).toLocaleString('es-MX')}</p></div>
              <p className="text-sm font-semibold text-[#C0172C]">{response.rawValue}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

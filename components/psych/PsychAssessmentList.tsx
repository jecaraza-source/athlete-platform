'use client';

import { useMemo, useState } from 'react';

type Assessment = {
  id: string;
  athleteName: string;
  instrumentName: string;
  completedAt: string | null;
  status: 'completed' | 'under_review' | 'approved';
  published: boolean;
};
type PublicationFilter = 'all' | 'published' | 'unpublished' | 'under_review';

const STATUS_LABELS: Record<Assessment['status'], string> = {
  completed: 'Completado (legado)',
  under_review: 'En revisión clínica',
  approved: 'Aprobado',
};

const STATUS_STYLES: Record<Assessment['status'], string> = {
  completed: 'bg-gray-100 text-gray-700',
  under_review: 'bg-amber-50 text-amber-800',
  approved: 'bg-sky-50 text-sky-800',
};

export function PsychAssessmentList({ assessments }: { assessments: Assessment[] }) {
  const [athleteFilter, setAthleteFilter] = useState('');
  const [instrumentFilter, setInstrumentFilter] = useState('');
  const [publicationFilter, setPublicationFilter] = useState<PublicationFilter>('all');
  const pendingReviews = assessments.filter((assessment) => assessment.status === 'under_review' && !assessment.published);
  const filtered = useMemo(() => assessments.filter((assessment) =>
    assessment.athleteName.toLowerCase().includes(athleteFilter.toLowerCase()) &&
    assessment.instrumentName.toLowerCase().includes(instrumentFilter.toLowerCase()) &&
    (publicationFilter === 'all' ||
      (publicationFilter === 'published' && assessment.published) ||
      (publicationFilter === 'unpublished' && !assessment.published) ||
      (publicationFilter === 'under_review' && assessment.status === 'under_review'))
  ), [assessments, athleteFilter, instrumentFilter, publicationFilter]);

  return (
    <section className="mt-10">
      <section className="mb-10 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-800">Revisión clínica</p>
          <h2 className="mt-1 text-2xl font-bold text-[#2D2D2D]">Evaluaciones por calificar</h2>
          <p className="mt-1 text-sm text-amber-900">Evaluaciones terminadas por el atleta y pendientes de calificación por el especialista.</p>
        </div>
        {pendingReviews.length === 0 ? <p className="rounded-xl border border-amber-100 bg-white px-4 py-5 text-sm text-gray-600">No hay evaluaciones pendientes de calificación.</p> : (
          <div className="divide-y divide-amber-100 overflow-hidden rounded-xl border border-amber-100 bg-white">
            {pendingReviews.map((assessment) => (
              <a key={assessment.id} href={`/dashboard/mental-health/assessments/${assessment.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition hover:bg-amber-50">
                <div>
                  <p className="font-semibold text-[#2D2D2D]">{assessment.athleteName}</p>
                  <p className="text-sm text-gray-600">Prueba aplicada: {assessment.instrumentName}</p>
                  <p className="mt-1 text-xs font-medium text-amber-800">Terminada por el atleta · Pendiente de calificación por el especialista</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{assessment.completedAt ? new Date(assessment.completedAt).toLocaleDateString('es-MX') : 'Sin fecha'}</p>
                  <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Por calificar</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Evaluaciones</p>
        <h2 className="mt-1 text-2xl font-bold text-[#2D2D2D]">Evaluaciones clínicas</h2>
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <input value={athleteFilter} onChange={(event) => setAthleteFilter(event.target.value)} placeholder="Filtrar atleta" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input value={instrumentFilter} onChange={(event) => setInstrumentFilter(event.target.value)} placeholder="Filtrar instrumento" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <select value={publicationFilter} onChange={(event) => setPublicationFilter(event.target.value as PublicationFilter)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="all">Toda publicación</option><option value="published">Publicados</option><option value="unpublished">No publicados</option><option value="under_review">En revisión clínica</option></select>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {filtered.length === 0 ? <p className="px-6 py-8 text-sm text-gray-500">No hay evaluaciones para los filtros seleccionados.</p> : filtered.map((assessment) => (
          <a key={assessment.id} href={`/dashboard/mental-health/assessments/${assessment.id}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 transition hover:bg-red-50 last:border-0">
            <div>
              <p className="font-semibold text-[#2D2D2D]">{assessment.athleteName}</p>
              <p className="text-sm text-gray-600">{assessment.instrumentName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{assessment.completedAt ? new Date(assessment.completedAt).toLocaleDateString('es-MX') : 'Sin fecha'}</p>
              <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${assessment.published ? 'bg-green-50 text-green-800' : STATUS_STYLES[assessment.status]}`}>
                {assessment.published ? 'Publicado' : STATUS_LABELS[assessment.status]}
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

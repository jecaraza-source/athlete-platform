'use client';

import { useMemo, useState } from 'react';

type Assessment = {
  id: string;
  athleteName: string;
  instrumentName: string;
  completedAt: string | null;
  published: boolean;
};

export function PsychAssessmentList({ assessments }: { assessments: Assessment[] }) {
  const [athleteFilter, setAthleteFilter] = useState('');
  const [instrumentFilter, setInstrumentFilter] = useState('');
  const [publicationFilter, setPublicationFilter] = useState('all');
  const filtered = useMemo(() => assessments.filter((assessment) =>
    assessment.athleteName.toLowerCase().includes(athleteFilter.toLowerCase()) &&
    assessment.instrumentName.toLowerCase().includes(instrumentFilter.toLowerCase()) &&
    (publicationFilter === 'all' || String(assessment.published) === publicationFilter)
  ), [assessments, athleteFilter, instrumentFilter, publicationFilter]);

  return (
    <section className="mt-10">
      <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C0172C]">Evaluaciones</p><h2 className="mt-1 text-2xl font-bold text-[#2D2D2D]">Assessments completados</h2></div>
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <input value={athleteFilter} onChange={(event) => setAthleteFilter(event.target.value)} placeholder="Filtrar atleta" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input value={instrumentFilter} onChange={(event) => setInstrumentFilter(event.target.value)} placeholder="Filtrar instrumento" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <select value={publicationFilter} onChange={(event) => setPublicationFilter(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="all">Toda publicación</option><option value="true">Publicados</option><option value="false">No publicados</option></select>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {filtered.length === 0 ? <p className="px-6 py-8 text-sm text-gray-500">No hay assessments para los filtros seleccionados.</p> : filtered.map((assessment) => (
          <a key={assessment.id} href={`/dashboard/mental-health/assessments/${assessment.id}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 transition hover:bg-red-50 last:border-0">
            <div><p className="font-semibold text-[#2D2D2D]">{assessment.athleteName}</p><p className="text-sm text-gray-600">{assessment.instrumentName}</p></div>
            <div className="text-right"><p className="text-xs text-gray-500">{assessment.completedAt ? new Date(assessment.completedAt).toLocaleDateString('es-MX') : 'Sin fecha'}</p><span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${assessment.published ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{assessment.published ? 'Publicado' : 'Interno'}</span></div>
          </a>
        ))}
      </div>
    </section>
  );
}

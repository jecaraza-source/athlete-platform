'use client';

import { useRef, useState, useTransition } from 'react';
import { saveCoachSection } from './actions';
import type { DiagnosticStatus, CoachEvaluation } from '@/lib/types/diagnostic';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types/diagnostic';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-6 first:mt-0 pb-1 border-b border-gray-100">
      {children}
    </h3>
  );
}

function Textarea({ label, name, defaultValue, placeholder, rows = 3 }: {
  label: string; name: string; defaultValue?: string | null; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-0.5">{label}</label>
      <textarea name={name} rows={rows} defaultValue={defaultValue ?? ''} placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
    </div>
  );
}

export default function CoachForm({
  athleteId, sectionStatus, existingData,
}: { athleteId: string; sectionStatus: DiagnosticStatus; existingData: CoachEvaluation | null; }) {
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef                     = useRef<HTMLFormElement>(null);
  const d                           = existingData;
  const isComplete                  = sectionStatus === 'completo';

  function handleSave(complete: boolean) {
    const formData = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await saveCoachSection(athleteId, complete, formData);
      if (result.error) { setError(result.error); setSuccess(null); }
      else { setError(null); setSuccess(complete ? 'Rubro marcado como completo.' : 'Borrador guardado correctamente.'); }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-800">Rubro Entrenador</h2>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[sectionStatus]}`}>
          {STATUS_LABELS[sectionStatus]}
        </span>
      </div>
      {error   && <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

      <form ref={formRef}>
        <SectionTitle>1. Evaluación Inicial — Pruebas Físicas</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Fuerza" name="strength_test" defaultValue={d?.strength_test} placeholder="Resultados de pruebas de fuerza…" />
          <Textarea label="Potencia" name="power_test" defaultValue={d?.power_test} placeholder="Resultados de pruebas de potencia…" />
          <Textarea label="Velocidad" name="speed_test" defaultValue={d?.speed_test} placeholder="Resultados de pruebas de velocidad…" />
          <Textarea label="Resistencia" name="endurance_test" defaultValue={d?.endurance_test} placeholder="Resultados de pruebas de resistencia…" />
          <Textarea label="Flexibilidad" name="flexibility_test" defaultValue={d?.flexibility_test} placeholder="Resultados de pruebas de flexibilidad…" />
        </div>

        <SectionTitle>2. Análisis Técnico</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Detección de debilidades técnicas" name="technical_weaknesses" defaultValue={d?.technical_weaknesses}
            placeholder="Áreas técnicas a mejorar…" rows={3} />
          <Textarea label="Valoración de capacidades competitivas" name="competitive_capabilities" defaultValue={d?.competitive_capabilities}
            placeholder="Capacidades actuales para competencia…" rows={3} />
        </div>

        <SectionTitle>3. Evaluación Biomecánica</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Textarea label="Eficiencia del movimiento" name="movement_efficiency" defaultValue={d?.movement_efficiency} placeholder="Análisis de eficiencia motriz…" />
          <Textarea label="Mecánica corporal" name="body_mechanics" defaultValue={d?.body_mechanics} placeholder="Análisis de mecánica corporal…" />
          <Textarea label="Alineación segmentaria" name="segment_alignment" defaultValue={d?.segment_alignment} placeholder="Análisis de alineación corporal…" />
        </div>

        <SectionTitle>4. Perfil Deportivo del Atleta</SectionTitle>
        <Textarea label="Perfil deportivo completo" name="athlete_sport_profile" defaultValue={d?.athlete_sport_profile}
          placeholder="Descripción del perfil deportivo: capacidades, potencial y áreas de desarrollo…" rows={4} />

        <SectionTitle>5. Intervención por Disciplina</SectionTitle>
        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 mb-3">
          <p className="text-xs text-blue-700 font-medium">Bloques de intervención por disciplina:</p>
          <ul className="text-xs text-blue-600 mt-1 space-y-0.5">
            <li>• Combate: Judo, Karate, Tae Kwon Do</li>
            <li>• Resistencia: Atletismo, Natación, Canotaje, Parabadminton</li>
            <li>• Precisión: Tiro con Arco, Tiro Deportivo</li>
            <li>• Acrobático: Gimnasia Artística Femenil, Breaking</li>
          </ul>
        </div>
        <Textarea label="Plan de intervención específico para la disciplina del atleta" name="discipline_intervention"
          defaultValue={d?.discipline_intervention}
          placeholder="Describir los elementos de intervención específicos para la disciplina, enfocados en el bloque correspondiente…" rows={4} />

        <SectionTitle>6. Plan de Entrenamiento Individualizado</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Estructura de la temporada deportiva" name="season_structure" defaultValue={d?.season_structure}
            placeholder="Periodización y estructura anual del entrenamiento…" />
          <Textarea label="Calendario competitivo" name="competitive_calendar" defaultValue={d?.competitive_calendar}
            placeholder="Competencias programadas y objetivos por evento…" />
          <Textarea label="Objetivos de rendimiento" name="performance_objectives" defaultValue={d?.performance_objectives}
            placeholder="Metas de rendimiento a corto y largo plazo…" />
          <Textarea label="Etapas de preparación del atleta" name="preparation_stages" defaultValue={d?.preparation_stages}
            placeholder="Fases de preparación general, específica y competitiva…" />
        </div>

        <SectionTitle>7. Supervisión del Entrenador</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Corrección técnica" name="technical_correction" defaultValue={d?.technical_correction} placeholder="Estrategias de corrección técnica…" />
          <Textarea label="Supervisión de cargas de entrenamiento" name="load_supervision" defaultValue={d?.load_supervision} placeholder="Monitoreo y ajuste de cargas…" />
          <Textarea label="Preparación para competencia" name="competition_preparation" defaultValue={d?.competition_preparation} placeholder="Protocolos de preparación competitiva…" />
          <Textarea label="Análisis de desempeño" name="performance_analysis" defaultValue={d?.performance_analysis} placeholder="Herramientas y métodos de análisis…" />
          <Textarea label="Retroalimentación continua" name="continuous_feedback" defaultValue={d?.continuous_feedback} placeholder="Sistema de retroalimentación al atleta…" />
          <Textarea label="Monitoreo de mejora en marcas" name="mark_monitoring" defaultValue={d?.mark_monitoring} placeholder="Seguimiento de marcas y registros…" />
        </div>
        <Textarea label="Ajuste del plan de entrenamiento" name="plan_adjustments" defaultValue={d?.plan_adjustments}
          placeholder="Criterios y procedimiento para ajustar el plan…" rows={3} />

        <SectionTitle>Observaciones Generales</SectionTitle>
        <Textarea label="Observaciones" name="observations" defaultValue={d?.observations} placeholder="Observaciones adicionales del entrenador…" rows={3} />

        <div className="flex gap-3 pt-6 border-t border-gray-100 mt-6">
          <button type="button" disabled={isPending} onClick={() => handleSave(false)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            {isPending ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button type="button" disabled={isPending || isComplete} onClick={() => handleSave(true)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {isComplete ? 'Rubro completado ✓' : isPending ? 'Guardando…' : 'Marcar como completo'}
          </button>
        </div>
      </form>
    </div>
  );
}

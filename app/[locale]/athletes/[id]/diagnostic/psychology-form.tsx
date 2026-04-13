'use client';

import { useRef, useState, useTransition } from 'react';
import { savePsychologySection } from './actions';
import type { DiagnosticStatus, PsychologyEvaluation } from '@/lib/types/diagnostic';
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

export default function PsychologyForm({
  athleteId, sectionStatus, existingData,
}: { athleteId: string; sectionStatus: DiagnosticStatus; existingData: PsychologyEvaluation | null; }) {
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef                     = useRef<HTMLFormElement>(null);
  const d                           = existingData;
  const isComplete                  = sectionStatus === 'completo';

  function handleSave(complete: boolean) {
    const formData = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await savePsychologySection(athleteId, complete, formData);
      if (result.error) { setError(result.error); setSuccess(null); }
      else { setError(null); setSuccess(complete ? 'Rubro marcado como completo.' : 'Borrador guardado correctamente.'); }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-800">Rubro Psicología</h2>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[sectionStatus]}`}>
          {STATUS_LABELS[sectionStatus]}
        </span>
      </div>
      {error   && <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

      <form ref={formRef}>
        <SectionTitle>1. Historia Clínica Psicológica</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Entrevista psicológica deportiva" name="sport_psychological_interview" defaultValue={d?.sport_psychological_interview}
            placeholder="Hallazgos de la entrevista inicial…" rows={4} />
          <div className="space-y-3">
            <Textarea label="Inventario de ansiedad competitiva (CSAI-2 u otro)" name="competitive_anxiety_inventory" defaultValue={d?.competitive_anxiety_inventory}
              placeholder="Resultados del inventario de ansiedad competitiva…" />
            <Textarea label="Escala de Motivación Deportiva" name="sport_motivation_scale" defaultValue={d?.sport_motivation_scale}
              placeholder="Resultados de la escala de motivación…" />
            <Textarea label="Escala de Resiliencia Connor-Davidson (CD-RISC)" name="resilience_scale" defaultValue={d?.resilience_scale}
              placeholder="Resultados de la escala de resiliencia…" />
          </div>
        </div>

        <SectionTitle>2. Diagnóstico Psicológico</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Capacidad de regulación emocional" name="emotional_regulation" defaultValue={d?.emotional_regulation} placeholder="Nivel y estrategias de regulación emocional…" />
          <Textarea label="Motivación interna (impulso interno)" name="internal_motivation" defaultValue={d?.internal_motivation} placeholder="Valoración de motivación intrínseca…" />
          <Textarea label="Motivación externa (impulso externo)" name="external_motivation" defaultValue={d?.external_motivation} placeholder="Valoración de motivación extrínseca…" />
          <Textarea label="Tolerancia a la presión" name="pressure_tolerance" defaultValue={d?.pressure_tolerance} placeholder="Capacidad de manejo bajo presión competitiva…" />
          <Textarea label="Concentración" name="concentration" defaultValue={d?.concentration} placeholder="Nivel y calidad de la concentración…" />
          <Textarea label="Integración diagnóstica" name="diagnostic_integration" defaultValue={d?.diagnostic_integration} placeholder="Diagnóstico psicológico integrado…" />
        </div>

        <SectionTitle>3. Plan de Intervención Psicológica</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Visualización" name="visualization" defaultValue={d?.visualization} placeholder="Técnica y protocolo de visualización…" />
          <Textarea label="Autodiálogo" name="self_dialogue" defaultValue={d?.self_dialogue} placeholder="Estrategias de autodiálogo positivo…" />
          <Textarea label="Control de respiración" name="breathing_control" defaultValue={d?.breathing_control} placeholder="Técnicas de respiración aplicadas…" />
          <Textarea label="Establecimiento de metas" name="goal_setting" defaultValue={d?.goal_setting} placeholder="Metas a corto, mediano y largo plazo…" />
        </div>

        <SectionTitle>4. Entrenamiento Psicológico</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Entrenamiento de la concentración" name="concentration_training" defaultValue={d?.concentration_training} placeholder="Ejercicios de atención y concentración…" />
          <Textarea label="Seguimiento de metas" name="goal_follow_up" defaultValue={d?.goal_follow_up} placeholder="Progreso y ajuste de metas establecidas…" />
          <Textarea label="Ejercicios prácticos (dinámicas, simulaciones, prácticas)" name="practical_exercises" defaultValue={d?.practical_exercises}
            placeholder="Descripción de ejercicios y dinámicas aplicadas…" />
          <Textarea label="Retroalimentación psicológica continua" name="psychological_feedback" defaultValue={d?.psychological_feedback}
            placeholder="Avance, desempeño emocional, habilidades psicológicas…" />
        </div>

        <SectionTitle>5. Seguimiento y Evaluación</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Evaluación cuantitativa del estado psicológico" name="quantitative_psychological_state" defaultValue={d?.quantitative_psychological_state}
            placeholder="Puntajes y escalas de seguimiento…" />
          <Textarea label="Evaluación cuantitativa del desempeño psicológico" name="quantitative_performance" defaultValue={d?.quantitative_performance}
            placeholder="Indicadores de rendimiento psicológico en competencia…" />
        </div>
        <Textarea label="Análisis del impacto en el rendimiento deportivo" name="sport_performance_impact" defaultValue={d?.sport_performance_impact}
          placeholder="Cómo el estado psicológico impacta el rendimiento deportivo…" rows={3} />

        <SectionTitle>Observaciones Generales</SectionTitle>
        <Textarea label="Observaciones" name="observations" defaultValue={d?.observations} placeholder="Observaciones adicionales del psicólogo deportivo…" rows={3} />

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

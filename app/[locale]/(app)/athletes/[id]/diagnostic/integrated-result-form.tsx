'use client';

import { useRef, useState, useTransition } from 'react';
import { saveIntegratedResult, generateAIDiagnosticText } from './actions';
import type {
  IntegratedResults,
  MedicalEvaluation,
  NutritionEvaluation,
  PsychologyEvaluation,
  CoachEvaluation,
  PhysioEvaluation,
} from '@/lib/types/diagnostic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Evaluations = {
  medico:       MedicalEvaluation | null;
  nutricion:    NutritionEvaluation | null;
  psicologia:   PsychologyEvaluation | null;
  entrenador:   CoachEvaluation | null;
  fisioterapia: PhysioEvaluation | null;
};

type Fields = {
  overall_summary:          string;
  medical_summary:          string;
  nutritional_summary:      string;
  psychological_summary:    string;
  sport_profile:            string;
  physiotherapy_summary:    string;
  interdisciplinary_result: string;
};

// ---------------------------------------------------------------------------
// Helper: join non-empty strings with separator
// ---------------------------------------------------------------------------

function join(parts: (string | null | undefined)[], sep = '\n\n'): string {
  return parts.filter(Boolean).join(sep);
}

function labeled(label: string, value: string | null | undefined): string {
  return value?.trim() ? `${label}:\n${value.trim()}` : '';
}

// ---------------------------------------------------------------------------
// Auto-fill builder: extracts key fields from each section evaluation
// ---------------------------------------------------------------------------

function buildAutoFill(ev: Evaluations): Partial<Fields> {
  const m = ev.medico;
  const n = ev.nutricion;
  const p = ev.psicologia;
  const c = ev.entrenador;
  const f = ev.fisioterapia;

  const medical_summary = join([
    labeled('Diagnóstico médico', m?.diagnosis),
    labeled('Resultado clínico', m?.clinical_result),
    labeled('Integración diagnóstica', m?.diagnostic_integration),
    labeled('Nivel de riesgo', m?.risk_level),
    labeled('Prioridades de atención', m?.care_priorities),
    labeled('Recomendaciones médicas', m?.medical_recommendations),
    labeled('Antecedentes de lesiones', m?.injury_history),
    labeled('Factores de riesgo', m?.injury_risk_factors),
    labeled('Observaciones', m?.observations),
  ]);

  const nutritional_summary = join([
    labeled('Diagnóstico nutricional', n?.nutritional_diagnosis),
    labeled('Integración clínico-metabólica', n?.clinical_metabolic_integration),
    labeled('Plan alimentario', n?.food_plan),
    labeled('Objetivos deportivos nutricionales', n?.sport_objectives),
    labeled('Requerimientos energéticos', n?.energy_requirements),
    labeled('Resultados cualitativos', n?.qualitative_results),
    labeled('Resultados cuantitativos', n?.quantitative_results),
    labeled('Observaciones', n?.observations),
  ]);

  const psychological_summary = join([
    labeled('Integración diagnóstica psicológica', p?.diagnostic_integration),
    labeled('Impacto en el rendimiento deportivo', p?.sport_performance_impact),
    labeled('Estado psicológico cuantitativo', p?.quantitative_psychological_state),
    labeled('Rendimiento cuantitativo', p?.quantitative_performance),
    labeled('Regulación emocional', p?.emotional_regulation),
    labeled('Tolerancia a la presión', p?.pressure_tolerance),
    labeled('Concentración', p?.concentration),
    labeled('Objetivos y seguimiento', p?.goal_setting),
    labeled('Observaciones', p?.observations),
  ]);

  const sport_profile = join([
    labeled('Perfil deportivo del atleta', c?.athlete_sport_profile),
    labeled('Objetivos de rendimiento', c?.performance_objectives),
    labeled('Debilidades técnicas', c?.technical_weaknesses),
    labeled('Capacidades competitivas', c?.competitive_capabilities),
    labeled('Eficiencia de movimiento', c?.movement_efficiency),
    labeled('Estructura de temporada', c?.season_structure),
    labeled('Intervención disciplinar', c?.discipline_intervention),
    labeled('Observaciones', c?.observations),
  ]);

  const physiotherapy_summary = join([
    labeled('Diagnóstico funcional', f?.functional_diagnosis),
    labeled('Riesgo de lesión', f?.injury_risk),
    labeled('Síntomas actuales', f?.current_symptoms),
    labeled('Lesiones previas', f?.previous_injuries),
    labeled('Desequilibrios musculares', f?.muscle_imbalances),
    labeled('Limitaciones articulares', f?.joint_limitations),
    labeled('Intervención disciplinar', f?.discipline_intervention),
    labeled('Observaciones', f?.observations),
  ]);

  return {
    medical_summary,
    nutritional_summary,
    psychological_summary,
    sport_profile,
    physiotherapy_summary,
  };
}

// ---------------------------------------------------------------------------
// Controlled Textarea
// ---------------------------------------------------------------------------

function Textarea({ label, name, value, onChange, placeholder, rows = 4 }: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-0.5">{label}</label>
      <textarea
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function IntegratedResultForm({
  athleteId,
  existingData,
  sectionsComplete,
  evaluations,
}: {
  athleteId: string;
  existingData: IntegratedResults | null;
  sectionsComplete: boolean;
  evaluations: Evaluations;
}) {
  const d = existingData;

  const [fields, setFields] = useState<Fields>({
    overall_summary:          d?.overall_summary          ?? '',
    medical_summary:          d?.medical_summary          ?? '',
    nutritional_summary:      d?.nutritional_summary      ?? '',
    psychological_summary:    d?.psychological_summary    ?? '',
    sport_profile:            d?.sport_profile            ?? '',
    physiotherapy_summary:    d?.physiotherapy_summary    ?? '',
    interdisciplinary_result: d?.interdisciplinary_result ?? '',
  });

  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [autoFilled, setAutoFilled] = useState(false);
  const [aiPending, setAiPending]   = useState<'overall' | 'interdisciplinary' | null>(null);
  const [aiError, setAiError]       = useState<string | null>(null);
  const formRef                     = useRef<HTMLFormElement>(null);

  function set(key: keyof Fields) {
    return (v: string) => setFields((prev) => ({ ...prev, [key]: v }));
  }

  // Build sections payload from evaluations (reuse buildAutoFill output)
  function buildSectionsPayload() {
    const filled = buildAutoFill(evaluations);
    return {
      medical:       filled.medical_summary       ?? '',
      nutritional:   filled.nutritional_summary   ?? '',
      psychological: filled.psychological_summary ?? '',
      sport:         filled.sport_profile         ?? '',
      physiotherapy: filled.physiotherapy_summary ?? '',
    };
  }

  async function handleAIGenerate(type: 'overall' | 'interdisciplinary') {
    setAiError(null);
    setAiPending(type);
    const result = await generateAIDiagnosticText(type, buildSectionsPayload());
    setAiPending(null);
    if (result.error) { setAiError(result.error); return; }
    if (result.text) {
      const key = type === 'overall' ? 'overall_summary' : 'interdisciplinary_result';
      setFields((prev) => ({ ...prev, [key]: result.text! }));
    }
  }

  function handleAutoFill() {
    const filled = buildAutoFill(evaluations);
    setFields((prev) => ({
      ...prev,
      medical_summary:       filled.medical_summary       || prev.medical_summary,
      nutritional_summary:   filled.nutritional_summary   || prev.nutritional_summary,
      psychological_summary: filled.psychological_summary || prev.psychological_summary,
      sport_profile:         filled.sport_profile         || prev.sport_profile,
      physiotherapy_summary: filled.physiotherapy_summary || prev.physiotherapy_summary,
    }));
    setAutoFilled(true);
    setSuccess(null);
    setError(null);
  }

  function handleSubmit() {
    const formData = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await saveIntegratedResult(athleteId, formData);
      if (result.error) { setError(result.error); setSuccess(null); }
      else { setError(null); setAutoFilled(false); setSuccess('Resultado integrado guardado correctamente.'); }
    });
  }

  const hasEvalData = Object.values(evaluations).some(Boolean);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-800">Resultado Integrado Interdisciplinario</h2>
        {!sectionsComplete && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
            Completa todos los rubros para habilitar el resultado final
          </span>
        )}
      </div>

      {!sectionsComplete && (
        <div className="mb-6 rounded-md bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-800">
            <strong>Nota:</strong> Se recomienda completar todos los rubros antes de generar el resultado integrado.
            Sin embargo, puedes guardar avances parciales en cualquier momento.
          </p>
        </div>
      )}

      {/* ── Botón de pre-llenado automático ─────────────────────────── */}
      {hasEvalData && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-800">Pre-llenar desde diagnósticos capturados</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Extrae automáticamente los campos clave de Médico, Nutrición, Psicología, Entrenador y Fisioterapia.
              Puedes editarlos antes de guardar.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAutoFill}
            className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            ⟳ Pre-llenar campos
          </button>
        </div>
      )}

      {autoFilled && (
        <p className="mb-4 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          ✓ Campos pre-llenados con los datos de cada sección. Revisa y edita antes de guardar.
        </p>
      )}

      {aiError  && <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ {aiError}</p>}
      {error    && <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success  && <p className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

      {d?.generated_at && (
        <p className="text-xs text-gray-400 mb-4">
          Última generación: {new Date(d.generated_at).toLocaleString('es-MX')}
        </p>
      )}

      <form ref={formRef} className="space-y-4">
        {/* ── Resumen general + botón IA */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="block text-xs font-medium text-gray-600">Resumen general del diagnóstico inicial</label>
            {hasEvalData && (
              <button type="button" disabled={!!aiPending} onClick={() => handleAIGenerate('overall')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50">
                {aiPending === 'overall' ? <>⏳ Generando…</> : <>✨ Generar con IA</>}
              </button>
            )}
          </div>
          <textarea name="overall_summary" rows={5} value={fields.overall_summary}
            onChange={(e) => set('overall_summary')(e.target.value)}
            placeholder="Síntesis del estado integral del atleta desde todas las especialidades…"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <p className="mt-1 text-xs text-gray-400 italic">
            ℹ️ Texto generado por IA con base en los diagnósticos capturados por los profesionales de cada rama. Revisar y validar antes de guardar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Textarea label="Resumen del diagnóstico médico" name="medical_summary"
            value={fields.medical_summary} onChange={set('medical_summary')}
            placeholder="Principales hallazgos y diagnóstico del rubro médico…" />
          <Textarea label="Resumen del diagnóstico nutricional" name="nutritional_summary"
            value={fields.nutritional_summary} onChange={set('nutritional_summary')}
            placeholder="Estado nutricional y plan alimentario…" />
          <Textarea label="Resumen del diagnóstico psicológico" name="psychological_summary"
            value={fields.psychological_summary} onChange={set('psychological_summary')}
            placeholder="Estado psicológico y plan de intervención…" />
          <Textarea label="Perfil deportivo del atleta" name="sport_profile"
            value={fields.sport_profile} onChange={set('sport_profile')}
            placeholder="Perfil deportivo completo: capacidades, potencial y objetivos del entrenador…" />
        </div>

        <Textarea label="Resumen del diagnóstico fisioterapéutico" name="physiotherapy_summary"
          value={fields.physiotherapy_summary} onChange={set('physiotherapy_summary')}
          placeholder="Diagnóstico funcional y plan de rehabilitación…" />

        {/* ── Resultado integrado final + botón IA */}
        <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-emerald-800">Resultado Integrado Interdisciplinario Final</span>
            {hasEvalData && (
              <button type="button" disabled={!!aiPending} onClick={() => handleAIGenerate('interdisciplinary')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50">
                {aiPending === 'interdisciplinary' ? <>⏳ Generando…</> : <>✨ Generar con IA</>}
              </button>
            )}
          </div>
          <textarea name="interdisciplinary_result" rows={6} value={fields.interdisciplinary_result}
            onChange={(e) => set('interdisciplinary_result')(e.target.value)}
            placeholder="Conclusión interdisciplinaria: integración de todos los rubros, recomendaciones de trabajo conjunto, prioridades de atención y pronóstico de rendimiento del atleta…"
            className="w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <p className="mt-2 text-xs text-emerald-700/70 italic">
            ℹ️ Texto generado por IA con base en los diagnósticos capturados por los profesionales de cada rama. Revisar y validar antes de guardar.
          </p>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100">
          <button
            type="button"
            disabled={isPending}
            onClick={handleSubmit}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Guardando…' : 'Generar / Guardar resultado integrado'}
          </button>
        </div>
      </form>
    </div>
  );
}

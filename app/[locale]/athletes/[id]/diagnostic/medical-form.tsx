'use client';

import { useRef, useState, useTransition } from 'react';
import { saveMedicalSection } from './actions';
import type { DiagnosticStatus, MedicalEvaluation } from '@/lib/types/diagnostic';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types/diagnostic';
import PrintableFormView, { type PrintSection } from '@/components/print/PrintableFormView';

// ---------------------------------------------------------------------------
// Print data builder
// ---------------------------------------------------------------------------

const RISK_LEVEL_LABELS: Record<string, string> = {
  bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'Crítico',
};

function buildMedicalSections(d: MedicalEvaluation | null): PrintSection[] {
  if (!d) return [];
  return [
    {
      title: '1. Evaluación Antropométrica',
      fields: [
        { label: 'Peso corporal (kg)', value: d.weight_kg },
        { label: 'Talla (cm)', value: d.height_cm },
        { label: 'IMC', value: d.bmi },
        { label: '% Grasa corporal', value: d.body_fat_pct },
      ],
    },
    {
      title: '2. Evaluación de Signos Vitales',
      fields: [
        { label: 'Frecuencia cardíaca en reposo (bpm)', value: d.heart_rate_rest },
        { label: 'Presión arterial', value: d.blood_pressure },
      ],
    },
    {
      title: '3. Evaluación Cardiovascular',
      fields: [
        { label: 'Electrocardiograma en reposo', value: d.ecg_rest },
        { label: 'Electrocardiograma en esfuerzo', value: d.ecg_effort },
      ],
    },
    {
      title: '4. Evaluación Musculoesquelética y Postural',
      fields: [
        { label: 'Fuerza muscular', value: d.muscle_strength },
        { label: 'Flexibilidad', value: d.flexibility },
        { label: 'Postura', value: d.posture },
        { label: 'Integridad articular', value: d.joint_integrity },
      ],
    },
    {
      title: '5. Evaluación Funcional Básica',
      fields: [
        { label: 'Pruebas de fuerza', value: d.strength_tests },
        { label: 'Resistencia', value: d.resistance_tests },
        { label: 'Flexibilidad (funcional)', value: d.flexibility_tests },
        { label: 'Equilibrio y coordinación', value: d.balance_coordination },
      ],
    },
    {
      title: '6. Antecedentes de Lesiones',
      fields: [
        { label: 'Historial de lesiones (tipo, gravedad, recurrencia, tratamiento, secuelas)', value: d.injury_history },
      ],
    },
    {
      title: '7. Resultados',
      fields: [
        { label: 'Informe de resultados integrados', value: d.clinical_result },
        { label: 'Emisión de diagnóstico', value: d.diagnosis },
      ],
    },
    {
      title: '8. Detección de Factores de Riesgo',
      fields: [
        { label: 'Valoración del historial de lesiones (musculares, ligamentarias, fracturas, tendinopatías)', value: d.injury_risk_factors },
        { label: 'Condiciones médicas relevantes (cardiovasculares, respiratorias, metabólicas)', value: d.medical_conditions },
      ],
    },
    {
      title: '9. Integración Diagnóstica',
      fields: [
        { label: 'Correlación de historia clínica, exploración, estudios y estudios de gabinete', value: d.diagnostic_integration },
        { label: 'Nivel de riesgo', value: d.risk_level ? (RISK_LEVEL_LABELS[d.risk_level] ?? d.risk_level) : null },
        { label: 'Prioridades de atención', value: d.care_priorities },
      ],
    },
    {
      title: '10. Plan Médico Individual del Atleta (PMIA)',
      fields: [
        { label: 'Plan de prevención de lesiones', value: d.injury_prevention_plan },
        { label: 'Recomendaciones médicas individualizadas', value: d.medical_recommendations },
        { label: 'Control nutricional y coordinación interdisciplinaria', value: d.nutritional_coordination },
        { label: 'Estrategias de recuperación', value: d.recovery_strategies },
        { label: 'Control de cargas de entrenamiento', value: d.training_load_control },
        { label: 'Programación de seguimiento médico', value: d.follow_up_schedule },
      ],
    },
    {
      title: '11. Monitoreo Continuo del Estado de Salud',
      fields: [
        { label: 'Notas de monitoreo (lesiones deportivas, evaluación en entrenamientos, ajustes de tratamiento)', value: d.monitoring_notes },
      ],
    },
    {
      title: 'Observaciones Generales',
      fields: [
        { label: 'Observaciones', value: d.observations },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-6 first:mt-0 pb-1 border-b border-gray-100">
      {children}
    </h3>
  );
}

function InputField({
  label, name, type = 'text', defaultValue, placeholder, step,
}: {
  label: string; name: string; type?: string;
  defaultValue?: string | number | null; placeholder?: string; step?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-0.5">{label}</label>
      <input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue?.toString() ?? ''}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}

function Textarea({
  label, name, defaultValue, placeholder, rows = 3,
}: {
  label: string; name: string; defaultValue?: string | null; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-0.5">{label}</label>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export default function MedicalForm({
  athleteId,
  sectionStatus,
  existingData,
}: {
  athleteId: string;
  sectionStatus: DiagnosticStatus;
  existingData: MedicalEvaluation | null;
}) {
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef                     = useRef<HTMLFormElement>(null);

  function handleSave(complete: boolean) {
    const formData = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await saveMedicalSection(athleteId, complete, formData);
      if (result.error) {
        setError(result.error);
        setSuccess(null);
      } else {
        setError(null);
        setSuccess(complete ? 'Rubro marcado como completo.' : 'Borrador guardado correctamente.');
      }
    });
  }

  const d = existingData;
  const isComplete = sectionStatus === 'completo';

  return (
    <div>
      {/* Header del rubro — screen only */}
      <div className="flex items-center justify-between mb-5 print:hidden">
        <h2 className="text-lg font-bold text-gray-800">Rubro Médico</h2>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[sectionStatus]}`}>
          {STATUS_LABELS[sectionStatus]}
        </span>
      </div>

      {error   && <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">{error}</p>}
      {success && <p className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 print:hidden">{success}</p>}

      {/* Editable form — hidden when printing */}
      <form ref={formRef} className="print:hidden">
        {/* 1. Historia Clínica Deportiva — Evaluación Antropométrica */}
        <SectionTitle>1. Evaluación Antropométrica</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <InputField label="Peso corporal (kg)" name="weight_kg" type="number" step="0.1" defaultValue={d?.weight_kg} placeholder="ej. 72.5" />
          <InputField label="Talla (cm)" name="height_cm" type="number" step="0.1" defaultValue={d?.height_cm} placeholder="ej. 175.0" />
          <InputField label="IMC" name="bmi" type="number" step="0.1" defaultValue={d?.bmi} placeholder="ej. 23.6" />
          <InputField label="% Grasa corporal" name="body_fat_pct" type="number" step="0.1" defaultValue={d?.body_fat_pct} placeholder="ej. 15.2" />
        </div>

        {/* 2. Signos Vitales */}
        <SectionTitle>2. Evaluación de Signos Vitales</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <InputField label="Frecuencia cardíaca en reposo (bpm)" name="heart_rate_rest" type="number" defaultValue={d?.heart_rate_rest} placeholder="ej. 62" />
          <InputField label="Presión arterial" name="blood_pressure" defaultValue={d?.blood_pressure} placeholder="ej. 120/80 mmHg" />
        </div>

        {/* 3. Evaluación Cardiovascular */}
        <SectionTitle>3. Evaluación Cardiovascular</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Electrocardiograma en reposo" name="ecg_rest" defaultValue={d?.ecg_rest} placeholder="Hallazgos ECG en reposo…" />
          <Textarea label="Electrocardiograma en esfuerzo" name="ecg_effort" defaultValue={d?.ecg_effort} placeholder="Hallazgos ECG en esfuerzo…" />
        </div>

        {/* 4. Evaluación Musculoesquelética y Postural */}
        <SectionTitle>4. Evaluación Musculoesquelética y Postural</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Fuerza muscular" name="muscle_strength" defaultValue={d?.muscle_strength} placeholder="Valoración de fuerza…" />
          <Textarea label="Flexibilidad" name="flexibility" defaultValue={d?.flexibility} placeholder="Valoración de flexibilidad…" />
          <Textarea label="Postura" name="posture" defaultValue={d?.posture} placeholder="Análisis postural…" />
          <Textarea label="Integridad articular" name="joint_integrity" defaultValue={d?.joint_integrity} placeholder="Pruebas de integridad articular…" />
        </div>

        {/* 5. Evaluación Funcional */}
        <SectionTitle>5. Evaluación Funcional Básica</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Pruebas de fuerza" name="strength_tests" defaultValue={d?.strength_tests} placeholder="Resultados de pruebas de fuerza…" />
          <Textarea label="Resistencia" name="resistance_tests" defaultValue={d?.resistance_tests} placeholder="Resultados de pruebas de resistencia…" />
          <Textarea label="Flexibilidad (funcional)" name="flexibility_tests" defaultValue={d?.flexibility_tests} placeholder="Resultados de pruebas de flexibilidad funcional…" />
          <Textarea label="Equilibrio y coordinación" name="balance_coordination" defaultValue={d?.balance_coordination} placeholder="Resultados de equilibrio y coordinación…" />
        </div>

        {/* 6. Antecedentes de Lesiones */}
        <SectionTitle>6. Antecedentes de Lesiones</SectionTitle>
        <Textarea
          label="Historial de lesiones (tipo, gravedad, recurrencia, tratamiento, secuelas)"
          name="injury_history"
          defaultValue={d?.injury_history}
          placeholder="Describir lesiones previas relevantes: tipo, gravedad, tratamiento recibido y secuelas actuales…"
          rows={4}
        />

        {/* 7. Resultados */}
        <SectionTitle>7. Resultados</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Informe de resultados integrados" name="clinical_result" defaultValue={d?.clinical_result} placeholder="Informe con información clínica, funcional y deportiva…" rows={4} />
          <Textarea label="Emisión de diagnóstico" name="diagnosis" defaultValue={d?.diagnosis} placeholder="Diagnóstico médico inicial…" rows={4} />
        </div>

        {/* 8. Factores de Riesgo */}
        <SectionTitle>8. Detección de Factores de Riesgo</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Valoración del historial de lesiones (musculares, ligamentarias, fracturas, tendinopatías)" name="injury_risk_factors" defaultValue={d?.injury_risk_factors} placeholder="Factores de riesgo por historial de lesiones…" rows={3} />
          <Textarea label="Condiciones médicas relevantes (cardiovasculares, respiratorias, metabólicas)" name="medical_conditions" defaultValue={d?.medical_conditions} placeholder="Condiciones médicas relevantes detectadas…" rows={3} />
        </div>

        {/* 9. Integración Diagnóstica */}
        <SectionTitle>9. Integración Diagnóstica</SectionTitle>
        <div className="space-y-3">
          <Textarea label="Correlación de historia clínica, exploración, estudios y estudios de gabinete" name="diagnostic_integration" defaultValue={d?.diagnostic_integration} placeholder="Integración diagnóstica interdisciplinaria…" rows={4} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Nivel de riesgo</label>
              <select
                name="risk_level"
                defaultValue={d?.risk_level ?? ''}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Seleccionar…</option>
                <option value="bajo">Bajo</option>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
                <option value="critico">Crítico</option>
              </select>
            </div>
            <Textarea label="Prioridades de atención" name="care_priorities" defaultValue={d?.care_priorities} placeholder="Áreas y condiciones prioritarias…" />
          </div>
        </div>

        {/* 10. Plan Médico Individual */}
        <SectionTitle>10. Plan Médico Individual del Atleta (PMIA)</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Plan de prevención de lesiones" name="injury_prevention_plan" defaultValue={d?.injury_prevention_plan} placeholder="Estrategias preventivas individualizadas…" />
          <Textarea label="Recomendaciones médicas individualizadas" name="medical_recommendations" defaultValue={d?.medical_recommendations} placeholder="Recomendaciones específicas…" />
          <Textarea label="Control nutricional y coordinación interdisciplinaria" name="nutritional_coordination" defaultValue={d?.nutritional_coordination} placeholder="Coordinación con nutrición…" />
          <Textarea label="Estrategias de recuperación" name="recovery_strategies" defaultValue={d?.recovery_strategies} placeholder="Protocolos de recuperación…" />
          <Textarea label="Control de cargas de entrenamiento" name="training_load_control" defaultValue={d?.training_load_control} placeholder="Criterios de carga segura…" />
          <Textarea label="Programación de seguimiento médico" name="follow_up_schedule" defaultValue={d?.follow_up_schedule} placeholder="Calendario de revisiones médicas…" />
        </div>

        {/* 11. Monitoreo continuo */}
        <SectionTitle>11. Monitoreo Continuo del Estado de Salud</SectionTitle>
        <Textarea
          label="Notas de monitoreo (lesiones deportivas, evaluación en entrenamientos, ajustes de tratamiento)"
          name="monitoring_notes"
          defaultValue={d?.monitoring_notes}
          placeholder="Notas de monitoreo continuo y asesoría al entrenador…"
          rows={3}
        />

        {/* Observaciones */}
        <SectionTitle>Observaciones Generales</SectionTitle>
        <Textarea
          label="Observaciones"
          name="observations"
          defaultValue={d?.observations}
          placeholder="Observaciones adicionales del equipo médico…"
          rows={3}
        />

        {/* Botones */}
        <div className="flex flex-wrap gap-3 pt-6 border-t border-gray-100 mt-6 print:hidden">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSave(false)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button
            type="button"
            disabled={isPending || isComplete}
            onClick={() => handleSave(true)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {isComplete ? 'Rubro completado ✓' : isPending ? 'Guardando…' : 'Marcar como completo'}
          </button>
          {isComplete && (
            <button
              type="button"
              onClick={() => window.print()}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir PDF
            </button>
          )}
        </div>
      </form>

      {/* Print-only clean document view */}
      <PrintableFormView
        formTitle="Evaluación Médica — Diagnóstico Inicial"
        sections={buildMedicalSections(d)}
      />
    </div>
  );
}

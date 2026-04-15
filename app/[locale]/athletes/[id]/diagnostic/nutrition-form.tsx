'use client';

import { useRef, useState, useTransition } from 'react';
import { saveNutritionSection } from './actions';
import type { DiagnosticStatus, NutritionEvaluation } from '@/lib/types/diagnostic';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types/diagnostic';
import PrintableFormView, { type PrintSection } from '@/components/print/PrintableFormView';

function buildNutritionSections(d: NutritionEvaluation | null): PrintSection[] {
  if (!d) return [];
  return [
    {
      title: '1. Historia Clínica',
      fields: [
        { label: 'Antecedentes médicos', value: d.medical_antecedents },
        { label: 'Antecedentes heredofamiliares / patológicos / no patológicos', value: d.heredofamilial_antecedents },
      ],
    },
    {
      title: '2. Evaluación Antropométrica',
      fields: [
        { label: 'Talla (cm)', value: d.height_cm },
        { label: 'Pliegues cutáneos', value: d.skinfolds },
        { label: 'Composición corporal', value: d.body_composition },
      ],
    },
    {
      title: '3. Evaluación Dietética',
      fields: [
        { label: 'Consumo alimentario (recordatorio 24h / frecuencia)', value: d.food_intake },
        { label: 'Datos cuantitativos (calorías, macronutrientes)', value: d.quantitative_data },
        { label: 'Datos cualitativos (calidad de la dieta)', value: d.qualitative_data },
      ],
    },
    {
      title: '4. Gasto Energético',
      fields: [
        { label: 'Cálculo del gasto energético total', value: d.energy_expenditure },
        { label: 'Cálculo de porcentajes de macronutrientes', value: d.calorie_percentages },
      ],
    },
    {
      title: '5. Integración Clínica y Metabólica',
      fields: [
        { label: 'Consolidación de resultados antropométricos, clínicos y metabólicos', value: d.clinical_metabolic_integration },
      ],
    },
    {
      title: '6. Diagnóstico Integral del Estado Nutricional',
      fields: [
        { label: 'Resultados cualitativos', value: d.qualitative_results },
        { label: 'Resultados cuantitativos', value: d.quantitative_results },
        { label: 'Diagnóstico nutricional', value: d.nutritional_diagnosis },
      ],
    },
    {
      title: '7. Plan Alimentario Personalizado',
      fields: [
        { label: 'Esquema de alimentación personalizado', value: d.food_plan },
        { label: 'Requerimientos energéticos individualizados', value: d.energy_requirements },
        { label: 'Objetivos deportivos específicos', value: d.sport_objectives },
        { label: 'Características individuales del atleta', value: d.individual_characteristics },
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

function InputField({ label, name, type = 'text', defaultValue, placeholder, step }: {
  label: string; name: string; type?: string; defaultValue?: string | number | null; placeholder?: string; step?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-0.5">{label}</label>
      <input name={name} type={type} step={step} defaultValue={defaultValue?.toString() ?? ''} placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
    </div>
  );
}

export default function NutritionForm({
  athleteId, sectionStatus, existingData,
}: { athleteId: string; sectionStatus: DiagnosticStatus; existingData: NutritionEvaluation | null; }) {
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef                     = useRef<HTMLFormElement>(null);
  const d                           = existingData;
  const isComplete                  = sectionStatus === 'completo';

  function handleSave(complete: boolean) {
    const formData = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await saveNutritionSection(athleteId, complete, formData);
      if (result.error) { setError(result.error); setSuccess(null); }
      else { setError(null); setSuccess(complete ? 'Rubro marcado como completo.' : 'Borrador guardado correctamente.'); }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 print:hidden">
        <h2 className="text-lg font-bold text-gray-800">Rubro Nutrición</h2>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[sectionStatus]}`}>
          {STATUS_LABELS[sectionStatus]}
        </span>
      </div>
      {error   && <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">{error}</p>}
      {success && <p className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 print:hidden">{success}</p>}

      <form ref={formRef} className="print:hidden">
        <SectionTitle>1. Historia Clínica</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Antecedentes médicos" name="medical_antecedents" defaultValue={d?.medical_antecedents} placeholder="Enfermedades previas, condiciones crónicas…" />
          <Textarea label="Antecedentes heredofamiliares / patológicos / no patológicos" name="heredofamilial_antecedents" defaultValue={d?.heredofamilial_antecedents} placeholder="Antecedentes familiares relevantes…" />
        </div>

        <SectionTitle>2. Evaluación Antropométrica</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <InputField label="Talla (cm)" name="height_cm" type="number" step="0.1" defaultValue={d?.height_cm} placeholder="ej. 175.0" />
          <Textarea label="Pliegues cutáneos" name="skinfolds" defaultValue={d?.skinfolds} placeholder="Valores de pliegues medidos…" />
          <Textarea label="Composición corporal" name="body_composition" defaultValue={d?.body_composition} placeholder="Masa magra, grasa, agua…" />
        </div>

        <SectionTitle>3. Evaluación Dietética</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Consumo alimentario (recordatorio 24h / frecuencia)" name="food_intake" defaultValue={d?.food_intake} placeholder="Descripción del patrón alimentario…" rows={4} />
          <div className="space-y-3">
            <Textarea label="Datos cuantitativos (calorías, macronutrientes)" name="quantitative_data" defaultValue={d?.quantitative_data} placeholder="Kcal, proteínas, carbohidratos, grasas…" />
            <Textarea label="Datos cualitativos (calidad de la dieta)" name="qualitative_data" defaultValue={d?.qualitative_data} placeholder="Variedad, adecuación, hábitos…" />
          </div>
        </div>

        <SectionTitle>4. Gasto Energético</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Cálculo del gasto energético total" name="energy_expenditure" defaultValue={d?.energy_expenditure} placeholder="TMB, GET, factor de actividad…" />
          <Textarea label="Cálculo de porcentajes de macronutrientes" name="calorie_percentages" defaultValue={d?.calorie_percentages} placeholder="% CHO, % proteína, % grasa…" />
        </div>

        <SectionTitle>5. Integración Clínica y Metabólica</SectionTitle>
        <Textarea label="Consolidación de resultados antropométricos, clínicos y metabólicos" name="clinical_metabolic_integration"
          defaultValue={d?.clinical_metabolic_integration} placeholder="Integración de todos los datos nutricionales…" rows={4} />

        <SectionTitle>6. Diagnóstico Integral del Estado Nutricional</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Resultados cualitativos" name="qualitative_results" defaultValue={d?.qualitative_results} placeholder="Descripción del estado nutricional…" rows={3} />
          <Textarea label="Resultados cuantitativos" name="quantitative_results" defaultValue={d?.quantitative_results} placeholder="Valores medidos y rangos de referencia…" rows={3} />
        </div>
        <Textarea label="Diagnóstico nutricional" name="nutritional_diagnosis" defaultValue={d?.nutritional_diagnosis}
          placeholder="Diagnóstico integral del estado nutricional del atleta…" rows={3} />

        <SectionTitle>7. Plan Alimentario Personalizado</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Esquema de alimentación personalizado" name="food_plan" defaultValue={d?.food_plan}
            placeholder="Distribución de comidas, alimentos recomendados…" rows={4} />
          <div className="space-y-3">
            <Textarea label="Requerimientos energéticos individualizados" name="energy_requirements" defaultValue={d?.energy_requirements} placeholder="Cálculo personalizado de requerimientos…" />
            <Textarea label="Objetivos deportivos específicos" name="sport_objectives" defaultValue={d?.sport_objectives} placeholder="Metas nutricionales según deporte y etapa…" />
            <Textarea label="Características individuales del atleta" name="individual_characteristics" defaultValue={d?.individual_characteristics} placeholder="Preferencias, intolerancias, condición física…" />
          </div>
        </div>

        <SectionTitle>Observaciones Generales</SectionTitle>
        <Textarea label="Observaciones" name="observations" defaultValue={d?.observations}
          placeholder="Observaciones adicionales del nutricionista…" rows={3} />

        <div className="flex flex-wrap gap-3 pt-6 border-t border-gray-100 mt-6 print:hidden">
          <button type="button" disabled={isPending} onClick={() => handleSave(false)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            {isPending ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button type="button" disabled={isPending || isComplete} onClick={() => handleSave(true)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {isComplete ? 'Rubro completado ✓' : isPending ? 'Guardando…' : 'Marcar como completo'}
          </button>
          {isComplete && (
            <button type="button" onClick={() => window.print()}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir PDF
            </button>
          )}
        </div>
      </form>

      <PrintableFormView
        formTitle="Evaluación Nutricional — Diagnóstico Inicial"
        sections={buildNutritionSections(d)}
      />
    </div>
  );
}

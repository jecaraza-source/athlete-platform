'use client';

import { useRef, useState, useTransition } from 'react';
import { savePhysioSection } from './actions';
import type { DiagnosticStatus, PhysioEvaluation } from '@/lib/types/diagnostic';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types/diagnostic';
import PrintableFormView, { type PrintSection } from '@/components/print/PrintableFormView';

function buildPhysioSections(d: PhysioEvaluation | null): PrintSection[] {
  if (!d) return [];
  return [
    {
      title: '1. Historia Clínica Fisioterapéutica',
      fields: [
        { label: 'Antecedentes deportivos', value: d.sport_antecedents },
        { label: 'Lesiones previas', value: d.previous_injuries },
        { label: 'Síntomas actuales', value: d.current_symptoms },
        { label: 'Cargas de entrenamiento', value: d.training_loads },
        { label: 'Factores médicos relevantes', value: d.relevant_medical_factors },
      ],
    },
    {
      title: '2. Evaluación Postural',
      fields: [
        { label: 'Vista anterior', value: d.postural_anterior },
        { label: 'Vista lateral', value: d.postural_lateral },
        { label: 'Vista posterior', value: d.postural_posterior },
      ],
    },
    {
      title: '3. Análisis de Movilidad Articular y Fuerza',
      fields: [
        { label: 'Rango de movimiento de las articulaciones', value: d.joint_range_of_motion },
        { label: 'Pruebas de fuerza muscular', value: d.strength_tests },
        { label: 'Capacidad contráctil', value: d.contractile_capacity },
        { label: 'Rendimiento de grupos musculares', value: d.muscle_group_performance },
      ],
    },
    {
      title: '4. Diagnóstico Funcional Individual',
      fields: [
        { label: 'Desbalances musculares', value: d.muscle_imbalances },
        { label: 'Limitaciones articulares', value: d.joint_limitations },
        { label: 'Alteraciones biomecánicas', value: d.biomechanical_alterations },
        { label: 'Riesgo de lesión', value: d.injury_risk },
        { label: 'Diagnóstico funcional integrado', value: d.functional_diagnosis },
      ],
    },
    {
      title: '5. Intervención por Disciplina',
      fields: [
        { label: 'Plan de intervención fisioterapéutica específica para la disciplina', value: d.discipline_intervention },
      ],
    },
    {
      title: '6. Plan de Rehabilitación Individual',
      fields: [
        { label: 'Terapia manual', value: d.manual_therapy },
        { label: 'Fortalecimiento específico', value: d.specific_strengthening },
        { label: 'Reeducación neuromuscular', value: d.neuromuscular_reeducation },
        { label: 'Ejercicios de movilidad', value: d.mobility_exercises },
        { label: 'Prevención de recaídas', value: d.relapse_prevention },
      ],
    },
    {
      title: '7. Métodos de Rehabilitación',
      fields: [
        { label: 'Liberación miofascial', value: d.myofascial_release },
        { label: 'Movilización articular', value: d.joint_mobilization },
        { label: 'Masaje deportivo', value: d.sports_massage },
        { label: 'TENS (Electroestimulación transcutánea)', value: d.tens_electrotherapy },
        { label: 'Ultrasonido terapéutico', value: d.therapeutic_ultrasound },
        { label: 'Electroestimulación muscular', value: d.muscle_electrostimulation },
        { label: 'Ejercicio terapéutico (fortalecimiento, estabilización, control neuromuscular, readaptación deportiva)', value: d.therapeutic_exercise },
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

export default function PhysioForm({
  athleteId, sectionStatus, existingData,
}: { athleteId: string; sectionStatus: DiagnosticStatus; existingData: PhysioEvaluation | null; }) {
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef                     = useRef<HTMLFormElement>(null);
  const d                           = existingData;
  const isComplete                  = sectionStatus === 'completo';

  function handleSave(complete: boolean) {
    const formData = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await savePhysioSection(athleteId, complete, formData);
      if (result.error) { setError(result.error); setSuccess(null); }
      else { setError(null); setSuccess(complete ? 'Rubro marcado como completo.' : 'Borrador guardado correctamente.'); }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 print:hidden">
        <h2 className="text-lg font-bold text-gray-800">Rubro Fisioterapia</h2>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[sectionStatus]}`}>
          {STATUS_LABELS[sectionStatus]}
        </span>
      </div>
      {error   && <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">{error}</p>}
      {success && <p className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 print:hidden">{success}</p>}

      <form ref={formRef} className="print:hidden">
        <SectionTitle>1. Historia Clínica Fisioterapéutica</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Antecedentes deportivos" name="sport_antecedents" defaultValue={d?.sport_antecedents} placeholder="Historial deportivo relevante…" />
          <Textarea label="Lesiones previas" name="previous_injuries" defaultValue={d?.previous_injuries} placeholder="Tipo, fecha, tratamiento y secuelas de lesiones previas…" />
          <Textarea label="Síntomas actuales" name="current_symptoms" defaultValue={d?.current_symptoms} placeholder="Molestias o síntomas reportados actualmente…" />
          <Textarea label="Cargas de entrenamiento" name="training_loads" defaultValue={d?.training_loads} placeholder="Volumen, intensidad y frecuencia de entrenamiento actual…" />
        </div>
        <Textarea label="Factores médicos relevantes" name="relevant_medical_factors" defaultValue={d?.relevant_medical_factors}
          placeholder="Condiciones médicas que influyen en la fisioterapia…" rows={2} />

        <SectionTitle>2. Evaluación Postural</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Textarea label="Vista anterior" name="postural_anterior" defaultValue={d?.postural_anterior} placeholder="Hallazgos en vista anterior…" />
          <Textarea label="Vista lateral" name="postural_lateral" defaultValue={d?.postural_lateral} placeholder="Hallazgos en vista lateral…" />
          <Textarea label="Vista posterior" name="postural_posterior" defaultValue={d?.postural_posterior} placeholder="Hallazgos en vista posterior…" />
        </div>

        <SectionTitle>3. Análisis de Movilidad Articular y Fuerza</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Rango de movimiento de las articulaciones" name="joint_range_of_motion" defaultValue={d?.joint_range_of_motion}
            placeholder="ROM de principales articulaciones en grados…" />
          <Textarea label="Pruebas de fuerza muscular" name="strength_tests" defaultValue={d?.strength_tests} placeholder="Resultados de pruebas de fuerza…" />
          <Textarea label="Capacidad contráctil" name="contractile_capacity" defaultValue={d?.contractile_capacity} placeholder="Evaluación de la capacidad contráctil muscular…" />
          <Textarea label="Rendimiento de grupos musculares" name="muscle_group_performance" defaultValue={d?.muscle_group_performance}
            placeholder="Desempeño de grupos musculares clave…" />
        </div>

        <SectionTitle>4. Diagnóstico Funcional Individual</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Desbalances musculares" name="muscle_imbalances" defaultValue={d?.muscle_imbalances} placeholder="Identificación de desbalances musculares…" />
          <Textarea label="Limitaciones articulares" name="joint_limitations" defaultValue={d?.joint_limitations} placeholder="Articulaciones con limitaciones de movimiento…" />
          <Textarea label="Alteraciones biomecánicas" name="biomechanical_alterations" defaultValue={d?.biomechanical_alterations}
            placeholder="Patrones de movimiento alterados…" />
          <Textarea label="Riesgo de lesión" name="injury_risk" defaultValue={d?.injury_risk} placeholder="Nivel y factores de riesgo de lesión…" />
        </div>
        <Textarea label="Diagnóstico funcional integrado" name="functional_diagnosis" defaultValue={d?.functional_diagnosis}
          placeholder="Diagnóstico fisioterapéutico completo e integrado…" rows={4} />

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
        <Textarea label="Plan de intervención fisioterapéutica específica para la disciplina" name="discipline_intervention"
          defaultValue={d?.discipline_intervention}
          placeholder="Intervenciones específicas según la disciplina del atleta y sus demandas biomecánicas…" rows={4} />

        <SectionTitle>6. Plan de Rehabilitación Individual</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Terapia manual" name="manual_therapy" defaultValue={d?.manual_therapy} placeholder="Técnicas de terapia manual aplicadas…" />
          <Textarea label="Fortalecimiento específico" name="specific_strengthening" defaultValue={d?.specific_strengthening} placeholder="Programa de fortalecimiento muscular…" />
          <Textarea label="Reeducación neuromuscular" name="neuromuscular_reeducation" defaultValue={d?.neuromuscular_reeducation} placeholder="Ejercicios de control motor y coordinación…" />
          <Textarea label="Ejercicios de movilidad" name="mobility_exercises" defaultValue={d?.mobility_exercises} placeholder="Programa de mejora de movilidad…" />
        </div>
        <Textarea label="Prevención de recaídas" name="relapse_prevention" defaultValue={d?.relapse_prevention}
          placeholder="Estrategias para prevenir recurrencia de lesiones…" rows={3} />

        <SectionTitle>7. Métodos de Rehabilitación</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Liberación miofascial" name="myofascial_release" defaultValue={d?.myofascial_release} placeholder="Técnicas y zonas de liberación miofascial…" />
          <Textarea label="Movilización articular" name="joint_mobilization" defaultValue={d?.joint_mobilization} placeholder="Técnicas de movilización articular…" />
          <Textarea label="Masaje deportivo" name="sports_massage" defaultValue={d?.sports_massage} placeholder="Protocolo de masaje deportivo…" />
          <Textarea label="TENS (Electroestimulación transcutánea)" name="tens_electrotherapy" defaultValue={d?.tens_electrotherapy} placeholder="Protocolo TENS aplicado…" />
          <Textarea label="Ultrasonido terapéutico" name="therapeutic_ultrasound" defaultValue={d?.therapeutic_ultrasound} placeholder="Parámetros y zonas de ultrasonido…" />
          <Textarea label="Electroestimulación muscular" name="muscle_electrostimulation" defaultValue={d?.muscle_electrostimulation} placeholder="Protocolo de electroestimulación…" />
        </div>
        <Textarea label="Ejercicio terapéutico (fortalecimiento, estabilización, control neuromuscular, readaptación deportiva)"
          name="therapeutic_exercise" defaultValue={d?.therapeutic_exercise}
          placeholder="Programa de ejercicio terapéutico: series, repeticiones, progresión y ejercicios específicos por disciplina…" rows={4} />

        <SectionTitle>Observaciones Generales</SectionTitle>
        <Textarea label="Observaciones" name="observations" defaultValue={d?.observations}
          placeholder="Observaciones adicionales del fisioterapeuta…" rows={3} />

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
        formTitle="Evaluación Fisioterapéutica — Diagnóstico Inicial"
        sections={buildPhysioSections(d)}
      />
    </div>
  );
}

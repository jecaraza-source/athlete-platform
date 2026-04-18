'use client';

import { useState, type ReactNode } from 'react';
import {
  SECTION_KEYS,
  SECTION_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_DOT,
  getDisciplineLabel,
  getDisabilityLabel,
  type DiagnosticSectionKey,
  type DiagnosticStatus,
  type AthleteInitialDiagnostic,
  type AthleteSection,
  type MedicalEvaluation,
  type NutritionEvaluation,
  type PsychologyEvaluation,
  type CoachEvaluation,
  type PhysioEvaluation,
  type IntegratedResults,
} from '@/lib/types/diagnostic';
import MedicalForm from './medical-form';
import NutritionForm from './nutrition-form';
import PsychologyForm from './psychology-form';
import CoachForm from './coach-form';
import PhysioForm from './physio-form';
import IntegratedResultForm from './integrated-result-form';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Athlete = {
  id: string;
  first_name: string;
  last_name: string;
  discipline: string | null;
  disability_status: string | null;
  status: string;
};

type Evaluations = {
  medico:       MedicalEvaluation | null;
  nutricion:    NutritionEvaluation | null;
  psicologia:   PsychologyEvaluation | null;
  entrenador:   CoachEvaluation | null;
  fisioterapia: PhysioEvaluation | null;
};

type Props = {
  athlete:           Athlete;
  diagnostic:        AthleteInitialDiagnostic | null;
  sections:          AthleteSection[];
  evaluations:       Evaluations;
  integratedResults: IntegratedResults | null;
  /** Panel de documentos pre-renderizado por el Server Component padre para cada rubro */
  attachmentPanels?: Partial<Record<DiagnosticSectionKey, ReactNode>>;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: DiagnosticStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function SectionCard({
  section,
  status,
  active,
  onClick,
}: {
  section: DiagnosticSectionKey;
  status: DiagnosticStatus;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 text-center transition-all cursor-pointer ${
        active
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <span className={`w-3 h-3 rounded-full ${STATUS_DOT[status]}`} />
      <span className={`text-xs font-semibold ${active ? 'text-emerald-700' : 'text-gray-700'}`}>
        {SECTION_LABELS[section]}
      </span>
      <span className={`text-xs ${STATUS_COLORS[status]} px-1.5 py-0.5 rounded-full border`}>
        {STATUS_LABELS[status]}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DiagnosticTabs({
  athlete,
  diagnostic,
  sections,
  evaluations,
  integratedResults,
  attachmentPanels = {},
}: Props) {
  type TabKey = DiagnosticSectionKey | 'resultado_integrado';
  const [activeTab, setActiveTab] = useState<TabKey>('medico');

  const sectionMap = Object.fromEntries(sections.map((s) => [s.section, s])) as Record<
    DiagnosticSectionKey,
    AthleteSection | undefined
  >;

  const overallStatus: DiagnosticStatus = (diagnostic?.overall_status as DiagnosticStatus) ?? 'pendiente';
  const completionPct = diagnostic?.completion_pct ?? 0;
  const isComplete = overallStatus === 'completo';

  return (
    <div className="mt-4">
      {/* ── Header del atleta ──────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-emerald-700">Diagnóstico Inicial Integral</h1>
            <p className="text-xl text-gray-800 font-medium mt-0.5">
              {athlete.first_name} {athlete.last_name}
            </p>
            <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-gray-500">
              <span>Disciplina: <strong className="text-gray-700">{getDisciplineLabel(athlete.discipline)}</strong></span>
              <span>·</span>
              <span>{getDisabilityLabel(athlete.disability_status)}</span>
            </div>
          </div>
          <StatusBadge status={overallStatus} />
        </div>
      </div>

      {/* ── Barra de progreso global ───────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Avance total del diagnóstico</span>
          <span className="text-sm font-bold text-emerald-700">{completionPct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              isComplete ? 'bg-green-500' : completionPct > 0 ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-400">
          <span>0%</span>
          <span>100% — Diagnóstico completo</span>
        </div>
        {!isComplete && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-1.5 border border-amber-200">
            ⚠ El atleta no estará completamente activo hasta que el diagnóstico inicial esté capturado o marcado con estatus definido en todos los rubros.
          </p>
        )}
      </div>

      {/* ── Tarjetas semáforo por sección ──────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6 print:hidden">
        {SECTION_KEYS.map((section) => (
          <SectionCard
            key={section}
            section={section}
            status={(sectionMap[section]?.status as DiagnosticStatus) ?? 'pendiente'}
            active={activeTab === section}
            onClick={() => setActiveTab(section)}
          />
        ))}
      </div>

      {/* ── Botones de navegación de tabs ─────────────────────────── */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 pb-px print:hidden">
        {SECTION_KEYS.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => setActiveTab(section)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              activeTab === section
                ? 'bg-white border border-b-white border-gray-200 text-emerald-700 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {SECTION_LABELS[section]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setActiveTab('resultado_integrado')}
          className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
            activeTab === 'resultado_integrado'
              ? 'bg-white border border-b-white border-gray-200 text-emerald-700 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Resultado Integrado
        </button>
      </div>

      {/* ── Formulario activo ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
        {activeTab === 'medico' && (
          <>
            <MedicalForm
              athleteId={athlete.id}
              sectionStatus={(sectionMap['medico']?.status as DiagnosticStatus) ?? 'pendiente'}
              existingData={evaluations.medico}
            />
            {attachmentPanels['medico']}
          </>
        )}
        {activeTab === 'nutricion' && (
          <>
            <NutritionForm
              athleteId={athlete.id}
              sectionStatus={(sectionMap['nutricion']?.status as DiagnosticStatus) ?? 'pendiente'}
              existingData={evaluations.nutricion}
            />
            {attachmentPanels['nutricion']}
          </>
        )}
        {activeTab === 'psicologia' && (
          <>
            <PsychologyForm
              athleteId={athlete.id}
              sectionStatus={(sectionMap['psicologia']?.status as DiagnosticStatus) ?? 'pendiente'}
              existingData={evaluations.psicologia}
            />
            {attachmentPanels['psicologia']}
          </>
        )}
        {activeTab === 'entrenador' && (
          <>
            <CoachForm
              athleteId={athlete.id}
              sectionStatus={(sectionMap['entrenador']?.status as DiagnosticStatus) ?? 'pendiente'}
              existingData={evaluations.entrenador}
            />
            {attachmentPanels['entrenador']}
          </>
        )}
        {activeTab === 'fisioterapia' && (
          <>
            <PhysioForm
              athleteId={athlete.id}
              sectionStatus={(sectionMap['fisioterapia']?.status as DiagnosticStatus) ?? 'pendiente'}
              existingData={evaluations.fisioterapia}
            />
            {attachmentPanels['fisioterapia']}
          </>
        )}
        {activeTab === 'resultado_integrado' && (
          <IntegratedResultForm
            athleteId={athlete.id}
            existingData={integratedResults}
            sectionsComplete={isComplete}
          />
        )}
      </div>
    </div>
  );
}

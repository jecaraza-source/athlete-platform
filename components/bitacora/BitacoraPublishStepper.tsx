import Link from 'next/link';
import { computePublishSteps } from '@/lib/bitacora/stepper-logic';
import type { ActivityWithRelations } from '@/lib/types/bitacora';

// =============================================================================
// BitacoraPublishStepper
// Server Component — muestra el progreso de los 6 pasos del flujo editorial
// de la Revista AO. Se re-renderiza con router.refresh() desde los componentes
// cliente (NarrativeReviewPanel, PhotoUploader, ActivityAdminForm).
// La lógica de cálculo de pasos vive en lib/bitacora/stepper-logic.ts.
// =============================================================================

interface Props {
  activity: ActivityWithRelations;
  locale:   string;
}

export function BitacoraPublishStepper({ activity, locale }: Props) {
  const steps     = computePublishSteps(activity, locale);
  const doneCount = steps.filter((s) => s.state === 'done').length;
  const allDone   = doneCount === 6;

  return (
    <div className={`border rounded-xl p-4 transition-colors ${
      allDone
        ? 'bg-green-50 border-green-200'
        : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Flujo editorial — Revista AO
        </p>
        <span className={`text-xs font-medium ${allDone ? 'text-green-600' : 'text-gray-400'}`}>
          {doneCount} / 6 completados
        </span>
      </div>

      {/* Steps — horizontally scrollable on small screens */}
      <div className="flex items-start overflow-x-auto pb-1 gap-0 -mx-1 px-1">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start shrink-0">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1.5 w-[76px]">
              {/* Circle indicator */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  step.state === 'done'
                    ? 'bg-green-500 border-green-500 text-white'
                    : step.state === 'active'
                    ? 'bg-white border-red-500 text-red-600 shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-300'
                }`}
              >
                {step.state === 'done' ? '✓' : step.id}
              </div>

              {/* Step label */}
              <span
                className={`text-xs font-semibold text-center leading-tight ${
                  step.state === 'done'
                    ? 'text-green-700'
                    : step.state === 'active'
                    ? 'text-red-600'
                    : 'text-gray-300'
                }`}
              >
                {step.label}
              </span>

              {/* Sublabel: optional context or link */}
              {step.sublabel && (
                step.href ? (
                  <Link
                    href={step.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-center text-red-600 hover:underline leading-tight px-0.5"
                  >
                    {step.sublabel}
                  </Link>
                ) : (
                  <span
                    className={`text-[11px] text-center leading-tight px-0.5 ${
                      step.state === 'done'
                        ? 'text-gray-400'
                        : step.state === 'active'
                        ? 'text-amber-500 font-medium'
                        : 'text-gray-300'
                    }`}
                  >
                    {step.sublabel}
                  </span>
                )
              )}
            </div>

            {/* Connector line between steps */}
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 w-5 mt-[18px] mx-0.5 shrink-0 rounded-full transition-colors ${
                  step.state === 'done' ? 'bg-green-400' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Success banner when all steps done */}
      {allDone && (
        <p className="mt-3 text-xs text-green-700 font-medium text-center">
          ✅ Artículo publicado y visible en la Revista
        </p>
      )}
    </div>
  );
}

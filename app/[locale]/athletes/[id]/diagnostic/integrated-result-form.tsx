'use client';

import { useRef, useState, useTransition } from 'react';
import { saveIntegratedResult } from './actions';
import type { IntegratedResults } from '@/lib/types/diagnostic';

function Textarea({ label, name, defaultValue, placeholder, rows = 4 }: {
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

export default function IntegratedResultForm({
  athleteId,
  existingData,
  sectionsComplete,
}: {
  athleteId: string;
  existingData: IntegratedResults | null;
  sectionsComplete: boolean;
}) {
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef                     = useRef<HTMLFormElement>(null);
  const d                           = existingData;

  function handleSubmit() {
    const formData = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await saveIntegratedResult(athleteId, formData);
      if (result.error) { setError(result.error); setSuccess(null); }
      else { setError(null); setSuccess('Resultado integrado guardado correctamente.'); }
    });
  }

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

      {error   && <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

      {d?.generated_at && (
        <p className="text-xs text-gray-400 mb-4">
          Última generación: {new Date(d.generated_at).toLocaleString('es-MX')}
        </p>
      )}

      <form ref={formRef} className="space-y-4">
        <Textarea label="Resumen general del diagnóstico inicial" name="overall_summary"
          defaultValue={d?.overall_summary}
          placeholder="Síntesis del estado integral del atleta desde todas las especialidades…" rows={5} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Textarea label="Resumen del diagnóstico médico" name="medical_summary"
            defaultValue={d?.medical_summary}
            placeholder="Principales hallazgos y diagnóstico del rubro médico…" />
          <Textarea label="Resumen del diagnóstico nutricional" name="nutritional_summary"
            defaultValue={d?.nutritional_summary}
            placeholder="Estado nutricional y plan alimentario…" />
          <Textarea label="Resumen del diagnóstico psicológico" name="psychological_summary"
            defaultValue={d?.psychological_summary}
            placeholder="Estado psicológico y plan de intervención…" />
          <Textarea label="Perfil deportivo del atleta" name="sport_profile"
            defaultValue={d?.sport_profile}
            placeholder="Perfil deportivo completo: capacidades, potencial y objetivos del entrenador…" />
        </div>

        <Textarea label="Resumen del diagnóstico fisioterapéutico" name="physiotherapy_summary"
          defaultValue={d?.physiotherapy_summary}
          placeholder="Diagnóstico funcional y plan de rehabilitación…" />

        <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4">
          <label className="block text-sm font-semibold text-emerald-800 mb-1.5">
            Resultado Integrado Interdisciplinario Final
          </label>
          <textarea
            name="interdisciplinary_result"
            rows={6}
            defaultValue={d?.interdisciplinary_result ?? ''}
            placeholder="Conclusión interdisciplinaria: integración de todos los rubros, recomendaciones de trabajo conjunto, prioridades de atención y pronóstico de rendimiento del atleta…"
            className="w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
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

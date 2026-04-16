'use client';

import { useState, useTransition } from 'react';
import { deletePlan, togglePlanPublished, type Plan } from '@/lib/plans/actions';

type Props = {
  plan:      Plan;
  signedUrl: string | null;
};

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PlanCard({ plan, signedUrl }: Props) {
  const [isPending, start] = useTransition();
  const [error, setError]  = useState<string | null>(null);
  const [published, setPublished] = useState(plan.is_published);

  const athleteCount = plan.athlete_plans?.length ?? 0;
  const formattedDate = new Date(plan.created_at).toLocaleDateString('es-MX', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });

  function handleDelete() {
    if (!confirm(`¿Eliminar el plan "${plan.title}"? Esta acción no se puede deshacer.`)) return;
    setError(null);
    start(async () => {
      const result = await deletePlan(plan.id, plan.file_path);
      if (result.error) setError(result.error);
    });
  }

  function handleTogglePublish() {
    const newValue = !published;
    setPublished(newValue);
    setError(null);
    start(async () => {
      const result = await togglePlanPublished(plan.id, newValue);
      if (result.error) {
        setPublished(!newValue); // revert on error
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{plan.title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {formattedDate}
            {plan.file_name && ` · ${plan.file_name}`}
            {plan.file_size && ` · ${formatSize(plan.file_size)}`}
          </p>
        </div>

        {/* Published badge */}
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            published
              ? 'bg-indigo-50 text-indigo-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {published ? '📱 En app' : 'Borrador'}
        </span>
      </div>

      {/* Description */}
      {plan.description && (
        <p className="px-4 pb-2 text-xs text-gray-500 leading-relaxed line-clamp-2">
          {plan.description}
        </p>
      )}

      {/* Athletes summary */}
      <div className="px-4 pb-3 flex items-center gap-3 text-xs text-gray-500">
        <span>
          👤{' '}
          {athleteCount === 0
            ? 'Sin atletas asignados'
            : `${athleteCount} atleta${athleteCount !== 1 ? 's' : ''} asignado${athleteCount !== 1 ? 's' : ''}`}
        </span>
        {plan.athlete_plans?.[0]?.assignment_mode === 'collective' && (
          <span className="text-indigo-500 font-medium">· Colectivo</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline"
            >
              Ver PDF ↗
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Publish toggle */}
          <button
            type="button"
            onClick={handleTogglePublish}
            disabled={isPending}
            className={`text-xs rounded-md border px-2 py-1 transition-colors disabled:opacity-50 ${
              published
                ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            {isPending ? '…' : published ? 'Despublicar' : '📱 Publicar en app'}
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs rounded-md border border-red-200 text-red-600 px-2 py-1 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

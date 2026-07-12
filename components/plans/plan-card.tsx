'use client';

import { useState, useTransition } from 'react';
import {
  deletePlan,
  togglePlanPublished,
  removeAssignmentsOutsideDiscipline,
  type Plan,
  type DisciplineOption,
} from '@/lib/plans/actions';

type Props = {
  plan:        Plan;
  signedUrl:   string | null;
  /**
   * When true, hides admin-only actions (publish toggle, delete).
   * Use for athletes who can only VIEW plans, not manage them.
   */
  readOnly?:   boolean;
  /** Available disciplines for the "filter by discipline" cleanup action. */
  disciplines?: DisciplineOption[];
};

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PlanCard({ plan, signedUrl, readOnly = false, disciplines }: Props) {
  const [isPending, start] = useTransition();
  const [error, setError]      = useState<string | null>(null);
  const [published, setPublished] = useState(plan.is_published);
  const [showCleanup, setShowCleanup] = useState(false);
  const [cleanupDisc, setCleanupDisc] = useState('');
  const [cleanupMsg,  setCleanupMsg]  = useState<string | null>(null);

  const athleteCount = plan.athlete_plans?.length ?? 0;
  const formattedDate = new Date(plan.created_at).toLocaleDateString('es-MX', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });
  const isNew = Date.now() - new Date(plan.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;

  function handleCleanupByDiscipline() {
    if (!cleanupDisc) return;
    const disc = disciplines?.find((d) => d.code === cleanupDisc);
    const discName = disc?.name ?? cleanupDisc;
    if (!confirm(
      `¿Quitar el plan de todos los atletas que NO sean de "${discName}"?\n\nEsta acción no se puede deshacer.`
    )) return;
    setCleanupMsg(null);
    setError(null);
    start(async () => {
      const result = await removeAssignmentsOutsideDiscipline(plan.id, cleanupDisc);
      if (result.error) {
        setError(result.error);
      } else {
        setCleanupMsg(
          result.removed === 0
            ? 'No había atletas fuera de esa disciplina.'
            : `Se quitó el plan de ${result.removed} atleta${result.removed !== 1 ? 's' : ''}.`,
        );
        setShowCleanup(false);
        setCleanupDisc('');
      }
    });
  }

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

        {/* Badges */}
        <div className="shrink-0 flex items-center gap-1.5">
          {isNew && (
            <span className="inline-flex items-center rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
              Nuevo
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              published
                ? 'bg-indigo-50 text-indigo-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {published ? '📱 En app' : 'Borrador'}
          </span>
        </div>
      </div>

      {/* Description */}
      {plan.description && (
        <p className="px-4 pb-2 text-xs text-gray-500 leading-relaxed line-clamp-2">
          {plan.description}
        </p>
      )}

      {/* Athletes */}
      <div className="px-4 pb-3 text-xs text-gray-500">
        {(() => {
          const isCollective = plan.athlete_plans?.[0]?.assignment_mode === 'collective';
          const names = (plan.athlete_plans ?? [])
            .map((ap) => ap.athletes)
            .filter((a): a is { first_name: string; last_name: string } => a != null);

          if (isCollective) {
            return (
              <span className="flex items-center gap-1.5 flex-wrap">
                <span>👥</span>
                <span className="font-medium text-indigo-600">Colectivo</span>
                <span className="text-gray-400">· {names.length} atleta{names.length !== 1 ? 's' : ''}</span>
              </span>
            );
          }

          if (names.length === 0) {
            return <span className="text-gray-400">Sin atletas asignados</span>;
          }

          const shown = names.slice(0, 2);
          const extra = names.length - shown.length;
          return (
            <span className="flex items-center gap-1 flex-wrap">
              <span>👤</span>
              {shown.map((a, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700"
                >
                  {a.first_name} {a.last_name}
                </span>
              ))}
              {extra > 0 && (
                <span className="text-gray-400">+{extra} más</span>
              )}
            </span>
          );
        })()}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Cleanup success message */}
      {cleanupMsg && (
        <div className="mx-4 mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 flex items-center justify-between">
          <span>{cleanupMsg}</span>
          <button
            type="button"
            onClick={() => setCleanupMsg(null)}
            className="ml-2 text-emerald-500 hover:text-emerald-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Inline cleanup form */}
      {!readOnly && showCleanup && disciplines && disciplines.length > 0 && (
        <div className="mx-4 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-800 font-medium mb-2">
            Mantener solo atletas de la disciplina:
          </p>
          <div className="flex items-center gap-2">
            <select
              value={cleanupDisc}
              onChange={(e) => setCleanupDisc(e.target.value)}
              disabled={isPending}
              className="flex-1 rounded border border-amber-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
            >
              <option value="">— Selecciona disciplina —</option>
              {disciplines.map((d) => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCleanupByDiscipline}
              disabled={isPending || !cleanupDisc}
              className="text-xs rounded-md border border-amber-400 bg-amber-100 text-amber-800 px-2 py-1 hover:bg-amber-200 transition-colors disabled:opacity-50"
            >
              {isPending ? '…' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => { setShowCleanup(false); setCleanupDisc(''); }}
              disabled={isPending}
              className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between gap-2">
        {/* PDF link — visible to everyone */}
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

        {/* Admin-only actions — hidden in readOnly mode */}
        {!readOnly && (
          <div className="flex items-center gap-2">
            {/* Filter by discipline — only when there are athletes and disciplines available */}
            {athleteCount > 0 && disciplines && disciplines.length > 0 && !showCleanup && (
              <button
                type="button"
                onClick={() => { setShowCleanup(true); setCleanupMsg(null); }}
                disabled={isPending}
                className="text-xs rounded-md border border-amber-200 text-amber-700 px-2 py-1 hover:bg-amber-50 transition-colors disabled:opacity-50"
                title="Quitar el plan de atletas que no son de la disciplina indicada"
              >
                🧹 Filtrar disciplina
              </button>
            )}

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
        )}
      </div>
    </div>
  );
}

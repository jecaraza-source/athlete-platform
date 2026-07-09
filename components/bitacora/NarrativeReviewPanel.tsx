'use client';

import { useState } from 'react';
import type { ActivityNarrative } from '@/lib/types/bitacora';
import { approveNarrative, rejectNarrative, deleteNarrative } from '@/lib/bitacora/actions';

interface NarrativeReviewPanelProps {
  activityId:    string;
  narrative:     ActivityNarrative | null;
  isEligible:    boolean;  // editorial_eligible
  isPublished:   boolean;  // status === 'publicado'
  onNarrativeChange?: (narrative: ActivityNarrative | null) => void;
}

const statusLabels: Record<string, { label: string; class: string }> = {
  borrador:  { label: 'Borrador',  class: 'bg-yellow-100 text-yellow-700' },
  aprobado:  { label: 'Aprobado',  class: 'bg-green-100 text-green-700'  },
  rechazado: { label: 'Rechazado', class: 'bg-red-100 text-red-700'      },
};

export function NarrativeReviewPanel({
  activityId,
  narrative,
  isEligible,
  isPublished,
  onNarrativeChange,
}: NarrativeReviewPanelProps) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [localNarrative, setLocalNarrative] = useState(narrative);
  const [error, setError] = useState<string | null>(null);

  const current = localNarrative;

  async function handleGenerate() {
    if (!isEligible || !isPublished) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/bitacora/generate-narrative', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ activity_id: activityId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Error al generar narrativa.');
        return;
      }

      const updated: ActivityNarrative = {
        id:             data.narrative_id,
        activity_id:    activityId,
        narrative_text: data.narrative_text,
        model_used:     data.model_used,
        status:         'borrador',
        generated_at:   data.generated_at,
        approved_by:    null,
        approved_at:    null,
      };
      setLocalNarrative(updated);
      onNarrativeChange?.(updated);
    } catch (err) {
      setError('Error de red al generar narrativa.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove() {
    if (!current) return;
    setLoading(true);
    setError(null);
    const result = await approveNarrative(current.id);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    const updated = { ...current, status: 'aprobado' as const, approved_at: new Date().toISOString() };
    setLocalNarrative(updated);
    onNarrativeChange?.(updated);
  }

  async function handleReject() {
    if (!current) return;
    setLoading(true);
    setError(null);
    const result = await rejectNarrative(current.id);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    const updated = { ...current, status: 'rechazado' as const };
    setLocalNarrative(updated);
    onNarrativeChange?.(updated);
  }

  async function handleDelete() {
    if (!current || !confirm('¿Eliminar esta narrativa? No se puede deshacer.')) return;
    setLoading(true);
    const result = await deleteNarrative(current.id);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setLocalNarrative(null);
    onNarrativeChange?.(null);
  }

  const badge = current ? statusLabels[current.status] : null;

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800 text-sm">Narrativa AI</span>
          {badge && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.class}`}>
              {badge.label}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {current ? `Generado con ${current.model_used}` : 'Sin narrativa'}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Aviso si no es elegible */}
        {!isEligible && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
            Esta actividad no es elegible para narrativa editorial. Activa <strong>editorial_eligible</strong> para habilitar la generación.
          </div>
        )}

        {/* Aviso si no está publicada */}
        {isEligible && !isPublished && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
            Publica la actividad antes de generar la narrativa.
          </div>
        )}

        {/* Texto de la narrativa */}
        {current ? (
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border border-gray-100">
            {current.narrative_text}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">
            No hay narrativa generada. Haz clic en &quot;Generar narrativa&quot; para crear una.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap gap-2">
          {/* Generar / Regenerar */}
          {isEligible && isPublished && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || loading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {generating ? 'Generando…' : current ? '↺ Regenerar narrativa' : '✦ Generar narrativa'}
            </button>
          )}

          {/* Aprobar */}
          {current && current.status !== 'aprobado' && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              ✓ Aprobar
            </button>
          )}

          {/* Rechazar */}
          {current && current.status === 'aprobado' && (
            <button
              type="button"
              onClick={handleReject}
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              ✕ Retirar aprobación
            </button>
          )}

          {/* Eliminar */}
          {current && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

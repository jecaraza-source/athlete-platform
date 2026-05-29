'use client';

import { useState, useEffect, useTransition } from 'react';
import type { NewsletterDraft, Tip }           from '@/lib/newsletter/types';
import NewsletterTipEditor                     from './NewsletterTipEditor';

type DraftRow = Omit<NewsletterDraft, 'tips_json' | 'html_content'> & {
  tips_json: Tip[];
};

const STATUS_CLASSES: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  approved:  'bg-green-100 text-green-800',
  rejected:  'bg-red-100 text-red-800',
  sent:      'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const STATUS_LABELS: Record<string, string> = {
  pending:   'Pendiente',
  approved:  'Aprobado',
  rejected:  'Rechazado',
  sent:      'Enviado',
  cancelled: 'Cancelado',
};

const AUDIENCIA_LABEL: Record<string, string> = {
  atleta: 'Atletas',
  coach:  'Coaches',
  all:    'Todos',
};

export default function NewsletterPreviewPanel({
  draft,
  canApprove,
  onAction,
}: {
  draft: DraftRow;
  canApprove: boolean;
  onAction: (draftId: string, action: 'approved' | 'rejected') => void;
}) {
  const [htmlContent, setHtmlContent]     = useState<string | null>(null);
  const [loadingHtml, setLoadingHtml]     = useState(true);

  const [view, setView]                   = useState<'preview' | 'edit'>('preview');
  const [isPending, startTransition]      = useTransition();

  const [confirmAction, setConfirmAction] = useState<'approved' | 'rejected' | null>(null);
  const [note, setNote]                   = useState('');
  const [error, setError]                 = useState<string | null>(null);
  const [success, setSuccess]             = useState<string | null>(null);

  // Fetch full html_content on mount
  useEffect(() => {
    setLoadingHtml(true);
    fetch(`/api/newsletter/drafts?status=pending&limit=100`)
      .then((r) => r.json())
      .then((data: { data?: Array<{ id: string; html_content?: string }> }) => {
        const found = data.data?.find((d) => d.id === draft.id);
        setHtmlContent(found?.html_content ?? null);
      })
      .catch(() => setHtmlContent(null))
      .finally(() => setLoadingHtml(false));
  }, [draft.id]);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/newsletter/approve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ draftId: draft.id, action: 'approved', note: note.trim() || undefined }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Error al aprobar');
      } else {
        setSuccess('Newsletter aprobado y programado ✓');
        setTimeout(() => onAction(draft.id, 'approved'), 1000);
      }
      setConfirmAction(null);
      setNote('');
    });
  }

  function handleReject() {
    if (!note.trim()) { setError('Escribe el motivo del rechazo'); return; }
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/newsletter/approve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ draftId: draft.id, action: 'rejected', note: note.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Error al rechazar');
      } else {
        setSuccess('Newsletter rechazado');
        setTimeout(() => onAction(draft.id, 'rejected'), 1000);
      }
      setConfirmAction(null);
      setNote('');
    });
  }

  function handleTipsSaved(newHtml: string) {
    setHtmlContent(newHtml);
    setView('preview');
  }

  const scheduledLabel = draft.scheduled_for
    ? new Date(draft.scheduled_for).toLocaleString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[draft.status] ?? STATUS_CLASSES.pending}`}>
              {STATUS_LABELS[draft.status] ?? draft.status}
            </span>
            <span className="text-xs text-gray-500">
              {AUDIENCIA_LABEL[draft.audiencia] ?? draft.audiencia}
            </span>
            {scheduledLabel && (
              <span className="text-xs text-gray-400">· {scheduledLabel}</span>
            )}
          </div>
          <h2 className="text-base font-semibold text-gray-800 leading-snug truncate">
            {draft.asunto}
          </h2>
          {draft.preview_text && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{draft.preview_text}</p>
          )}
        </div>

        {/* View toggle */}
        <div className="flex rounded-md border border-gray-200 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setView('preview')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'preview' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => setView('edit')}
            className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 transition-colors ${
              view === 'edit' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Editar tips
          </button>
        </div>
      </div>

      {/* Body: preview or tip editor */}
      {view === 'preview' ? (
        <div className="bg-gray-50" style={{ height: '520px' }}>
          {loadingHtml ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Cargando preview…
            </div>
          ) : htmlContent ? (
            <iframe
              srcDoc={htmlContent}
              title="Newsletter preview"
              className="w-full h-full border-0"
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              No hay contenido HTML disponible
            </div>
          )}
        </div>
      ) : (
        <div className="p-4">
          <NewsletterTipEditor
            draftId={draft.id}
            initialTips={draft.tips_json}
            onSaved={handleTipsSaved}
          />
        </div>
      )}

      {/* Action footer — only for pending + authorized */}
      {canApprove && draft.status === 'pending' && (
        <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-3">
          {success ? (
            <p className="text-sm font-medium text-green-700">{success}</p>
          ) : confirmAction ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                {confirmAction === 'approved'
                  ? '¿Aprobar y programar este newsletter?'
                  : 'Motivo del rechazo (obligatorio):'}
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={confirmAction === 'approved' ? 'Nota opcional…' : 'Describe el motivo…'}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={confirmAction === 'approved' ? handleApprove : handleReject}
                  className={`px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 ${
                    confirmAction === 'approved'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isPending ? 'Procesando…' : 'Confirmar'}
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirmAction(null); setNote(''); setError(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction('approved')}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
              >
                ✓ Aprobar y programar
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction('rejected')}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-md transition-colors"
              >
                ✕ Rechazar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

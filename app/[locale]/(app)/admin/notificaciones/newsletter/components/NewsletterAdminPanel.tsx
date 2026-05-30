'use client';

import { useState } from 'react';
import type { NewsletterDraft, Tip } from '@/lib/newsletter/types';
import NewsletterPreviewPanel  from './NewsletterPreviewPanel';
import NewsletterHistoryList   from './NewsletterHistoryList';

type DraftRow = Omit<NewsletterDraft, 'tips_json' | 'html_content'> & {
  tips_json: Tip[];
};

const AUDIENCIA_LABEL: Record<string, string> = {
  atleta: 'Atletas',
  coach:  'Coaches',
  all:    'Todos',
};

const AUDIENCIA_COLORS: Record<string, string> = {
  atleta: 'bg-emerald-100 text-emerald-700',
  coach:  'bg-sky-100 text-sky-700',
  all:    'bg-violet-100 text-violet-700',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function NewsletterAdminPanel({
  pendingDrafts,
  canApprove,
}: {
  pendingDrafts: DraftRow[];
  canApprove: boolean;
}) {
  const [tab, setTab]             = useState<'pending' | 'history'>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(
    pendingDrafts[0]?.id ?? null
  );
  // Refresh counter — increment to force re-render after approve/reject
  const [refreshKey, setRefreshKey] = useState(0);
  // Local copy of drafts (to remove approved/rejected without full page reload)
  const [drafts, setDrafts] = useState<DraftRow[]>(pendingDrafts);

  const selectedDraft = drafts.find((d) => d.id === selectedId) ?? null;

  function handleAction(draftId: string, _action: 'approved' | 'rejected') {
    // Remove the actioned draft from the pending list
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== draftId);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
    setRefreshKey((k) => k + 1);
  }

  return (
    <div>
      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'pending'
              ? 'bg-white border border-gray-200 border-b-white text-teal-700 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Pendientes
          {drafts.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-700">
              {drafts.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'history'
              ? 'bg-white border border-gray-200 border-b-white text-teal-700 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Historial
        </button>
      </div>

      {/* Pending tab */}
      {tab === 'pending' && (
        <div className="flex gap-6">
          {/* Left: list */}
          <div className="w-72 shrink-0 space-y-2">
            {drafts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
                No hay newsletters pendientes de aprobación.
              </div>
            ) : (
              drafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => setSelectedId(draft.id)}
                  className={`w-full text-left rounded-lg border p-4 transition-colors ${
                    selectedId === draft.id
                      ? 'border-teal-400 bg-teal-50 ring-1 ring-teal-400'
                      : 'border-gray-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${AUDIENCIA_COLORS[draft.audiencia] ?? 'bg-gray-100 text-gray-600'}`}>
                      {AUDIENCIA_LABEL[draft.audiencia] ?? draft.audiencia}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {formatDate(draft.created_at)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
                    {draft.asunto}
                  </p>
                  {draft.scheduled_for && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      Programado: {formatDate(draft.scheduled_for)}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Right: preview panel */}
          <div className="flex-1 min-w-0">
            {selectedDraft ? (
              <NewsletterPreviewPanel
                key={`${selectedDraft.id}-${refreshKey}`}
                draft={selectedDraft}
                canApprove={canApprove}
                onAction={handleAction}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 p-16 text-center text-gray-400 text-sm">
                Selecciona un newsletter para previsualizar
              </div>
            )}
          </div>
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <NewsletterHistoryList key={`history-${refreshKey}`} />
      )}
    </div>
  );
}

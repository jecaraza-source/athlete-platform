'use client';

import { useState, useEffect, useCallback } from 'react';
import type { NewsletterDraft }              from '@/lib/newsletter/types';

type HistoryItem = Pick<
  NewsletterDraft,
  'id' | 'audiencia' | 'asunto' | 'preview_text' | 'status' |
  'sent_at' | 'recipient_count' | 'created_at'
>;

const AUDIENCIA_COLORS: Record<string, string> = {
  atleta: 'bg-emerald-100 text-emerald-700',
  coach:  'bg-sky-100 text-sky-700',
  all:    'bg-violet-100 text-violet-700',
};
const AUDIENCIA_LABEL: Record<string, string> = {
  atleta: 'Atletas',
  coach:  'Coaches',
  all:    'Todos',
};
const STATUS_COLORS: Record<string, string> = {
  sent:      'bg-blue-100 text-blue-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  approved:  'bg-green-100 text-green-700',
  pending:   'bg-yellow-100 text-yellow-700',
};
const STATUS_LABELS: Record<string, string> = {
  sent: 'Enviado', rejected: 'Rechazado', cancelled: 'Cancelado',
  approved: 'Aprobado', pending: 'Pendiente',
};

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function NewsletterHistoryList() {
  const [items, setItems]           = useState<HistoryItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(false);
  const [previewId, setPreviewId]   = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback((p: number, replace: boolean) => {
    setLoading(true);
    fetch(`/api/newsletter/drafts?limit=20&page=${p}`)
      .then((r) => r.json())
      .then((data: { data?: HistoryItem[]; pages?: number }) => {
        setItems((prev) => replace ? (data.data ?? []) : [...prev, ...(data.data ?? [])]);
        setHasMore(p < (data.pages ?? 1));
        setPage(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(1, true); }, [load]);

  function openPreview(id: string) {
    setPreviewId(id);
    setPreviewHtml(null);
    setPreviewLoading(true);
    fetch(`/api/newsletter/drafts?limit=100`)
      .then((r) => r.json())
      .then((data: { data?: Array<{ id: string; html_content?: string }> }) => {
        const found = data.data?.find((d) => d.id === id);
        setPreviewHtml(found?.html_content ?? null);
      })
      .catch(() => setPreviewHtml(null))
      .finally(() => setPreviewLoading(false));
  }

  function closePreview() {
    setPreviewId(null);
    setPreviewHtml(null);
  }

  return (
    <>
      {loading && items.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">Cargando historial…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400 text-sm">
          No hay newsletters en el historial.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Asunto</th>
                  <th className="px-4 py-3 text-left">Audiencia</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Enviado</th>
                  <th className="px-4 py-3 text-right">Destinatarios</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-gray-800 truncate">{item.asunto}</p>
                      {item.preview_text && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{item.preview_text}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${AUDIENCIA_COLORS[item.audiencia] ?? 'bg-gray-100 text-gray-600'}`}>
                        {AUDIENCIA_LABEL[item.audiencia] ?? item.audiencia}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmt(item.sent_at)}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">
                      {item.recipient_count > 0 ? item.recipient_count.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openPreview(item.id)}
                        className="text-xs text-teal-600 hover:text-teal-800 font-medium"
                      >
                        Ver →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => load(page + 1, false)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? 'Cargando…' : 'Cargar más'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Preview modal */}
      {previewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">Preview del newsletter</h3>
              <button
                type="button"
                onClick={closePreview}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-50">
              {previewLoading ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-400 py-20">
                  Cargando preview…
                </div>
              ) : previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  title="Newsletter preview"
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin"
                  style={{ minHeight: '70vh' }}
                />
              ) : (
                <div className="flex items-center justify-center h-full py-20 text-sm text-gray-400">
                  No se pudo cargar el preview.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

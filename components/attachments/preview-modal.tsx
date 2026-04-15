'use client';

import { useEffect, useState } from 'react';
import { formatFileSize, getPreviewType } from '@/lib/types/attachments';
import FileIcon from './file-icon';

type Props = {
  fileName: string;
  fileSize?: number;
  mimeType: string;
  signedUrl: string;
  onClose: () => void;
};

export default function PreviewModal({
  fileName,
  fileSize,
  mimeType,
  signedUrl,
  onClose,
}: Props) {
  const previewType = getPreviewType(mimeType);

  // Lock body scroll and handle ESC
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.80)' }}
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden
                   w-full max-w-4xl"
        style={{ maxHeight: 'min(90vh, 860px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-white">
          <FileIcon mimeType={mimeType} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate" title={fileName}>
              {fileName}
            </p>
            {fileSize !== undefined && (
              <p className="text-xs text-gray-400">{formatFileSize(fileSize)}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Download */}
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={fileName}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <DownloadIcon /> Descargar
            </a>
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              title="Cerrar (Esc)"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-gray-50 min-h-0">
          {previewType === 'image' && (
            <ImagePreview url={signedUrl} alt={fileName} />
          )}
          {previewType === 'pdf' && (
            <iframe
              src={`${signedUrl}#toolbar=1&navpanes=0`}
              title={fileName}
              className="w-full h-full min-h-96"
              style={{ minHeight: '60vh' }}
            />
          )}
          {previewType === 'text' && (
            <TextPreview url={signedUrl} />
          )}
          {previewType === 'none' && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
              <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <FileIcon mimeType={mimeType} size="lg" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500">
                  Vista previa no disponible
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Este tipo de archivo no puede mostrarse en el navegador.
                </p>
              </div>
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                <DownloadIcon className="text-white" /> Abrir y descargar
              </a>
            </div>
          )}
        </div>

        {/* ── Footer (mobile download) ───────────────────────────── */}
        <div className="sm:hidden flex items-center justify-center px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={fileName}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            <DownloadIcon className="text-white" /> Descargar archivo
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ImagePreview({ url, alt }: { url: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="flex items-center justify-center p-4 min-h-64">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={`max-w-full object-contain rounded-lg shadow-sm transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ maxHeight: '70vh' }}
      />
    </div>
  );
}

function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then((t) => { setContent(t); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <p className="p-4 text-sm text-red-500">No se pudo cargar el contenido del archivo.</p>
    );
  }

  return (
    <pre className="p-4 text-xs text-gray-700 overflow-auto whitespace-pre-wrap font-mono leading-relaxed">
      {content}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Micro icon components (inline SVG — no extra dependency)
// ---------------------------------------------------------------------------

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function DownloadIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-3.5 h-3.5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-emerald-500 animate-spin" />
  );
}

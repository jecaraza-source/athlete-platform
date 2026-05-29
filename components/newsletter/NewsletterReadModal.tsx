'use client';

import { useState } from 'react';
import Link          from 'next/link';

export default function NewsletterReadModal({
  htmlContent,
  title,
  historialHref,
}: {
  htmlContent:  string;
  title:        string;
  historialHref?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger buttons */}
      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
        >
          Leer newsletter completo
        </button>
        {historialHref && (
          <Link
            href={historialHref}
            className="text-sm font-medium text-teal-600 hover:text-teal-800 underline"
          >
            Ver historial →
          </Link>
        )}
      </div>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="bg-white rounded-xl shadow-2xl w-full flex flex-col overflow-hidden"
            style={{ maxWidth: 700, maxHeight: '90vh' }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 shrink-0">
              <h2 className="text-sm font-semibold text-gray-800 truncate max-w-[80%]">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none ml-4"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {/* iframe */}
            <div className="flex-1 overflow-hidden">
              <iframe
                srcDoc={htmlContent}
                title={title}
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
                style={{ minHeight: '75vh' }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';
// =============================================================================
// PrintControls.tsx
// Barra de control de impresión para la página de reportes entregables.
// Permite imprimir todos los documentos o uno específico.
// Se oculta completamente al imprimir (@media print).
// =============================================================================

import Link from 'next/link';

interface Props {
  backHref: string;
  activityTitle: string;
}

const DOCS = [
  { id: '1', label: 'Base de Datos',  icon: '📋' },
  { id: '2', label: 'Bitácora',        icon: '📝' },
  { id: '3', label: 'Ficha Técnica',   icon: '📄' },
] as const;

export function PrintControls({ backHref, activityTitle }: Props) {
  function printAll() {
    document.body.removeAttribute('data-print-doc');
    window.print();
  }

  function printDoc(id: string) {
    document.body.setAttribute('data-print-doc', id);
    window.print();
    // Restore after print dialog closes
    setTimeout(() => document.body.removeAttribute('data-print-doc'), 500);
  }

  return (
    <div className="no-print sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Back link */}
        <Link
          href={backHref}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1"
        >
          ← Volver
        </Link>

        <span className="text-gray-300">|</span>

        {/* Activity title */}
        <p className="text-sm font-semibold text-gray-700 truncate max-w-[240px]">
          {activityTitle}
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Individual doc buttons */}
          {DOCS.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => printDoc(doc.id)}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              {doc.icon} {doc.label}
            </button>
          ))}

          {/* Print all */}
          <button
            type="button"
            onClick={printAll}
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            🖨 Imprimir todos
          </button>
        </div>
      </div>
    </div>
  );
}

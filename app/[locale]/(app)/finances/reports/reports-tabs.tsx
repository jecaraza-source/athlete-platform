'use client';

import { useState } from 'react';

export default function ReportsTabs({
  globalTab,
  periodicTab,
}: {
  globalTab:   React.ReactNode;
  periodicTab: React.ReactNode;
}) {
  const [tab, setTab] = useState<'global' | 'periodic'>('periodic');

  return (
    <div>
      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 no-print">
        <button
          type="button"
          onClick={() => setTab('periodic')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
            tab === 'periodic'
              ? 'bg-white border border-gray-200 border-b-white text-indigo-700 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Reporte Periódico
        </button>
        <button
          type="button"
          onClick={() => setTab('global')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
            tab === 'global'
              ? 'bg-white border border-gray-200 border-b-white text-indigo-700 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Reportes Globales
        </button>
      </div>

      {tab === 'periodic' ? periodicTab : globalTab}
    </div>
  );
}

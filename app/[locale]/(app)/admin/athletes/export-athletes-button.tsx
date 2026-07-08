'use client';

import type { AthleteProfile } from './page';
import { getAthleteStatusLabel } from '@/lib/types/athlete';

export default function ExportAthletesButton({
  athletes,
  discipline,
}: {
  athletes: AthleteProfile[];
  discipline: string;
}) {
  function downloadCSV() {
    const headers = ['Nombre', 'Apellido', 'Email', 'Teléfono', 'Disciplina', 'Estado', 'Rol'];
    const rows = athletes.map((a) => [
      a.first_name,
      a.last_name,
      a.email ?? '',
      a.phone ?? '',
      a.specialty ?? '',
      getAthleteStatusLabel(a.athlete_status ?? null),
      a.role ?? '',
    ]);

    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');

    // BOM ensures Excel opens UTF-8 correctly (accents, ñ, etc.)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = discipline
      ? `atletas-${discipline.toLowerCase().replace(/\s+/g, '-')}.csv`
      : 'atletas.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={downloadCSV}
        title={`Exportar ${athletes.length} atletas a Excel`}
        className="flex items-center gap-1.5 rounded-md border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
      >
        {/* Excel icon */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="8" y1="13" x2="16" y2="13"/>
          <line x1="8" y1="17" x2="16" y2="17"/>
          <line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
        Excel
      </button>

      <button
        type="button"
        onClick={() => window.print()}
        title="Imprimir / Guardar como PDF"
        className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        {/* Print icon */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <polyline points="6 9 6 2 18 2 18 9"/>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        PDF
      </button>
    </div>
  );
}

'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DISCIPLINES, STATUS_LABELS } from '@/lib/types/diagnostic';
import type { DiagnosticStatus } from '@/lib/types/diagnostic';

const DIAGNOSTIC_OPTIONS: { value: DiagnosticStatus }[] = [
  { value: 'pendiente' },
  { value: 'en_proceso' },
  { value: 'completo' },
  { value: 'requiere_atencion' },
];

export default function AthletesFilter({
  currentQ,
  currentStatus,
  currentDiscipline,
  currentDiagnostic,
}: {
  currentQ: string;
  currentStatus: string;
  currentDiscipline: string;
  currentDiagnostic: string;
}) {
  const t       = useTranslations('athletes');
  const tc      = useTranslations('common');
  const router  = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    router.push(pathname);
  }

  const hasFilters = currentQ || currentStatus || currentDiscipline || currentDiagnostic;

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
      {/* Name search */}
      <input
        type="search"
        defaultValue={currentQ}
        placeholder={t('searchPlaceholder')}
        onChange={(e) => {
          // Debounce via form — no auto-submit to avoid excessive requests
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            updateParam('q', (e.target as HTMLInputElement).value.trim());
          }
        }}
        onBlur={(e) => updateParam('q', e.target.value.trim())}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm w-full sm:w-56 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />

      {/* Discipline */}
      <select
        value={currentDiscipline}
        onChange={(e) => updateParam('discipline', e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">{t('colDiscipline')}: {t('filterAll')}</option>
        {DISCIPLINES.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>

      {/* Status */}
      <select
        value={currentStatus}
        onChange={(e) => updateParam('status', e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">{t('status')}: {t('filterAll')}</option>
        <option value="active">{t('filterActive')}</option>
        <option value="inactive">{t('filterInactive')}</option>
      </select>

      {/* Diagnostic status */}
      <select
        value={currentDiagnostic}
        onChange={(e) => updateParam('diagnostic', e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">{t('filterDiagnostic')}: {t('filterAll')}</option>
        {DIAGNOSTIC_OPTIONS.map(({ value }) => (
          <option key={value} value={value}>{STATUS_LABELS[value]}</option>
        ))}
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
        >
          ✕ {tc('clearFilters')}
        </button>
      )}
    </div>
  );
}

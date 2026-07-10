'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

interface RevistaFiltersProps {
  availableTags:  string[];
  selectedMonth?: string;
  selectedTag?:   string;
  selectedSearch?: string;
  totalArticles:  number;
}

export function RevistaFilters({
  availableTags,
  selectedMonth,
  selectedTag,
  selectedSearch,
  totalArticles,
}: RevistaFiltersProps) {
  const router         = useRouter();
  const pathname       = usePathname();
  const searchParams   = useSearchParams();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [searchValue, setSearchValue] = useState(selectedSearch ?? '');

  const updateParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  function handleSearchChange(value: string) {
    setSearchValue(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      updateParam('search', value.trim() || null);
    }, 450);
  }

  const clearFilters = () => {
    setSearchValue('');
    router.push(pathname);
  };

  const hasFilters = !!(selectedMonth || selectedTag || selectedSearch);

  // Últimos 24 meses
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
    months.push({ value, label });
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Búsqueda */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar artículos por título…"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-gray-400"
        />
        {searchValue && (
          <button
            type="button"
            onClick={() => handleSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Fila de controles */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Selector de mes */}
        <select
          value={selectedMonth ?? ''}
          onChange={(e) => updateParam('month', e.target.value || null)}
          className={`border rounded-full px-3 py-1.5 text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-red-400 transition-colors cursor-pointer ${
            selectedMonth
              ? 'border-red-600 text-red-700 bg-red-50'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          <option value="">Todos los meses</option>
          {months.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Limpiar */}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-gray-400 hover:text-red-600 transition-colors underline"
          >
            Limpiar ×
          </button>
        )}

        {/* Conteo */}
        <span className="text-xs text-gray-400 ml-auto">
          {totalArticles} {totalArticles === 1 ? 'artículo' : 'artículos'}
        </span>
      </div>

      {/* Tag / disciplina pills */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => updateParam('tag', selectedTag === tag ? null : tag)}
              className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                selectedTag === tag
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-red-400 hover:text-red-600'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Chips de filtros activos */}
      {hasFilters && (
        <div className="flex flex-wrap gap-1.5">
          {selectedMonth && (
            <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5">
              {months.find((m) => m.value === selectedMonth)?.label ?? selectedMonth}
              <button onClick={() => updateParam('month', null)} className="hover:text-red-900">×</button>
            </span>
          )}
          {selectedTag && (
            <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5">
              #{selectedTag}
              <button onClick={() => updateParam('tag', null)} className="hover:text-red-900">×</button>
            </span>
          )}
          {selectedSearch && (
            <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5">
              &quot;{selectedSearch}&quot;
              <button onClick={() => { setSearchValue(''); updateParam('search', null); }} className="hover:text-red-900">×</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

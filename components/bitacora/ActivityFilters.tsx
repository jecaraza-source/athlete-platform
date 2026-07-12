'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import type { ActivityType } from '@/lib/types/bitacora';

interface ActivityFiltersProps {
  availableTags:      string[];
  selectedType?:      ActivityType;
  selectedTag?:       string;
  selectedMonth?:     string;
  selectedSearch?:    string;
  selectedNarrativa?: boolean;
}

export function ActivityFilters({
  availableTags,
  selectedType,
  selectedTag,
  selectedMonth,
  selectedSearch,
  selectedNarrativa,
}: ActivityFiltersProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [searchValue, setSearchValue] = useState(selectedSearch ?? '');

  const updateParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
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

  const hasFilters = !!(selectedType || selectedTag || selectedMonth || selectedSearch || selectedNarrativa);

  // Generar últimos 18 meses para el selector
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
    months.push({ value, label });
  }

  const typeOptions: { value: string; label: string }[] = [
    { value: '',                 label: 'Todas' },
    { value: 'evento_deportivo', label: 'Eventos ⚡' },
    { value: 'consulta',         label: 'Consultas 🏥' },
  ];

  return (
    <div className="flex flex-col gap-3">

      {/* Búsqueda */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar actividades por título…"
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

      {/* Fila de filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Pills de tipo */}
        {typeOptions.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => updateParam('type', value || null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              (selectedType ?? '') === value
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-red-400 hover:text-red-600'
            }`}
          >
            {label}
          </button>
        ))}

        <span className="text-gray-200 hidden sm:block">|</span>

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

        <span className="text-gray-200 hidden sm:block">|</span>

        {/* Toggle En Revista */}
        <button
          type="button"
          onClick={() => updateParam('narrativa', selectedNarrativa ? null : 'si')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            selectedNarrativa
              ? 'bg-amber-100 text-amber-800 border-amber-300'
              : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300 hover:text-amber-700'
          }`}
        >
          ✦ {selectedNarrativa ? 'Solo con artículo' : 'Con artículo de Revista'}
        </button>

        {/* Limpiar todo */}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-gray-400 hover:text-red-600 transition-colors ml-1 underline"
          >
            Limpiar ×
          </button>
        )}
      </div>

      {/* Tag pills */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => updateParam('tag', selectedTag === tag ? null : tag)}
              className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                selectedTag === tag
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Chips de filtros activos */}
      {hasFilters && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {selectedType && (
            <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5">
              {selectedType === 'evento_deportivo' ? 'Eventos' : 'Consultas'}
              <button onClick={() => updateParam('type', null)} className="hover:text-red-900">×</button>
            </span>
          )}
          {selectedMonth && (
            <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5">
              {months.find(m => m.value === selectedMonth)?.label ?? selectedMonth}
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
              "{selectedSearch}"
              <button onClick={() => { setSearchValue(''); updateParam('search', null); }} className="hover:text-red-900">×</button>
            </span>
          )}
          {selectedNarrativa && (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">
              ✦ Con artículo de Revista
              <button onClick={() => updateParam('narrativa', null)} className="hover:text-amber-900">×</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

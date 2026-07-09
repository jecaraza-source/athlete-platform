'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type { ActivityType } from '@/lib/types/bitacora';

interface ActivityFiltersProps {
  availableTags:     string[];
  selectedType?:     ActivityType;
  selectedTag?:      string;
  selectedMonth?:    string;
}

export function ActivityFilters({
  availableTags,
  selectedType,
  selectedTag,
  selectedMonth,
}: ActivityFiltersProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // reset pagination on filter change
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const clearFilters = () => {
    router.push(pathname);
  };

  const hasFilters = selectedType || selectedTag || selectedMonth;

  // Generar últimos 12 meses para el selector
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
    months.push({ value, label });
  }

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Tipo */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</label>
        <select
          value={selectedType ?? ''}
          onChange={(e) => updateParam('type', e.target.value || null)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          <option value="">Todas</option>
          <option value="evento_deportivo">Eventos deportivos</option>
          <option value="consulta">Consultas</option>
        </select>
      </div>

      {/* Mes */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mes</label>
        <select
          value={selectedMonth ?? ''}
          onChange={(e) => updateParam('month', e.target.value || null)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          <option value="">Todos los meses</option>
          {months.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Tag */}
      {availableTags.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tag</label>
          <select
            value={selectedTag ?? ''}
            onChange={(e) => updateParam('tag', e.target.value || null)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <option value="">Todos los tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
      )}

      {/* Clear */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-sm text-gray-500 hover:text-red-600 underline mb-0.5"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

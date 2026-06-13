'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const DISCIPLINES = [
  'Atletismo',
  'Boxeo',
  'Breaking',
  'Canotaje',
  'Gimnasia Artística Femenil',
  'Natación',
  'Taekwondo',
];

export default function AthletesConfigFilter({
  currentQ,
  currentDiscipline,
  total,
  filtered,
}: {
  currentQ: string;
  currentDiscipline: string;
  total: number;
  filtered: number;
}) {
  const router    = useRouter();
  const pathname  = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    router.push(pathname);
  }

  const hasFilters = currentQ || currentDiscipline;

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
      {/* Búsqueda por nombre */}
      <input
        type="search"
        defaultValue={currentQ}
        placeholder="Buscar por nombre…"
        onKeyDown={(e) => {
          if (e.key === 'Enter') update('q', (e.target as HTMLInputElement).value.trim());
        }}
        onBlur={(e) => update('q', e.target.value.trim())}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm w-full sm:w-56 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
      />

      {/* Disciplina */}
      <select
        value={currentDiscipline}
        onChange={(e) => update('discipline', e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">Disciplina: Todas</option>
        {DISCIPLINES.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      {/* Limpiar */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
        >
          ✕ Limpiar filtros
        </button>
      )}

      {/* Contador */}
      <span className="text-xs text-gray-400 sm:ml-auto">
        {filtered === total
          ? `${total} atletas`
          : `${filtered} de ${total} atletas`}
      </span>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AudienciaType = 'all' | 'atleta' | 'coach' | 'staff' | 'individual';

export type RecipientProfile = {
  id:         string;
  first_name: string;
  last_name:  string;
  email:      string | null;
  role:       string | null;
};

export type RecipientSelection = {
  audiencia:    AudienciaType;
  recipientIds: string[];       // only relevant when audiencia='individual'
  count:        number;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AUDIENCE_OPTIONS: { value: AudienciaType; label: string; description: string; icon: string }[] = [
  { value: 'all',        label: 'Todos',       description: 'Todos los usuarios con newsletter activo', icon: '👥' },
  { value: 'atleta',     label: 'Atletas',     description: 'Atletas y tutores',                        icon: '🏃' },
  { value: 'coach',      label: 'Coaches',     description: 'Entrenadores únicamente',                  icon: '🎽' },
  { value: 'staff',      label: 'Staff',       description: 'Todo el personal técnico y administrativo', icon: '🏥' },
  { value: 'individual', label: 'Individual',  description: 'Selecciona personas específicas',           icon: '👤' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecipientSelector({
  defaultAudiencia = 'all',
  onChange,
}: {
  defaultAudiencia?: AudienciaType;
  onChange:          (selection: RecipientSelection) => void;
}) {
  const [audiencia, setAudiencia]           = useState<AudienciaType>(defaultAudiencia);
  const [count, setCount]                   = useState<number | null>(null);
  const [loadingCount, setLoadingCount]     = useState(false);

  // Individual selection state
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<RecipientProfile[]>([]);
  const [searching, setSearching]           = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<RecipientProfile[]>([]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch count when audience changes (or when selected profiles change)
  const fetchCount = useCallback(async (
    aud: AudienciaType,
    ids: string[]
  ) => {
    setLoadingCount(true);
    try {
      const params = new URLSearchParams({ audiencia: aud });
      if (aud === 'individual' && ids.length > 0) {
        params.set('ids', ids.join(','));
      }
      const res  = await fetch(`/api/newsletter/recipients/count?${params}`);
      const data = await res.json() as { count?: number };
      setCount(data.count ?? 0);
    } catch {
      setCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, []);

  useEffect(() => {
    const ids = selectedProfiles.map((p) => p.id);
    fetchCount(audiencia, ids);
    onChange({ audiencia, recipientIds: ids, count: count ?? 0 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audiencia, selectedProfiles.length]);

  // Update parent when count resolves
  useEffect(() => {
    if (count !== null) {
      onChange({
        audiencia,
        recipientIds: selectedProfiles.map((p) => p.id),
        count,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // Debounced search for individual profiles
  useEffect(() => {
    if (audiencia !== 'individual' || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(
          `/api/newsletter/recipients/count?audiencia=individual&q=${encodeURIComponent(searchQuery)}`
        );
        const data = await res.json() as { profiles?: RecipientProfile[] };
        // Filter out already-selected profiles
        const selected = new Set(selectedProfiles.map((p) => p.id));
        setSearchResults((data.profiles ?? []).filter((p) => !selected.has(p.id)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, audiencia]);

  function addProfile(profile: RecipientProfile) {
    if (selectedProfiles.some((p) => p.id === profile.id)) return;
    const next = [...selectedProfiles, profile];
    setSelectedProfiles(next);
    setSearchResults((prev) => prev.filter((p) => p.id !== profile.id));
    fetchCount('individual', next.map((p) => p.id));
  }

  function removeProfile(id: string) {
    const next = selectedProfiles.filter((p) => p.id !== id);
    setSelectedProfiles(next);
    fetchCount('individual', next.map((p) => p.id));
  }

  return (
    <div className="space-y-3">
      {/* Section title */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Destinatarios
      </p>

      {/* Audience pills */}
      <div className="flex flex-wrap gap-2">
        {AUDIENCE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              setAudiencia(opt.value);
              setSearchQuery('');
              setSearchResults([]);
              setSelectedProfiles([]);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              audiencia === opt.value
                ? 'bg-teal-600 text-white border-teal-600'
                : 'border-gray-300 text-gray-600 hover:border-teal-400 hover:text-teal-700'
            }`}
          >
            <span>{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Description + live count */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">
          {AUDIENCE_OPTIONS.find((o) => o.value === audiencia)?.description}
        </span>
        <span className={`font-semibold ${count === 0 ? 'text-amber-600' : 'text-teal-700'}`}>
          {loadingCount ? (
            <span className="text-gray-400">Calculando…</span>
          ) : count !== null ? (
            `${count.toLocaleString('es-MX')} destinatario${count !== 1 ? 's' : ''}`
          ) : null}
        </span>
      </div>

      {/* Individual profile picker */}
      {audiencia === 'individual' && (
        <div className="space-y-2">
          {/* Search input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o correo…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 pr-8"
            />
            {searching && (
              <span className="absolute right-3 top-2.5 text-gray-400 text-xs">…</span>
            )}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-white divide-y divide-gray-50 max-h-40 overflow-y-auto shadow-sm">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProfile(p)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-teal-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {(p.first_name[0] ?? '') + (p.last_name[0] ?? '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{p.email ?? p.role}</p>
                  </div>
                  <span className="text-teal-500 text-lg">+</span>
                </button>
              ))}
            </div>
          )}

          {/* Selected profiles */}
          {selectedProfiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedProfiles.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2.5 py-0.5 text-xs font-medium"
                >
                  {p.first_name} {p.last_name}
                  <button
                    type="button"
                    onClick={() => removeProfile(p.id)}
                    className="ml-0.5 text-teal-400 hover:text-teal-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {selectedProfiles.length === 0 && searchQuery.length < 2 && (
            <p className="text-xs text-gray-400">Escribe al menos 2 caracteres para buscar.</p>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// We always resolve to 'individual' with an explicit list when the new
// multi-select is used. The legacy single-audience mode is preserved for
// backward compatibility when no profiles are loaded yet.
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
  recipientIds: string[];
  count:        number;
};

// Segment → display config
const SEGMENTS = [
  { key: 'staff',  label: 'Staff & Admin', icon: '🏥', color: 'blue'   },
  { key: 'coach',  label: 'Coaches',       icon: '🎽', color: 'purple' },
  { key: 'atleta', label: 'Atletas',       icon: '🏃', color: 'green'  },
] as const;

type SegmentKey = typeof SEGMENTS[number]['key'];

// role values that belong to each segment (mirrors backend)
const SEGMENT_ROLES: Record<SegmentKey, string[]> = {
  staff:  ['super_admin', 'admin', 'program_director', 'event_coordinator',
           'medic', 'physio', 'psychologist', 'nutritionist'],
  coach:  ['coach'],
  atleta: ['athlete', 'guardian'],
};

function profileBelongsToSegment(role: string | null, seg: SegmentKey): boolean {
  return !!(role && SEGMENT_ROLES[seg].includes(role));
}

const ROLE_LABELS: Record<string, string> = {
  super_admin:       'Super Admin',
  admin:             'Admin',
  program_director:  'Director',
  event_coordinator: 'Coordinador',
  coach:             'Coach',
  medic:             'Médico',
  physio:            'Fisioterapeuta',
  psychologist:      'Psicólogo',
  nutritionist:      'Nutricionista',
  athlete:           'Atleta',
  guardian:          'Tutor',
};

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
  // ── State ────────────────────────────────────────────────────────────────
  // All profiles loaded from the API
  const [allProfiles,    setAllProfiles]    = useState<RecipientProfile[]>([]);
  const [loadingList,    setLoadingList]    = useState(true);
  // Selected profile IDs (Set for O(1) lookup)
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  // Active segment filters (checkboxes — combinables)
  const [activeSegments, setActiveSegments] = useState<Set<SegmentKey>>(new Set<SegmentKey>());
  // selectAll flag
  const [allSelected,    setAllSelected]    = useState(false);
  // Search query for the profile list
  const [searchQuery,    setSearchQuery]    = useState('');

  // ── Load all profiles on mount ────────────────────────────────────────────
  useEffect(() => {
    setLoadingList(true);
    fetch('/api/newsletter/recipients/list?limit=500')
      .then((r) => r.json())
      .then((data: { profiles?: RecipientProfile[] }) => {
        const profiles = data.profiles ?? [];
        setAllProfiles(profiles);

        // Auto-select based on defaultAudiencia once profiles are loaded
        if (profiles.length === 0) return;

        if (defaultAudiencia === 'all') {
          setSelectedIds(new Set(profiles.map((p) => p.id)));
          setActiveSegments(new Set(SEGMENTS.map((s) => s.key)));
          setAllSelected(true);
        } else if (defaultAudiencia in SEGMENT_ROLES) {
          const seg = defaultAudiencia as SegmentKey;
          const segIds = new Set(
            profiles
              .filter((p) => profileBelongsToSegment(p.role, seg))
              .map((p) => p.id)
          );
          setActiveSegments(new Set([seg]));
          setSelectedIds(segIds);
        }
        // 'individual' — leave empty; user selects manually
      })
      .catch(() => setAllProfiles([]))
      .finally(() => setLoadingList(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived: which profiles are visible in the list ───────────────────────
  const filteredProfiles = allProfiles.filter((p) => {
    const matchesSearch =
      searchQuery.length < 2 ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    if (!matchesSearch) return false;

    // If segment filters active, only show profiles in those segments
    if (activeSegments.size > 0) {
      return [...activeSegments].some((seg) => profileBelongsToSegment(p.role, seg));
    }
    return true;
  });

  // ── Notify parent whenever selection changes ──────────────────────────────
  useEffect(() => {
    const ids = [...selectedIds];
    onChange({
      audiencia:    ids.length === allProfiles.length && allProfiles.length > 0
                      ? 'all'
                      : 'individual',
      recipientIds: ids,
      count:        ids.length,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  // ── Segment toggle ────────────────────────────────────────────────────────
  function toggleSegment(seg: SegmentKey) {
    setActiveSegments((prev) => {
      const next = new Set(prev);
      if (next.has(seg)) {
        next.delete(seg);
        // Deselect profiles that ONLY belong to this segment (not to remaining)
        const remaining = [...next];
        setSelectedIds((ids) => {
          const updated = new Set(ids);
          allProfiles.forEach((p) => {
            if (
              profileBelongsToSegment(p.role, seg) &&
              !remaining.some((r) => profileBelongsToSegment(p.role, r))
            ) {
              updated.delete(p.id);
            }
          });
          return updated;
        });
      } else {
        next.add(seg);
        // Select all profiles in this segment
        setSelectedIds((ids) => {
          const updated = new Set(ids);
          allProfiles.forEach((p) => {
            if (profileBelongsToSegment(p.role, seg)) updated.add(p.id);
          });
          return updated;
        });
      }
      return next;
    });
    setAllSelected(false);
  }

  // ── Select/deselect all ───────────────────────────────────────────────────
  function handleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      setActiveSegments(new Set());
      setAllSelected(false);
    } else {
      setSelectedIds(new Set(allProfiles.map((p) => p.id)));
      setActiveSegments(new Set(SEGMENTS.map((s) => s.key)));
      setAllSelected(true);
    }
  }

  // ── Individual profile toggle ─────────────────────────────────────────────
  function toggleProfile(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAllSelected(false);
  }

  // ── Segment state helpers ─────────────────────────────────────────────────
  function segmentCount(seg: SegmentKey) {
    return allProfiles.filter((p) => profileBelongsToSegment(p.role, seg)).length;
  }
  function segmentSelectedCount(seg: SegmentKey) {
    return allProfiles.filter(
      (p) => profileBelongsToSegment(p.role, seg) && selectedIds.has(p.id)
    ).length;
  }

  const totalSelected = selectedIds.size;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Destinatarios
        </p>
        <span
          className={`text-xs font-semibold ${
            totalSelected === 0 ? 'text-amber-600' : 'text-teal-700'
          }`}
        >
          {totalSelected === 0
            ? 'Sin selección'
            : `${totalSelected.toLocaleString('es-MX')} seleccionado${totalSelected !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Segment shortcuts (combinables via checkboxes) */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Selección rápida por grupo
        </p>

        {/* "Todo el equipo" — selects/clears all */}
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
          />
          <span className="text-sm font-semibold text-gray-800 group-hover:text-teal-700">
            👥 Todo el equipo
          </span>
          <span className="ml-auto text-xs text-gray-400">
            {loadingList ? '…' : allProfiles.length}
          </span>
        </label>

        {/* Segment checkboxes */}
        {SEGMENTS.map((seg) => {
          const total    = segmentCount(seg.key);
          const selected = segmentSelectedCount(seg.key);
          const checked  = selected > 0 && selected === total;
          const partial  = selected > 0 && selected < total;

          return (
            <label key={seg.key} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={checked}
                ref={(el) => {
                  if (el) el.indeterminate = partial;
                }}
                onChange={() => toggleSegment(seg.key)}
                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <span className="text-sm text-gray-700 group-hover:text-teal-700">
                {seg.icon} {seg.label}
              </span>
              <span className="ml-auto text-xs text-gray-400">
                {loadingList ? '…' : `${selected}/${total}`}
              </span>
            </label>
          );
        })}
      </div>

      {/* Profile list with individual checkboxes */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {/* Search input */}
        <div className="border-b border-gray-100 px-3 py-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, correo o rol…"
            className="w-full text-sm outline-none bg-transparent placeholder-gray-400"
          />
        </div>

        {/* Profile list */}
        <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
          {loadingList ? (
            <div className="py-6 text-center text-xs text-gray-400">Cargando personas…</div>
          ) : filteredProfiles.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              {searchQuery.length > 0 ? 'Sin resultados' : 'No hay perfiles disponibles'}
            </div>
          ) : (
            filteredProfiles.map((p) => {
              const checked = selectedIds.has(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                    checked ? 'bg-teal-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProfile(p.id)}
                    className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer shrink-0"
                  />
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {(p.first_name[0] ?? '').toUpperCase()}{(p.last_name[0] ?? '').toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {p.role ? (ROLE_LABELS[p.role] ?? p.role) : ''}
                      {p.email ? ` · ${p.email}` : ''}
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        {/* Footer: select all visible / clear */}
        {filteredProfiles.length > 0 && (
          <div className="border-t border-gray-100 px-3 py-1.5 flex items-center justify-between bg-gray-50">
            <button
              type="button"
              onClick={() => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  filteredProfiles.forEach((p) => next.add(p.id));
                  return next;
                });
              }}
              className="text-xs text-teal-600 hover:text-teal-800 font-medium"
            >
              Seleccionar {filteredProfiles.length} visible{filteredProfiles.length !== 1 ? 's' : ''}
            </button>
            {totalSelected > 0 && (
              <button
                type="button"
                onClick={() => { setSelectedIds(new Set()); setActiveSegments(new Set()); setAllSelected(false); }}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Limpiar selección
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

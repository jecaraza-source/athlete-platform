'use client';
// =============================================================================
// GalleryPhotoImporter
// =============================================================================
// Adds an "Importar desde Historia Gráfica" button to the Fotos section of the
// Bitácora editor. Opens a modal with all photos from Historia Gráfica (other
// activities). The admin can filter, multi-select and click "Importar" to link
// the selected photos to the current Magazine activity.
//
// Photos are imported without duplicating files in Supabase Storage — new
// activity_photos DB records are created pointing to the same storage paths.
// =============================================================================

import { useState, useMemo }  from 'react';
import Image                  from 'next/image';
import { useRouter }          from 'next/navigation';
import {
  fetchImportablePhotos,
  importPhotosToActivity,
} from '@/lib/bitacora/gallery-import-actions';
import { getThumbnailUrl }    from '@/lib/storage-config';
import type { ImportablePhoto } from '@/lib/bitacora/gallery-import-actions';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  activityId:        string;
  currentPhotoCount: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GalleryPhotoImporter({ activityId, currentPhotoCount }: Props) {
  const router = useRouter();

  // ── Modal / loading state ─────────────────────────────────────────────────
  const [open,      setOpen]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [photos,    setPhotos]    = useState<ImportablePhoto[]>([]);
  const [importing, setImporting] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [imported,  setImported]  = useState<number | null>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search,   setSearch]   = useState('');
  const [selDisc,  setSelDisc]  = useState('');
  const [selAlbum, setSelAlbum] = useState('');

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ─────────────────────────────────────────────────────────────────────────

  async function openModal() {
    setOpen(true);
    setLoading(true);
    setSelected(new Set());
    setError(null);
    setImported(null);
    setSearch('');
    setSelDisc('');
    setSelAlbum('');
    const result = await fetchImportablePhotos(activityId);
    setPhotos(result);
    setLoading(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((p) => p.id)));
  }

  // ── Filter options ────────────────────────────────────────────────────────
  const disciplines = useMemo(
    () => [...new Set(photos.map((p) => p.disciplina).filter(Boolean) as string[])].sort(),
    [photos],
  );

  const albums = useMemo(
    () =>
      [
        ...new Map(
          photos.map((p) => [p.activity_id, { id: p.activity_id, title: p.album_title }]),
        ).values(),
      ].sort((a, b) => a.title.localeCompare(b.title)),
    [photos],
  );

  const filtered = useMemo(() => {
    let out = photos;
    if (selDisc)  out = out.filter((p) => p.disciplina  === selDisc);
    if (selAlbum) out = out.filter((p) => p.activity_id === selAlbum);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(
        (p) =>
          p.album_title.toLowerCase().includes(q) ||
          p.caption?.toLowerCase().includes(q) ||
          p.alt_text.toLowerCase().includes(q),
      );
    }
    return out;
  }, [photos, selDisc, selAlbum, search]);

  // ── Import handler ────────────────────────────────────────────────────────
  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setError(null);

    const toImport = photos
      .filter((p) => selected.has(p.id))
      .map((p) => ({
        storage_path: p.storage_path,
        caption:      p.caption,
        alt_text:     p.alt_text,
      }));

    const result = await importPhotosToActivity(
      activityId,
      toImport,
      currentPhotoCount,
    );

    setImporting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setImported(result.data?.count ?? toImport.length);
    router.refresh();

    // Auto-close after a short success display
    setTimeout(() => setOpen(false), 1200);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300
                   bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100
                   transition-colors"
      >
        <span>📸</span>
        Importar desde Historia Gráfica
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Importar desde Historia Gráfica
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {loading
                    ? 'Cargando fotos…'
                    : selected.size > 0
                    ? `${selected.size} foto${selected.size !== 1 ? 's' : ''} seleccionada${selected.size !== 1 ? 's' : ''}`
                    : `${filtered.length} foto${filtered.length !== 1 ? 's' : ''} disponible${filtered.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
              >
                ×
              </button>
            </div>

            {/* Filter bar */}
            {!loading && photos.length > 0 && (
              <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-2 shrink-0">
                <div className="relative flex-1 min-w-32">
                  <svg
                    className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por álbum, caption…"
                    className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm
                               focus:outline-none focus:border-amber-400"
                  />
                </div>

                {disciplines.length > 0 && (
                  <select
                    value={selDisc}
                    onChange={(e) => setSelDisc(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm
                               focus:outline-none focus:border-amber-400"
                  >
                    <option value="">Todas las disciplinas</option>
                    {disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}

                {albums.length > 0 && (
                  <select
                    value={selAlbum}
                    onChange={(e) => setSelAlbum(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm
                               focus:outline-none focus:border-amber-400 max-w-56"
                  >
                    <option value="">Todos los álbumes</option>
                    {albums.map((a) => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                )}

                {filtered.length > 0 && (
                  <button
                    onClick={selectAll}
                    className="text-sm text-amber-600 hover:text-amber-700 font-medium px-1"
                  >
                    Seleccionar todo ({filtered.length})
                  </button>
                )}

                {selected.size > 0 && (
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-sm text-gray-400 hover:text-gray-600 px-1"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}

            {/* Photo grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
                  <p className="text-sm text-gray-400">Cargando fotos de Historia Gráfica…</p>
                </div>
              ) : imported !== null ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="text-5xl">✅</div>
                  <p className="text-base font-semibold text-green-700">
                    {imported} foto{imported !== 1 ? 's' : ''} importada{imported !== 1 ? 's' : ''} correctamente
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                  <div className="text-4xl">📷</div>
                  <p>
                    {photos.length === 0
                      ? 'No hay fotos en Historia Gráfica todavía.'
                      : 'Ninguna foto coincide con los filtros.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filtered.map((photo) => {
                    const isSel = selected.has(photo.id);
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => toggleSelect(photo.id)}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all
                                    focus:outline-none ${
                          isSel
                            ? 'border-amber-500 ring-2 ring-amber-400/40 scale-[0.97]'
                            : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        {/* Thumbnail */}
                        <Image
                          src={getThumbnailUrl(photo.storage_path)}
                          alt={photo.alt_text}
                          fill
                          sizes="200px"
                          className="object-cover"
                        />

                        {/* Check badge */}
                        <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center
                          ${isSel ? 'bg-amber-500 border-amber-500' : 'bg-white/70 border-gray-300'}`}
                        >
                          {isSel && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>

                        {/* Bottom metadata overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-4">
                          <p className="text-white text-[10px] font-semibold truncate leading-tight">
                            {photo.album_title}
                          </p>
                          {photo.disciplina && (
                            <p className="text-amber-300 text-[9px] truncate leading-tight">
                              {photo.disciplina}
                            </p>
                          )}
                          {photo.caption && (
                            <p className="text-white/70 text-[9px] truncate leading-tight mt-0.5 italic">
                              {photo.caption}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-4 shrink-0">
              {error && (
                <p className="text-sm text-red-500 flex-1">{error}</p>
              )}
              <div className="flex gap-3 ml-auto items-center">
                {selected.size > 0 && !importing && imported === null && (
                  <p className="text-xs text-gray-500">
                    {selected.size} foto{selected.size !== 1 ? 's' : ''} seleccionada{selected.size !== 1 ? 's' : ''}
                  </p>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={selected.size === 0 || importing || imported !== null}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold
                             disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2
                             min-w-[120px] justify-center"
                >
                  {importing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"/>
                      </svg>
                      Importando…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Importar{selected.size > 0 ? ` ${selected.size}` : ''} foto{selected.size !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';
// =============================================================================
// HistoriaGraficaClient
// =============================================================================
// Dark-themed photo gallery admin for Historia Gráfica.
//
// Features:
//   • Album cards (horizontal scroll) — click to filter
//   • Sidebar filters: search, discipline, album, date range
//   • Photo grid (CSS columns / masonry-like)
//   • Upload modal: create album inline + multi-file drag & drop
//   • Lightbox with caption + metadata
//   • Delete photo (with confirm)
//
// Upload pipeline (browser-side):
//   compressImage → Supabase Storage upload → registerGalleryPhoto (server action)
// =============================================================================

import { useState, useRef, useMemo, useCallback } from 'react';
import Image                  from 'next/image';
import Link                   from 'next/link';
import { useRouter }          from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { compressImage }      from '@/lib/bitacora/image-utils';
import { createGalleryAlbum, registerGalleryPhoto, deleteGalleryPhoto } from './actions';
import {
  ACTIVITY_PHOTOS_BUCKET,
  MAX_PHOTOS_PER_ACTIVITY,
  ACCEPTED_IMAGE_TYPES,
  getThumbnailUrl,
  getLightboxUrl,
} from '@/lib/storage-config';
import type { GalleryData, AlbumSummary, GalleryPhoto } from '@/lib/historiaGraficaQueries';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialData: GalleryData;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function disciplineColor(d: string | null): string {
  if (!d) return 'bg-[#2A2D3A] text-[#94A3B8]';
  const colors = [
    'bg-indigo-900/40 text-indigo-300',
    'bg-emerald-900/40 text-emerald-300',
    'bg-blue-900/40 text-blue-300',
    'bg-amber-900/40 text-amber-300',
    'bg-rose-900/40 text-rose-300',
    'bg-purple-900/40 text-purple-300',
    'bg-teal-900/40 text-teal-300',
  ];
  let hash = 0;
  for (const c of d) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[hash % colors.length];
}

// ─── Upload modal state ───────────────────────────────────────────────────────

interface UploadingFile {
  id:       string;
  file:     File;
  preview:  string;
  caption:  string;
  status:   'pending' | 'uploading' | 'done' | 'error';
  error?:   string;
  photoId?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HistoriaGraficaClient({ initialData }: Props) {
  const router = useRouter();

  // ── Local data (refreshed after mutations) ─────────────────────────────────
  const [albums,  setAlbums]  = useState<AlbumSummary[]>(initialData.albums);
  const [photos,  setPhotos]  = useState<GalleryPhoto[]>(initialData.photos);
  const [disciplines] = useState<string[]>(initialData.disciplines);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search,     setSearch]     = useState('');
  const [selAlbum,   setSelAlbum]   = useState<string | null>(null);
  const [selDisc,    setSelDisc]    = useState<string | null>(null);
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [lightbox,    setLightbox]    = useState<GalleryPhoto | null>(null);
  const [showUpload,  setShowUpload]  = useState(false);
  const [deleting,    setDeleting]    = useState<string | null>(null);

  // ── Upload modal state ─────────────────────────────────────────────────────
  const [uploadAlbumId,    setUploadAlbumId]    = useState<string | null>(null);
  const [newAlbumTitle,    setNewAlbumTitle]    = useState('');
  const [newAlbumDate,     setNewAlbumDate]     = useState('');
  const [newAlbumDisc,     setNewAlbumDisc]     = useState('');
  const [newAlbumSede,     setNewAlbumSede]     = useState('');
  const [creatingAlbum,    setCreatingAlbum]    = useState(false);
  const [albumMode,        setAlbumMode]        = useState<'existing' | 'new'>('existing');
  const [uploadFiles,      setUploadFiles]      = useState<UploadingFile[]>([]);
  const [uploading,        setUploading]        = useState(false);
  const [uploadError,      setUploadError]      = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createSupabaseBrowserClient();

  // ── Filtered photos ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let out = photos;
    if (selAlbum)  out = out.filter((p) => p.activity_id === selAlbum);
    if (selDisc)   out = out.filter((p) => p.disciplina  === selDisc);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(
        (p) =>
          p.caption?.toLowerCase().includes(q) ||
          p.album_title.toLowerCase().includes(q) ||
          p.alt_text.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (dateFrom) out = out.filter((p) => p.album_date && p.album_date >= dateFrom);
    if (dateTo)   out = out.filter((p) => p.album_date && p.album_date <= dateTo);
    return out;
  }, [photos, selAlbum, selDisc, search, dateFrom, dateTo]);

  // ── Upload helpers ─────────────────────────────────────────────────────────

  function addFilesToQueue(files: FileList) {
    const newItems: UploadingFile[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) continue;
      newItems.push({
        id:      `${Date.now()}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        caption: '',
        status:  'pending',
      });
    }
    setUploadFiles((prev) => [...prev, ...newItems]);
  }

  function updateCaption(id: string, caption: string) {
    setUploadFiles((prev) => prev.map((f) => f.id === id ? { ...f, caption } : f));
  }

  function removeFromQueue(id: string) {
    setUploadFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((f) => f.id !== id);
    });
  }

  async function handleCreateAlbum(): Promise<string | null> {
    if (!newAlbumTitle.trim()) return null;
    setCreatingAlbum(true);
    const result = await createGalleryAlbum({
      title:      newAlbumTitle.trim(),
      event_date: newAlbumDate  || undefined,
      disciplina: newAlbumDisc  || undefined,
      sede:       newAlbumSede  || undefined,
    });
    setCreatingAlbum(false);
    if (result.error || !result.data) {
      setUploadError(result.error ?? 'No se pudo crear el álbum');
      return null;
    }
    const newAlbum: AlbumSummary = {
      id:          result.data.id,
      title:       newAlbumTitle.trim(),
      event_date:  newAlbumDate || null,
      disciplina:  newAlbumDisc || null,
      sede:        newAlbumSede || null,
      tags:        ['historia_grafica'],
      photo_count: 0,
      cover_path:  null,
    };
    setAlbums((prev) => [newAlbum, ...prev]);
    return result.data.id;
  }

  async function handleUpload() {
    setUploadError(null);

    // Resolve album id
    let albumId = uploadAlbumId;
    if (albumMode === 'new') {
      albumId = await handleCreateAlbum();
      if (!albumId) return;
    }
    if (!albumId) { setUploadError('Selecciona o crea un álbum'); return; }

    const pending = uploadFiles.filter((f) => f.status === 'pending');
    if (pending.length === 0) { setUploadError('No hay fotos para subir'); return; }

    setUploading(true);
    const currentAlbumPhotoCount = photos.filter((p) => p.activity_id === albumId).length;

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];

      if (currentAlbumPhotoCount + i >= MAX_PHOTOS_PER_ACTIVITY) {
        setUploadFiles((prev) =>
          prev.map((f) => f.id === item.id ? { ...f, status: 'error', error: 'Límite de fotos alcanzado' } : f)
        );
        continue;
      }

      setUploadFiles((prev) =>
        prev.map((f) => f.id === item.id ? { ...f, status: 'uploading' } : f)
      );

      try {
        const compressed   = await compressImage(item.file);
        const ext          = compressed.file.name.split('.').pop() ?? 'jpg';
        const storagePath  = `${albumId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(ACTIVITY_PHOTOS_BUCKET)
          .upload(storagePath, compressed.file, { upsert: false });

        if (uploadErr) throw new Error(uploadErr.message);

        const regResult = await registerGalleryPhoto({
          activity_id:   albumId,
          storage_path:  storagePath,
          caption:       item.caption || undefined,
          alt_text:      item.file.name.replace(/\.[^.]+$/, ''),
          display_order: currentAlbumPhotoCount + i,
        });

        if (regResult.error) throw new Error(regResult.error);

        // Optimistically add photo to local state
        const newPhoto: GalleryPhoto = {
          id:            regResult.data?.id ?? storagePath,
          activity_id:   albumId,
          storage_path:  storagePath,
          caption:       item.caption || null,
          alt_text:      item.file.name.replace(/\.[^.]+$/, ''),
          featured:      false,
          display_order: currentAlbumPhotoCount + i,
          created_at:    new Date().toISOString(),
          album_title:   albums.find((a) => a.id === albumId)?.title ?? '',
          album_date:    albums.find((a) => a.id === albumId)?.event_date ?? null,
          disciplina:    albums.find((a) => a.id === albumId)?.disciplina ?? null,
          sede:          albums.find((a) => a.id === albumId)?.sede ?? null,
          tags:          albums.find((a) => a.id === albumId)?.tags ?? [],
        };
        setPhotos((prev) => [newPhoto, ...prev]);
        setAlbums((prev) =>
          prev.map((a) =>
            a.id === albumId
              ? { ...a, photo_count: a.photo_count + 1, cover_path: a.cover_path ?? storagePath }
              : a
          )
        );

        setUploadFiles((prev) =>
          prev.map((f) => f.id === item.id ? { ...f, status: 'done', photoId: regResult.data?.id } : f)
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al subir';
        setUploadFiles((prev) =>
          prev.map((f) => f.id === item.id ? { ...f, status: 'error', error: msg } : f)
        );
      }
    }

    setUploading(false);
  }

  function closeUploadModal() {
    uploadFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    setUploadFiles([]);
    setUploadAlbumId(null);
    setNewAlbumTitle('');
    setNewAlbumDate('');
    setNewAlbumDisc('');
    setNewAlbumSede('');
    setAlbumMode('existing');
    setUploadError(null);
    setShowUpload(false);
  }

  async function handleDelete(photo: GalleryPhoto) {
    if (!confirm(`¿Eliminar esta foto de "${photo.album_title}"?`)) return;
    setDeleting(photo.id);
    const result = await deleteGalleryPhoto(photo.id, photo.storage_path);
    setDeleting(null);
    if (result.error) { alert(result.error); return; }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setAlbums((prev) =>
      prev.map((a) =>
        a.id === photo.activity_id ? { ...a, photo_count: Math.max(0, a.photo_count - 1) } : a
      )
    );
    if (lightbox?.id === photo.id) setLightbox(null);
  }

  const clearFilters = useCallback(() => {
    setSearch(''); setSelAlbum(null); setSelDisc(null);
    setDateFrom(''); setDateTo('');
  }, []);

  const hasFilters = !!(search || selAlbum || selDisc || dateFrom || dateTo);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0F1117] text-[#F1F5F9]">

      {/* ── Fixed header ────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 flex items-center justify-between px-6
                         bg-[#0F1117]/95 backdrop-blur border-b border-[#2A2D3A]">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo AO Deporte.png" alt="AO Deporte" className="h-9 w-auto" />
          <div>
            <span className="font-semibold text-[#F1F5F9]">Historia Gráfica</span>
            <span className="ml-2 text-xs text-[#64748B]">{photos.length} fotos · {albums.length} álbumes</span>
          </div>
          <Link href="/admin" className="ml-2 text-xs text-[#94A3B8] hover:text-[#F1F5F9] transition-colors px-2 py-1 rounded hover:bg-[#2A2D3A]">
            ← Admin
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1D27] border border-[#2A2D3A] text-xs text-[#94A3B8] hover:text-[#F1F5F9] transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h10a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-1zm0 6a1 1 0 011-1h6a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-1z" />
            </svg>
            Filtros
          </button>

          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400
                       text-[#0F1117] text-xs font-bold transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Subir Fotos
          </button>
        </div>
      </header>

      {/* ── Body layout ─────────────────────────────────────────────────── */}
      <div className="pt-16 flex min-h-screen">

        {/* Sidebar */}
        <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          fixed md:sticky top-16 left-0 z-30 md:z-auto
          w-64 h-[calc(100vh-4rem)] md:h-auto
          bg-[#0F1117] md:bg-transparent
          border-r border-[#2A2D3A]
          overflow-y-auto
          transition-transform duration-200
          shrink-0
          flex-col
          flex
        `}>
          <div className="p-4 space-y-5">

            {/* Search */}
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] uppercase tracking-wide mb-1.5">
                Buscar
              </label>
              <div className="relative">
                <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Caption, álbum, tags…"
                  className="w-full bg-[#1A1D27] border border-[#2A2D3A] text-[#F1F5F9] text-xs rounded-lg
                             pl-8 pr-3 py-2 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* Discipline */}
            {disciplines.length > 0 && (
              <div>
                <label className="block text-[10px] font-semibold text-[#64748B] uppercase tracking-wide mb-1.5">
                  Disciplina
                </label>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setSelDisc(null)}
                    className={`text-left text-xs px-2.5 py-1.5 rounded-lg transition-all ${
                      !selDisc ? 'bg-amber-500/20 text-amber-300' : 'text-[#94A3B8] hover:bg-[#1A1D27]'
                    }`}
                  >
                    Todas
                  </button>
                  {disciplines.map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelDisc(d === selDisc ? null : d)}
                      className={`text-left text-xs px-2.5 py-1.5 rounded-lg transition-all ${
                        selDisc === d ? 'bg-amber-500/20 text-amber-300' : 'text-[#94A3B8] hover:bg-[#1A1D27]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date range */}
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] uppercase tracking-wide mb-1.5">
                Período
              </label>
              <div className="space-y-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-[#1A1D27] border border-[#2A2D3A] text-[#F1F5F9] text-xs rounded-lg
                             px-3 py-2 focus:outline-none focus:border-amber-500/50 [color-scheme:dark]"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-[#1A1D27] border border-[#2A2D3A] text-[#F1F5F9] text-xs rounded-lg
                             px-3 py-2 focus:outline-none focus:border-amber-500/50 [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Clear filters */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="w-full text-xs text-[#64748B] hover:text-[#94A3B8] py-1.5 transition-colors"
              >
                Limpiar filtros
              </button>
            )}

            {/* Albums list */}
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] uppercase tracking-wide mb-1.5">
                Álbumes ({albums.length})
              </label>
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                <button
                  onClick={() => setSelAlbum(null)}
                  className={`text-left text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center justify-between ${
                    !selAlbum ? 'bg-amber-500/20 text-amber-300' : 'text-[#94A3B8] hover:bg-[#1A1D27]'
                  }`}
                >
                  <span>Todos los álbumes</span>
                  <span className="text-[#64748B] text-[10px]">{photos.length}</span>
                </button>
                {albums.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelAlbum(a.id === selAlbum ? null : a.id)}
                    className={`text-left text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center justify-between gap-2 ${
                      selAlbum === a.id ? 'bg-amber-500/20 text-amber-300' : 'text-[#94A3B8] hover:bg-[#1A1D27]'
                    }`}
                  >
                    <span className="truncate">{a.title}</span>
                    <span className="text-[#64748B] text-[10px] shrink-0">{a.photo_count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main gallery area */}
        <main className="flex-1 overflow-hidden p-4 md:p-6">

          {/* Album cards (horizontal scroll) */}
          {albums.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Álbumes</h2>
                <div className="flex-1 h-px bg-[#2A2D3A]" />
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {albums.map((album) => (
                  <button
                    key={album.id}
                    onClick={() => setSelAlbum(album.id === selAlbum ? null : album.id)}
                    className={`shrink-0 w-40 rounded-xl overflow-hidden border-2 transition-all text-left ${
                      selAlbum === album.id
                        ? 'border-amber-500 shadow-lg shadow-amber-500/20'
                        : 'border-[#2A2D3A] hover:border-[#3A3D4A]'
                    }`}
                  >
                    {/* Cover thumbnail */}
                    <div className="aspect-[4/3] bg-[#1A1D27] relative overflow-hidden">
                      {album.cover_path ? (
                        <Image
                          src={getThumbnailUrl(album.cover_path)}
                          alt={album.title}
                          fill
                          sizes="160px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-3xl opacity-30">📷</div>
                      )}
                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        {album.photo_count}
                      </div>
                    </div>
                    {/* Info */}
                    <div className="bg-[#1A1D27] px-2.5 py-2">
                      <p className="text-xs font-semibold text-[#F1F5F9] truncate">{album.title}</p>
                      <p className="text-[10px] text-[#64748B] mt-0.5 truncate">
                        {album.disciplina ?? '—'} {album.event_date ? `· ${fmtDate(album.event_date)}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results count + active filters */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-[#64748B]">
              {filtered.length} foto{filtered.length !== 1 ? 's' : ''}
              {hasFilters ? ` (filtrado${filtered.length !== 1 ? 's' : ''})` : ''}
            </span>
            {selAlbum && (
              <span className="flex items-center gap-1 text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                {albums.find((a) => a.id === selAlbum)?.title ?? 'Álbum'}
                <button onClick={() => setSelAlbum(null)} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
              </span>
            )}
            {selDisc && (
              <span className="flex items-center gap-1 text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                {selDisc}
                <button onClick={() => setSelDisc(null)} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
              </span>
            )}
          </div>

          {/* Photo grid (CSS columns for masonry feel) */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="text-5xl mb-4 opacity-20">📷</div>
              <p className="text-[#94A3B8]">
                {photos.length === 0
                  ? 'No hay fotos todavía. Sube el primer álbum.'
                  : 'Ninguna foto coincide con los filtros.'}
              </p>
              {photos.length === 0 && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="mt-4 text-sm text-amber-400 hover:text-amber-300 underline transition-colors"
                >
                  Subir fotos →
                </button>
              )}
            </div>
          ) : (
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
              {filtered.map((photo) => (
                <div key={photo.id} className="break-inside-avoid group relative rounded-xl overflow-hidden bg-[#1A1D27]">
                  {/* Photo */}
                  <button
                    className="block w-full text-left"
                    onClick={() => setLightbox(photo)}
                  >
                    <Image
                      src={getThumbnailUrl(photo.storage_path)}
                      alt={photo.alt_text}
                      width={400}
                      height={300}
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className="w-full h-auto object-cover block"
                    />
                  </button>

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity
                                  flex flex-col justify-between p-2.5 pointer-events-none group-hover:pointer-events-auto">
                    {/* Delete button */}
                    <div className="flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(photo); }}
                        disabled={deleting === photo.id}
                        className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white transition-colors
                                   disabled:opacity-50"
                      >
                        {deleting === photo.id
                          ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"/></svg>
                          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        }
                      </button>
                    </div>

                    {/* Caption + meta */}
                    <div>
                      {photo.caption && (
                        <p className="text-xs text-white line-clamp-2 mb-1">{photo.caption}</p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {photo.disciplina && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${disciplineColor(photo.disciplina)}`}>
                            {photo.disciplina}
                          </span>
                        )}
                        <span className="text-[10px] text-[#94A3B8] truncate">{photo.album_title}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm transition-colors"
            >
              ESC · cerrar ×
            </button>

            {/* Image */}
            <div className="relative w-full max-h-[75vh] overflow-hidden rounded-xl">
              <Image
                src={getLightboxUrl(lightbox.storage_path)}
                alt={lightbox.alt_text}
                width={1600}
                height={900}
                sizes="100vw"
                className="w-full h-auto max-h-[75vh] object-contain"
              />
            </div>

            {/* Meta */}
            <div className="flex items-start gap-6 w-full max-w-2xl">
              <div className="flex-1">
                {lightbox.caption && (
                  <p className="text-sm text-[#E2E8F0] mb-1">{lightbox.caption}</p>
                )}
                <div className="flex flex-wrap gap-2 items-center text-xs text-[#64748B]">
                  <span className="font-medium text-[#94A3B8]">{lightbox.album_title}</span>
                  {lightbox.disciplina && (
                    <span className={`px-1.5 py-0.5 rounded-full ${disciplineColor(lightbox.disciplina)}`}>
                      {lightbox.disciplina}
                    </span>
                  )}
                  {lightbox.album_date && <span>{fmtDate(lightbox.album_date)}</span>}
                  {lightbox.sede && <span>· {lightbox.sede}</span>}
                </div>
                {lightbox.tags.filter((t) => t !== 'historia_grafica').length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {lightbox.tags.filter((t) => t !== 'historia_grafica').map((tag) => (
                      <span key={tag} className="text-[10px] bg-[#2A2D3A] text-[#94A3B8] px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Delete from lightbox */}
              <button
                onClick={() => handleDelete(lightbox)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-red-900/40 text-red-400 text-xs hover:bg-red-800/60 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Modal ─────────────────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div
            className="bg-[#1A1D27] border border-[#2A2D3A] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2D3A]">
              <h2 className="font-semibold text-[#F1F5F9]">Subir Fotos</h2>
              <button onClick={closeUploadModal} className="text-[#64748B] hover:text-[#F1F5F9] transition-colors">×</button>
            </div>

            <div className="p-6 space-y-5">

              {/* Album selector */}
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-2">Álbum / Evento</label>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setAlbumMode('existing')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      albumMode === 'existing' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-[#0F1117] text-[#94A3B8] border border-[#2A2D3A] hover:text-[#F1F5F9]'
                    }`}
                  >
                    Álbum existente
                  </button>
                  <button
                    onClick={() => setAlbumMode('new')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      albumMode === 'new' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-[#0F1117] text-[#94A3B8] border border-[#2A2D3A] hover:text-[#F1F5F9]'
                    }`}
                  >
                    + Nuevo álbum
                  </button>
                </div>

                {albumMode === 'existing' ? (
                  <select
                    value={uploadAlbumId ?? ''}
                    onChange={(e) => setUploadAlbumId(e.target.value || null)}
                    className="w-full bg-[#0F1117] border border-[#2A2D3A] text-[#F1F5F9] text-sm rounded-lg
                               px-3 py-2 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">— Selecciona un álbum —</option>
                    {albums.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title} {a.disciplina ? `· ${a.disciplina}` : ''} {a.event_date ? `(${fmtDate(a.event_date)})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newAlbumTitle}
                      onChange={(e) => setNewAlbumTitle(e.target.value)}
                      placeholder="Nombre del álbum / evento *"
                      className="w-full bg-[#0F1117] border border-[#2A2D3A] text-[#F1F5F9] text-sm rounded-lg
                                 px-3 py-2 focus:outline-none focus:border-amber-500/50 placeholder:text-[#4A5568]"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        value={newAlbumDate}
                        onChange={(e) => setNewAlbumDate(e.target.value)}
                        placeholder="Fecha del evento"
                        className="bg-[#0F1117] border border-[#2A2D3A] text-[#F1F5F9] text-sm rounded-lg
                                   px-3 py-2 focus:outline-none focus:border-amber-500/50 [color-scheme:dark]"
                      />
                      <input
                        type="text"
                        value={newAlbumDisc}
                        onChange={(e) => setNewAlbumDisc(e.target.value)}
                        placeholder="Disciplina"
                        list="disc-list"
                        className="bg-[#0F1117] border border-[#2A2D3A] text-[#F1F5F9] text-sm rounded-lg
                                   px-3 py-2 focus:outline-none focus:border-amber-500/50 placeholder:text-[#4A5568]"
                      />
                      <datalist id="disc-list">
                        {disciplines.map((d) => <option key={d} value={d} />)}
                      </datalist>
                    </div>
                    <input
                      type="text"
                      value={newAlbumSede}
                      onChange={(e) => setNewAlbumSede(e.target.value)}
                      placeholder="Sede / lugar (opcional)"
                      className="w-full bg-[#0F1117] border border-[#2A2D3A] text-[#F1F5F9] text-sm rounded-lg
                                 px-3 py-2 focus:outline-none focus:border-amber-500/50 placeholder:text-[#4A5568]"
                    />
                  </div>
                )}
              </div>

              {/* Drop zone */}
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-2">Fotos</label>
                <div
                  className="border-2 border-dashed border-[#2A2D3A] hover:border-amber-500/50 rounded-xl p-6
                             text-center cursor-pointer transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); e.dataTransfer.files && addFilesToQueue(e.dataTransfer.files); }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && addFilesToQueue(e.target.files)}
                  />
                  <svg className="w-8 h-8 mx-auto mb-2 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-[#94A3B8]">
                    Arrastra fotos aquí o <span className="text-amber-400 font-medium">haz clic</span>
                  </p>
                  <p className="text-xs text-[#64748B] mt-1">JPG, PNG, WebP · máx. 5 MB por foto</p>
                </div>
              </div>

              {/* Queue preview */}
              {uploadFiles.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {uploadFiles.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 bg-[#0F1117] rounded-lg p-2.5">
                      {/* Thumbnail */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#2A2D3A]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.preview} alt="" className="w-full h-full object-cover" />
                      </div>

                      {/* Status / caption */}
                      <div className="flex-1 min-w-0">
                        {f.status === 'uploading' ? (
                          <p className="text-xs text-amber-400 animate-pulse">Subiendo…</p>
                        ) : f.status === 'done' ? (
                          <p className="text-xs text-emerald-400">✓ Subida</p>
                        ) : f.status === 'error' ? (
                          <p className="text-xs text-red-400">{f.error}</p>
                        ) : (
                          <input
                            type="text"
                            value={f.caption}
                            onChange={(e) => updateCaption(f.id, e.target.value)}
                            placeholder="Caption (opcional)"
                            className="w-full bg-transparent text-xs text-[#E2E8F0] placeholder:text-[#4A5568]
                                       focus:outline-none border-b border-[#2A2D3A] pb-0.5"
                          />
                        )}
                      </div>

                      {/* Remove */}
                      {f.status === 'pending' && (
                        <button onClick={() => removeFromQueue(f.id)} className="text-[#64748B] hover:text-[#94A3B8] shrink-0 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {uploadError && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">
                  {uploadError}
                </p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-[#2A2D3A]">
                <button onClick={closeUploadModal} className="px-4 py-2 text-sm text-[#94A3B8] hover:text-[#F1F5F9] transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || creatingAlbum || uploadFiles.filter((f) => f.status === 'pending').length === 0}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#0F1117] text-sm font-bold
                             transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploading || creatingAlbum ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"/>
                      </svg>
                      {creatingAlbum ? 'Creando álbum…' : 'Subiendo…'}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Subir {uploadFiles.filter((f) => f.status === 'pending').length > 0
                        ? `${uploadFiles.filter((f) => f.status === 'pending').length} foto${uploadFiles.filter((f) => f.status === 'pending').length !== 1 ? 's' : ''}`
                        : 'fotos'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

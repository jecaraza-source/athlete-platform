/**
 * AthleteDocuments — Server Component
 *
 * Vista consolidada de todos los documentos adjuntos del expediente del atleta.
 * Soporta filtro por módulo, búsqueda por nombre y ordenación por fecha.
 * Las imágenes se muestran en cuadrícula; el resto en lista.
 */

import { listAttachments, getAttachmentSignedUrls } from '@/lib/attachments/actions';
import { hasPermission } from '@/lib/rbac/server';
import {
  ALL_MODULES,
  MODULE_LABELS,
  MODULE_COLORS,
  formatFileSize,
  type AthleteAttachment,
  type AttachmentModule,
} from '@/lib/types/attachments';
import AttachmentCard from '@/components/attachments/attachment-card';
import AttachmentsLoader from '@/components/attachments/attachments-loader';

type Props = {
  athleteId: string;
  /** Filtro de módulo activo (viene de searchParams) */
  moduleFilter?: string;
  /** Búsqueda por nombre (viene de searchParams) */
  search?: string;
};

export default async function AthleteDocuments({ athleteId, moduleFilter, search }: Props) {
  const [allAttachments, canEdit, canDelete] = await Promise.all([
    listAttachments({ athleteId }),
    hasPermission('edit_athletes'),
    hasPermission('delete_athletes'),
  ]);

  // Filtrar por módulo
  const byModule = moduleFilter
    ? allAttachments.filter((a) => a.module_name === moduleFilter)
    : allAttachments;

  // Filtrar por búsqueda
  const filtered = search
    ? byModule.filter(
        (a) =>
          a.file_name_original.toLowerCase().includes(search.toLowerCase()) ||
          (a.description ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : byModule;

  const signedUrlMap = await getAttachmentSignedUrls(filtered);
  const signedUrls = Object.fromEntries(signedUrlMap.entries());

  // Contar por módulo
  const countByModule = ALL_MODULES.reduce<Record<string, number>>((acc, m) => {
    acc[m] = allAttachments.filter((a) => a.module_name === m).length;
    return acc;
  }, {});
  const totalCount = allAttachments.length;

  // Separar imágenes de otros tipos para la cuadrícula
  const images  = filtered.filter((a) => a.mime_type.startsWith('image/'));
  const nonImages = filtered.filter((a) => !a.mime_type.startsWith('image/'));

  return (
    <div className="mt-8 rounded-xl border border-gray-200 overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center">
            <FolderIcon />
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Documentos del expediente</h2>
            <p className="text-xs text-gray-400">
              {totalCount === 0
                ? 'Sin archivos adjuntos todavía'
                : `${totalCount} archivo${totalCount !== 1 ? 's' : ''} · ${formatFileSize(
                    allAttachments.reduce((sum, a) => sum + a.file_size, 0)
                  )} total`}
            </p>
          </div>
        </div>

        {/* Adjuntar desde el expediente */}
        {canEdit && (
          <div className="flex-shrink-0">
            <AttachmentsLoader
              athleteId={athleteId}
              module={(moduleFilter as AttachmentModule | undefined) ?? 'diagnostic'}
              title="Adjuntar documento"
              defaultCollapsed
            />
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">

        {/* ── Stats por módulo ──────────────────────────────────── */}
        {totalCount > 0 && (
          <div className="flex flex-wrap gap-2">
            <FilterChip label="Todos" count={totalCount} active={!moduleFilter} href="?" neutral />
            {ALL_MODULES.filter((m) => countByModule[m] > 0).map((m) => (
              <FilterChip
                key={m}
                label={MODULE_LABELS[m]}
                count={countByModule[m]}
                active={moduleFilter === m}
                href={`?docmodule=${m}`}
                color={MODULE_COLORS[m]}
              />
            ))}
          </div>
        )}

        {/* ── Search ────────────────────────────────────────────── */}
        {totalCount > 3 && (
          <SearchBar current={search} moduleFilter={moduleFilter} />
        )}

        {/* ── Empty state ────────────────────────────────────────── */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <EmptyFolderIcon />
            </div>
            {totalCount === 0 ? (
              <>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Sin documentos adjuntos</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Los archivos del expediente aparecerán aquí una vez que se adjunten
                    desde los módulos de diagnóstico o seguimiento.
                  </p>
                </div>
                {canEdit && (
                  <p className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                    Sube archivos desde los módulos de diagnóstico o seguimiento.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-600">Sin resultados</p>
                <p className="text-xs text-gray-400">Prueba con otros términos o cambia el filtro de módulo.</p>
                <a href="?" className="text-sm text-emerald-600 hover:underline">Limpiar filtros</a>
              </>
            )}
          </div>
        )}

        {/* ── Image grid ───────────────────────────────────────────── */}
        {images.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Imágenes ({images.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((a) => (
                <AttachmentCard
                  key={a.id}
                  attachment={a}
                  signedUrl={signedUrls[a.id]}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  showModule
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Documents list ────────────────────────────────────────── */}
        {nonImages.length > 0 && (
          <section>
            {images.length > 0 && (
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Documentos ({nonImages.length})
              </h3>
            )}
            <div className="space-y-2">
              {nonImages.map((a) => (
                <AttachmentCard
                  key={a.id}
                  attachment={a}
                  signedUrl={signedUrls[a.id]}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  showModule
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper sub-components
// ---------------------------------------------------------------------------

function FilterChip({
  label, count, active, href, color, neutral,
}: {
  label: string; count: number; active: boolean;
  href: string; color?: string; neutral?: boolean;
}) {
  const base = active
    ? neutral
      ? 'bg-gray-800 text-white border-gray-800'
      : `${color} border-transparent ring-1 ring-current/20`
    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50';

  return (
    <a href={href}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${base}`}>
      <span>{label}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
        active ? 'bg-black/10' : 'bg-gray-100 text-gray-500'
      }`}>{count}</span>
    </a>
  );
}

function SearchBar({ current, moduleFilter }: { current?: string; moduleFilter?: string }) {
  return (
    <form method="GET" className="flex gap-2">
      {moduleFilter && <input type="hidden" name="docmodule" value={moduleFilter} />}
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <SearchIcon />
        </div>
        <input
          type="search"
          name="docsearch"
          defaultValue={current}
          placeholder="Buscar por nombre o descripción…"
          className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>
      <button type="submit"
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
        Buscar
      </button>
      {current && (
        <a href={moduleFilter ? `?docmodule=${moduleFilter}` : '?'}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
          × Limpiar
        </a>
      )}
    </form>
  );
}

function FolderIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L11 7h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

function EmptyFolderIcon() {
  return (
    <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L11 7h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import FileIcon from './file-icon';
import PreviewModal from './preview-modal';
import {
  formatFileSize,
  getPreviewType,
  MODULE_LABELS,
  MODULE_COLORS,
  type AthleteAttachment,
  type AttachmentModule,
} from '@/lib/types/attachments';
import {
  updateAttachmentDescription,
  deleteAttachment,
} from '@/lib/attachments/actions';

type Props = {
  attachment: AthleteAttachment;
  signedUrl?: string;
  canEdit: boolean;
  canDelete: boolean;
  showModule?: boolean;
};

export default function AttachmentCard({
  attachment,
  signedUrl,
  canEdit,
  canDelete,
  showModule = false,
}: Props) {
  const [editing, setEditing]         = useState(false);
  const [description, setDescription] = useState(attachment.description ?? '');
  const [editError, setEditError]     = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPendingEdit, startEdit]    = useTransition();
  const [isPendingDelete, startDelete]= useTransition();
  const [deleted, setDeleted]         = useState(false);
  const [modalOpen, setModalOpen]     = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const isImage     = attachment.mime_type.startsWith('image/');
  const previewType = getPreviewType(attachment.mime_type);
  const canPreview  = previewType !== 'none';

  const uploaderName = attachment.uploader
    ? `${attachment.uploader.first_name} ${attachment.uploader.last_name}`
    : null;

  const uploadDate = new Date(attachment.uploaded_at).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (editing) descRef.current?.focus();
  }, [editing]);

  if (deleted) return null;

  function handleSaveDescription() {
    startEdit(async () => {
      const result = await updateAttachmentDescription(attachment.id, description);
      if (result.error) {
        setEditError(result.error);
      } else {
        setEditError(null);
        setEditing(false);
      }
    });
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar "${attachment.file_name_original}"?\nEsta acción no se puede deshacer.`))
      return;
    startDelete(async () => {
      const result = await deleteAttachment(attachment.id);
      if (result.error) setDeleteError(result.error);
      else setDeleted(true);
    });
  }

  return (
    <>
      <div className="group rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all overflow-hidden">

        {/* ── Image thumbnail strip (images only) ────────────────── */}
        {isImage && signedUrl && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="block w-full overflow-hidden bg-gray-100"
            title="Ver imagen completa"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedUrl}
              alt={attachment.file_name_original}
              loading="lazy"
              className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              style={{ maxHeight: 180 }}
            />
          </button>
        )}

        {/* ── Main row ───────────────────────────────────────────── */}
        <div className="flex items-start gap-3 p-3">

          {/* Icon (hidden for images when thumbnail is shown) */}
          {!isImage && <FileIcon mimeType={attachment.mime_type} size="md" />}
          {isImage && !signedUrl && <FileIcon mimeType={attachment.mime_type} size="md" />}

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-0.5">

            {/* Filename */}
            <p className="text-sm font-semibold text-gray-900 leading-snug truncate"
               title={attachment.file_name_original}>
              {attachment.file_name_original}
            </p>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400">
              <span>{formatFileSize(attachment.file_size)}</span>
              <span>·</span>
              <span className="uppercase font-medium">{attachment.file_extension}</span>
              {showModule && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  MODULE_COLORS[attachment.module_name as AttachmentModule] ?? 'bg-gray-100 text-gray-500'
                }`}>
                  {MODULE_LABELS[attachment.module_name as AttachmentModule] ?? attachment.module_name}
                  {attachment.section_name && ` · ${attachment.section_name}`}
                </span>
              )}
              <span>·</span>
              <span>{uploadDate}</span>
              {uploaderName && (
                <>
                  <span>·</span>
                  <span className="text-gray-500">{uploaderName}</span>
                </>
              )}
            </div>

            {/* Description (read mode) */}
            {!editing && attachment.description && (
              <p className="text-xs text-gray-500 italic leading-snug">
                {attachment.description}
              </p>
            )}

            {/* Description (edit mode) */}
            {editing && (
              <div className="mt-2 space-y-1.5">
                {editError && (
                  <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{editError}</p>
                )}
                <textarea
                  ref={descRef}
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción u observaciones del archivo…"
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button type="button" disabled={isPendingEdit} onClick={handleSaveDescription}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    {isPendingEdit ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button type="button"
                    onClick={() => { setEditing(false); setEditError(null); setDescription(attachment.description ?? ''); }}
                    className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Action buttons ───────────────────────────────────── */}
          <div className="flex flex-col gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">

            {/* Preview */}
            {signedUrl && canPreview && (
              <ActionBtn
                title={isImage ? 'Ver imagen' : 'Previsualizar'}
                onClick={() => setModalOpen(true)}
                color="blue"
              >
                <EyeIcon />
              </ActionBtn>
            )}

            {/* Download */}
            {signedUrl && (
              <a href={signedUrl} target="_blank" rel="noopener noreferrer" download={attachment.file_name_original}
                title="Descargar"
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                <DownloadIcon />
              </a>
            )}

            {/* Edit description */}
            {canEdit && !editing && (
              <ActionBtn title="Editar descripción" onClick={() => setEditing(true)} color="amber">
                <PencilIcon />
              </ActionBtn>
            )}

            {/* Delete */}
            {canDelete && (
              <ActionBtn title="Eliminar" onClick={handleDelete} disabled={isPendingDelete} color="red">
                {isPendingDelete ? <Spinner /> : <TrashIcon />}
              </ActionBtn>
            )}
          </div>
        </div>

        {/* Delete error */}
        {deleteError && (
          <p className="mx-3 mb-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">{deleteError}</p>
        )}
      </div>

      {/* ── Preview Modal ──────────────────────────────────────────── */}
      {modalOpen && signedUrl && (
        <PreviewModal
          fileName={attachment.file_name_original}
          fileSize={attachment.file_size}
          mimeType={attachment.mime_type}
          signedUrl={signedUrl}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared micro-components
// ---------------------------------------------------------------------------

type ActionBtnProps = {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  color: 'blue' | 'amber' | 'red' | 'emerald';
  children: React.ReactNode;
};

const COLOR_MAP: Record<ActionBtnProps['color'], string> = {
  blue:    'hover:text-blue-600 hover:bg-blue-50',
  amber:   'hover:text-amber-600 hover:bg-amber-50',
  red:     'hover:text-red-600 hover:bg-red-50',
  emerald: 'hover:text-emerald-600 hover:bg-emerald-50',
};

function ActionBtn({ title, onClick, disabled, color, children }: ActionBtnProps) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 disabled:opacity-40 transition-colors ${
        COLOR_MAP[color]
      }`}>
      {children}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-red-500 animate-spin" />
  );
}

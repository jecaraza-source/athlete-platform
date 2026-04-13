'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import AttachmentCard from './attachment-card';
import FileIcon from './file-icon';
import {
  ACCEPT_STRING,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_UPLOAD,
  formatFileSize,
  type AthleteAttachment,
  type AttachmentModule,
} from '@/lib/types/attachments';
import { uploadAttachments } from '@/lib/attachments/actions';

type Props = {
  athleteId: string;
  module: AttachmentModule;
  sectionName?: string;
  relatedRecordId?: string;
  /** Lista de adjuntos pre-cargada por el Server Component padre */
  initialAttachments: AthleteAttachment[];
  /** Mapa id → signedUrl generado en el servidor */
  signedUrls: Record<string, string>;
  canEdit: boolean;
  canDelete: boolean;
  /** Título de la sección (default: "Documentos anexos") */
  title?: string;
  /** Si se colapsa por defecto */
  defaultCollapsed?: boolean;
};

export default function AttachmentsPanel({
  athleteId,
  module,
  sectionName,
  relatedRecordId,
  initialAttachments,
  signedUrls,
  canEdit,
  canDelete,
  title = 'Documentos anexos',
  defaultCollapsed = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [stagedFiles, setStagedFiles]   = useState<File[]>([]);
  const [description, setDescription]   = useState('');
  const [stageErrors, setStageErrors]   = useState<string[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [successMsg, setSuccessMsg]     = useState<string | null>(null);
  const [isPending, startTransition]    = useTransition();

  // UI state
  const [dragging, setDragging]   = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // Stage files — validate immediately, show inline errors
  function stageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setStageErrors([]);
    setUploadErrors([]);
    setSuccessMsg(null);

    const incoming = Array.from(files);
    const errors: string[] = [];
    const valid: File[] = [];

    const remainingSlots = MAX_FILES_PER_UPLOAD - stagedFiles.length;
    if (incoming.length > remainingSlots) {
      errors.push(
        remainingSlots <= 0
          ? `Ya tienes ${MAX_FILES_PER_UPLOAD} archivos seleccionados (máximo).`
          : `Solo puedes agregar ${remainingSlots} archivo(s) más (máximo ${MAX_FILES_PER_UPLOAD}).`
      );
      setStageErrors(errors);
      return;
    }

    for (const file of incoming) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`"${file.name}" excede el tamaño máximo de 50 MB.`);
      } else if (!ALLOWED_MIME_TYPES.has(file.type)) {
        errors.push(`"${file.name}" tiene un tipo de archivo no permitido.`);
      } else {
        valid.push(file);
      }
    }

    if (errors.length > 0) setStageErrors(errors);
    if (valid.length > 0) setStagedFiles((prev) => [...prev, ...valid]);

    // Reset input so the same file can be re-added after removal
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeStagedFile(index: number) {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
    setStageErrors([]);
  }

  // Upload all staged files
  function handleUpload() {
    if (!stagedFiles.length) return;
    setUploadErrors([]);
    setSuccessMsg(null);

    const formData = new FormData();
    stagedFiles.forEach((f) => formData.append('files', f));

    startTransition(async () => {
      const result = await uploadAttachments(
        { athleteId, module, sectionName, relatedRecordId, description: description.trim() || undefined },
        formData
      );

      if (result.errors.length > 0) setUploadErrors(result.errors);

      if (result.uploaded > 0) {
        setStagedFiles([]);
        setDescription('');
        setSuccessMsg(
          result.uploaded === 1
            ? '1 archivo adjuntado correctamente.'
            : `${result.uploaded} archivos adjuntados correctamente.`
        );
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    stageFiles(e.dataTransfer.files);
  }

  const hasStagedFiles = stagedFiles.length > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100/80 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <PaperclipIcon />
          <span className="font-semibold text-sm text-gray-800">{title}</span>
          {initialAttachments.length > 0 && (
            <span className="text-xs bg-emerald-100 text-emerald-700 font-medium rounded-full px-2 py-0.5">
              {initialAttachments.length}
            </span>
          )}
        </div>
        <ChevronIcon collapsed={collapsed} />
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-100">

          {/* ── Upload zone (edit only) ───────────────────────────── */}
          {canEdit && (
            <div className="p-4 space-y-3">

              {/* Drag & drop drop-zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => !isPending && inputRef.current?.click()}
                className={[
                  'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 py-6 px-4 select-none',
                  isPending
                    ? 'border-emerald-300 bg-emerald-50/60 cursor-wait'
                    : dragging
                    ? 'border-emerald-400 bg-emerald-50 scale-[1.01]'
                    : hasStagedFiles
                    ? 'border-gray-200 bg-gray-50 hover:border-emerald-300'
                    : 'border-gray-300 bg-gray-50 hover:border-emerald-400 hover:bg-emerald-50/30',
                ].join(' ')}
              >
                {isPending ? (
                  <>
                    <UploadSpinner />
                    <p className="text-sm font-medium text-emerald-700">Subiendo archivos…</p>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                      <UploadIcon className="text-emerald-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">
                        {hasStagedFiles ? 'Agregar más archivos' : 'Arrastra archivos o haz clic para seleccionar'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        PDF · Imágenes · Word · Excel · PowerPoint · TXT · CSV
                      </p>
                      <p className="text-xs text-gray-400">
                        Máx. 50 MB por archivo · Hasta {MAX_FILES_PER_UPLOAD} archivos
                      </p>
                    </div>
                  </>
                )}
              </div>

              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT_STRING}
                className="hidden"
                onChange={(e) => stageFiles(e.target.files)}
              />

              {/* Validation errors (staging phase) */}
              {stageErrors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-0.5">
                  {stageErrors.map((e, i) => (
                    <p key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                      <span className="flex-shrink-0 mt-px">⚠</span> {e}
                    </p>
                  ))}
                </div>
              )}

              {/* Staged files list */}
              {hasStagedFiles && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-200/60">
                    <p className="text-xs font-semibold text-emerald-800">
                      {stagedFiles.length} archivo{stagedFiles.length > 1 ? 's' : ''} seleccionado{stagedFiles.length > 1 ? 's' : ''}
                    </p>
                    <button type="button" onClick={() => { setStagedFiles([]); setStageErrors([]); }}
                      className="text-xs text-emerald-600 hover:text-emerald-800 hover:underline">
                      Limpiar todo
                    </button>
                  </div>
                  <ul className="divide-y divide-emerald-100">
                    {stagedFiles.map((file, i) => (
                      <StagedFileItem key={`${file.name}-${i}`} file={file} onRemove={() => removeStagedFile(i)} />
                    ))}
                  </ul>
                </div>
              )}

              {/* Description + upload button */}
              {hasStagedFiles && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descripción u observaciones (opcional)"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleUpload}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    <UploadIcon className="text-white" />
                    Subir {stagedFiles.length} archivo{stagedFiles.length > 1 ? 's' : ''}
                  </button>
                </div>
              )}

              {/* Upload errors */}
              {uploadErrors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-0.5">
                  {uploadErrors.map((e, i) => (
                    <p key={i} className="text-xs text-red-700">⚠ {e}</p>
                  ))}
                </div>
              )}

              {/* Success */}
              {successMsg && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2">
                  <span className="text-emerald-600">✓</span>
                  <p className="text-xs font-medium text-emerald-700">{successMsg}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Attachments list ─────────────────────────────────── */}
          <div className="p-4">
            {initialAttachments.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <EmptyBoxIcon />
                </div>
                <p className="text-sm font-medium text-gray-500">Sin documentos adjuntos</p>
                <p className="text-xs text-gray-400">
                  {canEdit ? 'Sube el primer archivo usando el área de arriba.' : 'No hay archivos adjuntos en esta sección.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {initialAttachments.map((a) => (
                  <AttachmentCard
                    key={a.id}
                    attachment={a}
                    signedUrl={signedUrls[a.id]}
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StagedFileItem — file in staging before upload
// ---------------------------------------------------------------------------

function StagedFileItem({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = file.type.startsWith('image/');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setPreviewSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <li className="flex items-center gap-2.5 px-3 py-2.5">
      {/* Thumbnail or icon */}
      {previewSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewSrc} alt={file.name}
          className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-emerald-200" />
      ) : (
        <FileIcon mimeType={file.type} size="sm" />
      )}

      {/* Name + size */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{file.name}</p>
        <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
      </div>

      {/* Remove */}
      <button type="button" onClick={onRemove} title="Quitar"
        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Icon helpers
// ---------------------------------------------------------------------------

function PaperclipIcon() {
  return (
    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function UploadIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function EmptyBoxIcon() {
  return (
    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function UploadSpinner() {
  return (
    <div className="w-8 h-8 rounded-full border-3 border-emerald-200 border-t-emerald-600 animate-spin" />
  );
}

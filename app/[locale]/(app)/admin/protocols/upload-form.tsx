'use client';

import { useRef, useState, useTransition } from 'react';
import { uploadProtocol, deleteProtocol, type Protocol, type DisciplineKey } from '@/lib/protocols/actions';

type Props = {
  discipline:  DisciplineKey;
  existing:    Protocol | null;
  signedUrl:   string | null;
  label:       string;
};

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadProtocolForm({ discipline, existing, signedUrl, label }: Props) {
  const formRef        = useRef<HTMLFormElement>(null);
  const [showForm, setShowForm] = useState(!existing);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, start]      = useTransition();

  function handleUpload(formData: FormData) {
    setError(null);
    setSuccess(false);
    start(async () => {
      const result = await uploadProtocol(discipline, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setShowForm(false);
        formRef.current?.reset();
      }
    });
  }

  function handleDelete() {
    if (!existing) return;
    if (!confirm('¿Eliminar este protocolo permanentemente?')) return;
    setError(null);
    start(async () => {
      const result = await deleteProtocol(existing.id, existing.file_path);
      if (result.error) setError(result.error);
    });
  }

  const updatedDate = existing
    ? new Date(existing.updated_at).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{label}</h3>
          {existing ? (
            <p className="text-xs text-gray-400 mt-0.5">
              {existing.file_name}
              {existing.version ? ` · v${existing.version}` : ''}
              {existing.file_size ? ` · ${formatSize(existing.file_size)}` : ''}
              {updatedDate ? ` · ${updatedDate}` : ''}
            </p>
          ) : (
            <p className="text-xs text-amber-600 mt-0.5">Sin protocolo cargado</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {existing && signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline"
            >
              Ver PDF ↗
            </a>
          )}
          {existing && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="text-xs rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-50 transition-colors"
            >
              {showForm ? 'Cancelar' : 'Reemplazar'}
            </button>
          )}
          {existing && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs rounded-md border border-red-200 text-red-600 px-2 py-1 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Status indicator when file exists */}
      {existing && !showForm && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs">
            Protocolo disponible. Usa &quot;Reemplazar&quot; para subir una nueva versión.
          </span>
        </div>
      )}

      {/* Success banner */}
      {success && (
        <div className="mb-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Protocolo subido correctamente.
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Upload form */}
      {showForm && (
        <form ref={formRef} action={handleUpload} className="mt-3 space-y-3">
          {/* File input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Archivo PDF *
            </label>
            <input
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
              className="block w-full text-sm text-gray-600
                file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700
                hover:file:bg-indigo-100 cursor-pointer"
            />
            <p className="mt-1 text-xs text-gray-400">Máximo 50 MB · Solo PDF</p>
          </div>

          {/* Optional metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Título (opcional)
              </label>
              <input
                name="title"
                type="text"
                placeholder={`Protocolo ${label}`}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Versión (opcional)
              </label>
              <input
                name="version"
                type="text"
                placeholder="ej. 1.0"
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Subiendo…' : (existing ? '↑ Reemplazar protocolo' : '↑ Subir protocolo')}
          </button>
        </form>
      )}
    </div>
  );
}

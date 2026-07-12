'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { compressImage, formatFileSize } from '@/lib/bitacora/image-utils';
import { upsertPhotos, deletePhoto, setFeaturedPhoto, reorderPhotos } from '@/lib/bitacora/actions';
import {
  ACTIVITY_PHOTOS_BUCKET,
  MAX_PHOTOS_PER_ACTIVITY,
  MAX_FILE_SIZE_BYTES,
  ACCEPTED_IMAGE_TYPES,
  getThumbnailUrl,
} from '@/lib/storage-config';
import type { ActivityPhoto, PhotoInput } from '@/lib/types/bitacora';

interface PhotoUploaderProps {
  activityId:    string;
  initialPhotos: ActivityPhoto[];
}

interface LocalPhoto extends ActivityPhoto {
  isUploading?: boolean;
  uploadError?: string;
}

export function PhotoUploader({ activityId, initialPhotos }: PhotoUploaderProps) {
  const router   = useRouter();
  const [photos,   setPhotos]   = useState<LocalPhoto[]>(initialPhotos);
  const [error,    setError]    = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null); // photo id being dragged
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createSupabaseBrowserClient();

  async function uploadFiles(files: FileList) {
    const remaining = MAX_PHOTOS_PER_ACTIVITY - photos.filter((p) => !p.isUploading).length;
    if (remaining <= 0) {
      setError(`Máximo ${MAX_PHOTOS_PER_ACTIVITY} fotos por actividad.`);
      return;
    }

    const toUpload = Array.from(files).slice(0, remaining);
    setError(null);

    for (const file of toUpload) {
      // Validar tipo
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setError(`Tipo de archivo no soportado: ${file.type}`);
        continue;
      }

      // Validar tamaño antes de comprimir
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`${file.name} supera el límite de ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`);
        continue;
      }

      // Placeholder mientras sube
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempPhoto: LocalPhoto = {
        id:            tempId,
        activity_id:   activityId,
        storage_path:  '',
        caption:       null,
        display_order: photos.length,
        alt_text:      file.name.replace(/\.[^.]+$/, ''),
        featured:      false,
        created_at:    new Date().toISOString(),
        isUploading:   true,
      };
      setPhotos((prev) => [...prev, tempPhoto]);

      try {
        // Comprimir
        const compressed = await compressImage(file);

        // Subir a Supabase Storage
        const ext      = compressed.file.name.split('.').pop() ?? 'jpg';
        const path     = `${activityId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(ACTIVITY_PHOTOS_BUCKET)
          .upload(path, compressed.file, { upsert: false });

        if (uploadErr) throw new Error(uploadErr.message);

        // Registrar en BD
        const photoInput: PhotoInput = {
          storage_path:  path,
          alt_text:      file.name.replace(/\.[^.]+$/, ''),
          display_order: photos.length,
          featured:      false,
        };

        const upsertResult = await upsertPhotos(activityId, [photoInput]);
        if (upsertResult.error) throw new Error(upsertResult.error);

        // Usar el UUID real devuelto por la BD
        const realId = upsertResult.data?.[0]?.id ?? path;

        // Reemplazar placeholder con la foto real
        setPhotos((prev) => prev.map((p) =>
          p.id === tempId
            ? { ...tempPhoto, id: realId, storage_path: path, isUploading: false }
            : p
        ));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al subir';
        setPhotos((prev) => prev.map((p) =>
          p.id === tempId ? { ...p, isUploading: false, uploadError: msg } : p
        ));
      }
    }
  }

  async function handleDelete(photo: LocalPhoto) {
    if (!confirm('¿Eliminar esta foto?')) return;
    const result = await deletePhoto(photo.id, photo.storage_path);
    if (result.error) { setError(result.error); return; }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  async function handleSetFeatured(photo: LocalPhoto) {
    const result = await setFeaturedPhoto(activityId, photo.id);
    if (result.error) { setError(result.error); return; }
    setPhotos((prev) => prev.map((p) => ({ ...p, featured: p.id === photo.id })));
    router.refresh(); // sync stepper (cover photo affects step 2)
  }

  // Drag-and-drop reorder (simplified)
  function handleDragStart(id: string) { setDragging(id); }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  async function handleDrop(targetId: string) {
    if (!dragging || dragging === targetId) { setDragging(null); return; }
    const from = photos.findIndex((p) => p.id === dragging);
    const to   = photos.findIndex((p) => p.id === targetId);
    if (from === -1 || to === -1) { setDragging(null); return; }

    const reordered = [...photos];
    const [moved]   = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    setPhotos(reordered);
    setDragging(null);

    await reorderPhotos(activityId, reordered.map((p) => p.id));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Upload area */}
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-red-400 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={async (e) => {
          e.preventDefault();
          if (e.dataTransfer.files) await uploadFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
        <p className="text-sm text-gray-500">
          Arrastra fotos aquí o{' '}
          <span className="text-red-600 font-medium">haz clic para seleccionar</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Máx. {MAX_PHOTOS_PER_ACTIVITY} fotos · Comprimir automáticamente a &lt;800 KB
        </p>
        <p className="text-xs text-gray-400">
          {photos.length} / {MAX_PHOTOS_PER_ACTIVITY} fotos
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Grid de fotos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              draggable={!photo.isUploading}
              onDragStart={() => handleDragStart(photo.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(photo.id)}
              className={`relative group aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 cursor-move ${
                photo.featured ? 'border-yellow-400' : 'border-transparent'
              } ${dragging === photo.id ? 'opacity-50' : ''}`}
            >
              {photo.isUploading ? (
                <div className="flex items-center justify-center w-full h-full text-gray-400 text-xs">
                  <div className="animate-spin w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full" />
                </div>
              ) : photo.uploadError ? (
                <div className="flex items-center justify-center w-full h-full text-red-500 text-xs p-2 text-center">
                  {photo.uploadError}
                </div>
              ) : (
                <>
                  <Image
                    src={getThumbnailUrl(photo.storage_path)}
                    alt={photo.alt_text}
                    fill
                    sizes="200px"
                    className="object-cover"
                  />

                  {/* Featured badge */}
                  {photo.featured && (
                    <span className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                      ★ Portada
                    </span>
                  )}

                  {/* Hover controls */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetFeatured(photo)}
                      className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full"
                    >
                      {photo.featured ? '★ Portada' : '☆ Marcar portada'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(photo)}
                      className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full"
                    >
                      🗑 Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <p className="text-xs text-gray-400">
          Arrastra las fotos para reordenarlas. La foto con ★ se usará como portada en la Revista.
        </p>
      )}
    </div>
  );
}

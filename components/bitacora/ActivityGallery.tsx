'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ActivityPhoto } from '@/lib/types/bitacora';
import { getThumbnailUrl, getLightboxUrl } from '@/lib/storage-config';

interface ActivityGalleryProps {
  photos: ActivityPhoto[];
}

export function ActivityGallery({ photos }: ActivityGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const openLightbox  = (i: number) => setLightboxIndex(i);
  const closeLightbox = () => setLightboxIndex(null);
  const prevPhoto = () =>
    setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  const nextPhoto = () =>
    setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));

  const activePhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <>
      {/* Grid de miniaturas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => openLightbox(i)}
            className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 hover:opacity-90 transition-opacity"
            aria-label={`Ver foto: ${photo.alt_text || `Foto ${i + 1}`}`}
          >
            <Image
              src={getThumbnailUrl(photo.storage_path)}
              alt={photo.alt_text || `Foto ${i + 1}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
            {photo.featured && (
              <span className="absolute top-1 right-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                ★
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {activePhoto && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Lightbox de fotos"
        >
          {/* Contenedor de imagen */}
          <div
            className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón cerrar */}
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute -top-2 -right-2 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full w-9 h-9 flex items-center justify-center text-lg leading-none"
              aria-label="Cerrar"
            >
              ✕
            </button>

            {/* Imagen */}
            <div className="relative w-full max-h-[80vh] flex items-center justify-center">
              <img
                src={getLightboxUrl(activePhoto.storage_path)}
                alt={activePhoto.alt_text || `Foto ${lightboxIndex + 1}`}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              />
            </div>

            {/* Caption y controles */}
            <div className="flex items-center justify-between w-full text-white">
              <button
                type="button"
                onClick={prevPhoto}
                className="bg-white/20 hover:bg-white/40 px-4 py-2 rounded-lg text-sm font-medium"
                aria-label="Foto anterior"
              >
                ← Anterior
              </button>

              <div className="text-center">
                {activePhoto.caption && (
                  <p className="text-sm text-gray-300 mb-1">{activePhoto.caption}</p>
                )}
                <span className="text-xs text-gray-400">
                  {lightboxIndex + 1} / {photos.length}
                </span>
              </div>

              <button
                type="button"
                onClick={nextPhoto}
                className="bg-white/20 hover:bg-white/40 px-4 py-2 rounded-lg text-sm font-medium"
                aria-label="Siguiente foto"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

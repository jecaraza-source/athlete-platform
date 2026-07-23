'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { MagazineArticle as MagazineArticleType } from '@/lib/types/bitacora';
import { getHeroUrl, getThumbnailUrl } from '@/lib/storage-config';
import { ShareButtons } from './ShareButtons';
import { useCallback } from 'react';

interface MagazineArticleProps {
  article:       MagazineArticleType;
  appUrl:        string;
  showShare?:    boolean;
  deleteButton?: ReactNode;
}

export function MagazineArticle({ article, appUrl, showShare = true, deleteButton }: MagazineArticleProps) {
  const handlePrint = useCallback(() => window.print(), []);
  const { activity, narrative } = article;

  const coverPhoto  = activity.cover_photo;
  const otherPhotos = activity.photos.filter((p) => p.id !== coverPhoto?.id);

  const formattedDate = activity.event_date
    ? format(new Date(activity.event_date), "d 'de' MMMM 'de' yyyy", { locale: es })
    : null;

  const articleUrl = `${appUrl}/bitacora/${activity.slug}`;

  // Dividir la narrativa en párrafos
  const paragraphs = narrative.narrative_text.split(/\n+/).filter(Boolean);

  // Distribuir fotos cada 2 párrafos (excluyendo portada)
  const photoPool = [...otherPhotos];
  const photoEvery = 2; // insertar foto cada N párrafos

  // Ficha del evento — campos extendidos
  const fichaItems = [
    activity.disciplina          && { label: 'Disciplina',     value: activity.disciplina },
    activity.especialidad        && { label: 'Especialidad',   value: activity.especialidad },
    activity.actividad_tipo      && { label: 'Actividad',      value: activity.actividad_tipo },
    activity.sede                && { label: 'Sede',           value: activity.sede },
    activity.horario             && { label: 'Horario',        value: activity.horario },
    activity.numero_participantes != null && { label: 'Participantes', value: String(activity.numero_participantes) },
    activity.personal_requerido  && { label: 'Personal',      value: activity.personal_requerido },
    activity.equipo_requerido    && { label: 'Equipo',         value: activity.equipo_requerido },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <article className="max-w-2xl mx-auto print:max-w-none">
      {/* Hero */}
      {coverPhoto && (
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-6 bg-gray-100 print:rounded-none print:break-inside-avoid print-img-hero">
          <Image
            src={getHeroUrl(coverPhoto.storage_path)}
            alt={coverPhoto.alt_text || activity.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-contain"
          />
        </div>
      )}

      {/* Header del artículo */}
      <header className="mb-6">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
            {activity.disciplina ?? 'Evento Deportivo'}
          </span>
          {formattedDate && (
            <time className="text-xs text-gray-400" dateTime={activity.event_date ?? undefined}>
              {formattedDate}
            </time>
          )}
          {activity.location && (
            <span className="text-xs text-gray-400">· {activity.location}</span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-3">
          {activity.title}
        </h1>

        {activity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activity.tags.map((tag) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Divisor editorial */}
      <div className="border-t-2 border-red-600 mb-6" />

      {/* Ficha gráfica del evento */}
      {fichaItems.length > 0 && (
        <div className="mb-8 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 print:bg-gray-100 print:rounded-none">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-3">Ficha del evento</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            {fichaItems.map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-white print:text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrativa con fotos intercaladas cada 2 párrafos */}
      <div className="prose prose-gray prose-sm sm:prose-base max-w-none">
        {paragraphs.map((paragraph, i) => {
          const photoIndex = Math.floor((i + 1) / photoEvery) - 1;
          const showPhoto  = (i + 1) % photoEvery === 0 && photoPool[photoIndex];
          const photo      = showPhoto ? photoPool[photoIndex] : null;
          return (
            <div key={i}>
              <p className="text-gray-700 leading-relaxed mb-4">{paragraph}</p>
              {photo && (
                <figure className="my-6 print:break-inside-avoid">
                  <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 print:rounded-none print-img-inline">
                    <Image
                      src={getThumbnailUrl(photo.storage_path)}
                      alt={photo.alt_text}
                      fill
                      sizes="(max-width: 768px) 100vw, 600px"
                      className="object-contain"
                    />
                  </div>
                  {photo.caption && (
                    <figcaption className="text-xs text-gray-400 text-center mt-2 italic">
                      {photo.caption}
                    </figcaption>
                  )}
                </figure>
              )}
            </div>
          );
        })}
      </div>

      {/* Galería de fotos sobrantes */}
      {photoPool.length > Math.ceil(paragraphs.length / photoEvery) && (
        <div className="mt-8 print:break-before-page">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-3">Galería</h2>
          <div className="grid grid-cols-3 gap-2">
            {photoPool.slice(Math.ceil(paragraphs.length / photoEvery)).map((photo) => (
              <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 print:break-inside-avoid print-img-gallery">
                <Image
                  src={getThumbnailUrl(photo.storage_path)}
                  alt={photo.alt_text}
                  fill
                  sizes="200px"
                  className="object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share + Print + Delete */}
      <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap gap-3 items-center justify-between print:hidden">
        {showShare && (
          <ShareButtons url={articleUrl} title={activity.title} />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir / PDF
          </button>
          {deleteButton}
        </div>
      </div>
    </article>
  );
}

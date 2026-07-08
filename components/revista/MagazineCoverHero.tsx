import Image from 'next/image';
import Link from 'next/link';
import type { MagazineArticle } from '@/lib/types/bitacora';
import { getHeroUrl } from '@/lib/storage-config';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MagazineCoverHeroProps {
  article: MagazineArticle;
  locale:  string;
}

export function MagazineCoverHero({ article, locale }: MagazineCoverHeroProps) {
  const { activity } = article;
  const coverUrl = activity.cover_photo
    ? getHeroUrl(activity.cover_photo.storage_path)
    : null;

  const formattedDate = activity.event_date
    ? format(new Date(activity.event_date), "d 'de' MMMM yyyy", { locale: es })
    : null;

  return (
    <div className="relative w-full aspect-[21/9] min-h-[280px] rounded-2xl overflow-hidden bg-gray-900 shadow-xl">
      {/* Imagen de fondo */}
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={activity.title}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-70"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-red-900 to-gray-900" />
      )}

      {/* Overlay gradiente */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Contenido */}
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-red-400 bg-red-900/50 px-2.5 py-1 rounded-full">
            Artículo destacado
          </span>
          {formattedDate && (
            <span className="text-xs text-gray-300">{formattedDate}</span>
          )}
          {activity.location && (
            <span className="text-xs text-gray-400">· {activity.location}</span>
          )}
        </div>

        <h2 className="text-2xl sm:text-4xl font-bold text-white leading-tight mb-4 max-w-2xl">
          {activity.title}
        </h2>

        {activity.description && (
          <p className="text-gray-300 text-sm sm:text-base max-w-xl line-clamp-2 mb-4">
            {activity.description}
          </p>
        )}

        <Link
          href={`/${locale}/revista/${article.narrative.id}`}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          Leer artículo →
        </Link>
      </div>
    </div>
  );
}

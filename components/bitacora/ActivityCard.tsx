import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ActivityCardData } from '@/lib/types/bitacora';
import { getThumbnailUrl } from '@/lib/storage-config';

interface ActivityCardProps {
  activity: ActivityCardData;
  locale?:  string;
}

export function ActivityCard({ activity, locale = 'es' }: ActivityCardProps) {
  const href     = `/${locale}/bitacora/${activity.slug}`;
  const coverUrl = activity.cover_photo
    ? getThumbnailUrl(activity.cover_photo.storage_path)
    : null;

  const formattedDate = activity.event_date
    ? format(new Date(activity.event_date), 'd MMM yyyy', { locale: es })
    : null;

  const typeLabel = activity.type === 'evento_deportivo' ? 'Evento deportivo' : 'Consulta';
  const typeBg    = activity.type === 'evento_deportivo'
    ? 'bg-red-100 text-red-700'
    : 'bg-blue-100 text-blue-700';

  return (
    <article className="group flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Foto de portada */}
      <Link href={href} className="block relative w-full aspect-video overflow-hidden bg-gray-100">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={activity.cover_photo?.alt_text || activity.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-gray-100 text-gray-400 text-4xl">
            🏋️
          </div>
        )}
        {/* Badge tipo */}
        <span className={`absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full ${typeBg}`}>
          {typeLabel}
        </span>
      </Link>

      {/* Contenido */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {formattedDate && (
          <time className="text-xs text-gray-500" dateTime={activity.event_date ?? undefined}>
            {formattedDate}
            {activity.location && (
              <> · <span className="text-gray-400">{activity.location}</span></>
            )}
          </time>
        )}

        <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2">
          <Link href={href} className="hover:text-red-600 transition-colors">
            {activity.title}
          </Link>
        </h3>

        {activity.description && (
          <p className="text-sm text-gray-600 line-clamp-2">
            {activity.description}
          </p>
        )}

        {/* Tags */}
        {activity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto pt-2">
            {activity.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Link a Revista si tiene narrativa */}
        {activity.has_narrative && (
          <Link
            href={`/${locale}/revista`}
            className="text-xs font-medium text-red-600 hover:text-red-700 mt-1"
          >
            Leer en la Revista →
          </Link>
        )}
      </div>
    </article>
  );
}

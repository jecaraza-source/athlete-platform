import type { Metadata }             from 'next';
import { notFound }                  from 'next/navigation';
import Link                          from 'next/link';
import { format }                    from 'date-fns';
import { es }                        from 'date-fns/locale';
import { getPublicActivityBySlug }   from '@/lib/bitacora/queries';
import { ActivityGallery }           from '@/components/bitacora/ActivityGallery';
import { CommentForm }               from '@/components/bitacora/CommentForm';
import { ShareButtons }              from '@/components/revista/ShareButtons';
import { getThumbnailUrl }           from '@/lib/storage-config';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const activity = await getPublicActivityBySlug(slug);

  if (!activity) return { title: 'Actividad no encontrada' };

  const coverUrl = activity.photos[0]
    ? getThumbnailUrl(activity.photos[0].storage_path)
    : undefined;

  const url = `https://aodeporte.com/${locale}/bitacora/${slug}`;

  return {
    title:       `${activity.title} — Bitácora AO Deporte`,
    description: activity.description ?? 'AO Deporte — actividad del equipo.',
    alternates:  { canonical: url },
    openGraph: {
      title:       activity.title,
      description: activity.description ?? 'AO Deporte — actividad del equipo.',
      url,
      type:        'article',
      images:      coverUrl ? [{ url: coverUrl, alt: activity.title }] : undefined,
    },
    twitter: {
      card:        'summary_large_image',
      title:       activity.title,
      description: activity.description ?? '',
      images:      coverUrl ? [coverUrl] : undefined,
    },
  };
}

export default async function ActivityDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const activity = await getPublicActivityBySlug(slug);

  if (!activity) notFound();

  const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aodeporte.com';
  const pageUrl      = `${appUrl}/${locale}/bitacora/${slug}`;

  const formattedDate = activity.event_date
    ? format(new Date(activity.event_date), "d 'de' MMMM 'de' yyyy", { locale: es })
    : null;

  const typeLabel = activity.type === 'evento_deportivo' ? 'Evento Deportivo' : 'Consulta';

  // Schema.org/Event para SEO
  const jsonLd = activity.type === 'evento_deportivo' ? {
    '@context':   'https://schema.org',
    '@type':      'Event',
    name:         activity.title,
    description:  activity.description,
    startDate:    activity.event_date,
    location:     activity.location ? { '@type': 'Place', name: activity.location } : undefined,
    image:        activity.photos[0] ? getThumbnailUrl(activity.photos[0].storage_path) : undefined,
    url:          pageUrl,
    organizer:    { '@type': 'Organization', name: 'AO Deporte', url: 'https://aodeporte.com' },
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 mb-6">
          <Link href={`/${locale}/bitacora`} className="hover:text-red-600 transition-colors">
            ← Volver a Bitácora
          </Link>
        </nav>

        {/* Header */}
        <header className="mb-6">
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
              {typeLabel}
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

        {/* Descripción */}
        {activity.description && (
          <p className="text-gray-700 leading-relaxed mb-8">
            {activity.description}
          </p>
        )}

        {/* Galería */}
        {activity.photos.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-3">Fotos</h2>
            <ActivityGallery photos={activity.photos} />
          </section>
        )}

        {/* Link a Revista si tiene narrativa */}
        {activity.narrative && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8 flex items-center justify-between gap-3">
            <p className="text-sm text-red-700 font-medium">
              Este evento tiene una narrativa editorial en la Revista.
            </p>
            <Link
              href={`/${locale}/revista/${activity.narrative.id}`}
              className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Leer en la Revista →
            </Link>
          </div>
        )}

        {/* Compartir */}
        <div className="mb-10">
          <ShareButtons url={pageUrl} title={activity.title} />
        </div>

        {/* Comentarios */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Comentarios ({activity.comments.length})
          </h2>

          {activity.comments.length > 0 ? (
            <div className="flex flex-col gap-4 mb-6">
              {activity.comments.map((comment) => (
                <div key={comment.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-800 text-sm">{comment.author_name}</span>
                    <time className="text-xs text-gray-400">
                      {format(new Date(comment.created_at), 'd MMM yyyy', { locale: es })}
                    </time>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">{comment.comment}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-6">Sé el primero en comentar.</p>
          )}

          {/* Formulario de comentario */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <CommentForm activityId={activity.id} />
          </div>
        </section>
      </div>
    </>
  );
}

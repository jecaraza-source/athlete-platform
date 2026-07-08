import type { Metadata }         from 'next';
import Link                      from 'next/link';
import Image                     from 'next/image';
import { getMagazineArticles }   from '@/lib/bitacora/queries';
import { MagazineCoverHero }     from '@/components/revista/MagazineCoverHero';
import { getThumbnailUrl }       from '@/lib/storage-config';
import { format }                from 'date-fns';
import { es }                    from 'date-fns/locale';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title:       'Revista AO Deporte',
    description: 'Narrativas editoriales de nuestros eventos y actividades.',
    alternates:  { canonical: `https://aodeporte.com/${locale}/revista` },
    openGraph: {
      title:       'Revista AO Deporte',
      description: 'Narrativas editoriales de nuestros eventos y actividades.',
      type:        'website',
    },
  };
}

export default async function RevistaPage({ params }: PageProps) {
  const { locale }  = await params;
  const articles    = await getMagazineArticles(20);
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aodeporte.com';

  const featured = articles[0] ?? null;
  const rest      = articles.slice(1);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-red-600 mb-2">AO Deporte</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Revista</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          Narrativas editoriales de nuestros eventos y actividades, para atletas, staff y familias.
        </p>
        <div className="mt-4 border-t-2 border-red-600 w-16 mx-auto" />
      </div>

      {articles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">La Revista todavía no tiene artículos publicados.</p>
          <p className="text-sm mt-2">¡Pronto habrá contenido!</p>
        </div>
      ) : (
        <>
          {/* Hero featured */}
          {featured && (
            <div className="mb-12">
              <MagazineCoverHero article={featured} locale={locale} />
            </div>
          )}

          {/* Resto de artículos */}
          {rest.length > 0 && (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-6">
                Más artículos
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.map((article) => {
                  const { activity, narrative } = article;
                  const coverUrl = activity.cover_photo
                    ? getThumbnailUrl(activity.cover_photo.storage_path)
                    : null;
                  const formattedDate = activity.event_date
                    ? format(new Date(activity.event_date), 'd MMM yyyy', { locale: es })
                    : null;
                  const excerpt = narrative.narrative_text.slice(0, 120).trim() + '…';

                  return (
                    <article key={narrative.id} className="flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                      {coverUrl ? (
                        <Link href={`/${locale}/revista/${narrative.id}`} className="block relative w-full aspect-[16/9] overflow-hidden bg-gray-100">
                          <Image src={coverUrl} alt={activity.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover hover:scale-105 transition-transform duration-300" />
                        </Link>
                      ) : null}
                      <div className="flex flex-col flex-1 p-4 gap-2">
                        {formattedDate && <time className="text-xs text-gray-400">{formattedDate}</time>}
                        <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2">
                          <Link href={`/${locale}/revista/${narrative.id}`} className="hover:text-red-600 transition-colors">
                            {activity.title}
                          </Link>
                        </h3>
                        <p className="text-sm text-gray-500 line-clamp-2">{excerpt}</p>
                        <Link href={`/${locale}/revista/${narrative.id}`} className="text-xs font-semibold text-red-600 hover:text-red-700 mt-auto pt-2">
                          Leer artículo →
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

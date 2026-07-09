import { Suspense }          from 'react';
import type { Metadata }     from 'next';
import { getPublicActivities, getPublicTags } from '@/lib/bitacora/queries';
import { ActivityCard }       from '@/components/bitacora/ActivityCard';
import { ActivityFilters }    from '@/components/bitacora/ActivityFilters';
import type { ActivityType }  from '@/lib/types/bitacora';

interface PageProps {
  params:      Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title:       'Bitácora — AO Deporte',
    description: 'Actividades, eventos y momentos del equipo AO Deporte.',
    alternates:  { canonical: `https://aodeporte.com/${locale}/bitacora` },
    openGraph: {
      title:       'Bitácora — AO Deporte',
      description: 'Actividades, eventos y momentos del equipo AO Deporte.',
      type:        'website',
      url:         `https://aodeporte.com/${locale}/bitacora`,
    },
  };
}

export default async function BitacoraPage({ params, searchParams }: PageProps) {
  const { locale }  = await params;
  const sp          = await searchParams;

  const type    = sp.type as ActivityType | undefined;
  const tag     = sp.tag;
  const month   = sp.month;
  const page    = sp.page ? Number(sp.page) : 1;

  const [{ activities, total, perPage }, tags] = await Promise.all([
    getPublicActivities({ type, tag, month, page }),
    getPublicTags(),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bitácora</h1>
        <p className="text-gray-500">
          Actividades, eventos y momentos del equipo AO Deporte.
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-6">
        <Suspense fallback={null}>
          <ActivityFilters
            availableTags={tags}
            selectedType={type}
            selectedTag={tag}
            selectedMonth={month}
          />
        </Suspense>
      </div>

      {/* Grid */}
      {activities.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No hay actividades publicadas todavía.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} locale={locale} />
            ))}
          </div>

          {/* Paginación simple */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              {page > 1 && (
                <a
                  href={`?${new URLSearchParams({ ...(type ? { type } : {}), ...(tag ? { tag } : {}), ...(month ? { month } : {}), page: String(page - 1) }).toString()}`}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  ← Anterior
                </a>
              )}
              <span className="text-sm text-gray-500">
                Página {page} de {totalPages}
              </span>
              {page < totalPages && (
                <a
                  href={`?${new URLSearchParams({ ...(type ? { type } : {}), ...(tag ? { tag } : {}), ...(month ? { month } : {}), page: String(page + 1) }).toString()}`}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  Siguiente →
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

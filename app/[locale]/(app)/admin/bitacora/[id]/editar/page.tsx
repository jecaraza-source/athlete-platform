import Link                        from 'next/link';
import { notFound }                from 'next/navigation';
import { requireAdminAccess }      from '@/lib/rbac/server';
import { getAdminActivityById }    from '@/lib/bitacora/queries';
import { ActivityAdminForm }       from '@/components/bitacora/ActivityAdminForm';
import { PhotoUploader }           from '@/components/bitacora/PhotoUploader';
import { NarrativeReviewPanel }    from '@/components/bitacora/NarrativeReviewPanel';
import { CommentModerationPanel }  from '@/components/bitacora/CommentModerationPanel';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditarActividadPage({ params }: PageProps) {
  await requireAdminAccess();
  const { locale, id } = await params;

  const activity = await getAdminActivityById(id);
  if (!activity) notFound();

  const isPublished = activity.status === 'publicado';

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400">
        <Link href={`/${locale}/admin/bitacora`} className="hover:text-red-600 transition-colors">
          ← Volver a Bitácora
        </Link>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 line-clamp-2">{activity.title}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {isPublished ? (
              <span className="text-green-600 font-medium">● Publicada</span>
            ) : (
              <span className="text-gray-400">○ Borrador</span>
            )}
            {' · '}
            {activity.type === 'evento_deportivo' ? 'Evento deportivo' : 'Consulta'}
          </p>
        </div>

        {isPublished && (
          <Link
            href={`/${locale}/bitacora/${activity.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            Ver en público ↗
          </Link>
        )}
      </div>

      {/* Sección 1: Datos de la actividad */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
          Información
        </h2>
        <ActivityAdminForm activity={activity} locale={locale} />
      </section>

      {/* Sección 2: Fotos */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
          Fotos ({activity.photos.length})
        </h2>
        <PhotoUploader activityId={id} initialPhotos={activity.photos} />
      </section>

      {/* Sección 3: Narrativa AI */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
          Narrativa AI / Revista
        </h2>
        <NarrativeReviewPanel
          activityId={id}
          narrative={activity.narrative}
          isEligible={activity.editorial_eligible}
          isPublished={isPublished}
        />
      </section>

      {/* Sección 4: Comentarios */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
          Comentarios ({activity.comments.length})
        </h2>
        <CommentModerationPanel comments={activity.comments} />
      </section>
    </div>
  );
}

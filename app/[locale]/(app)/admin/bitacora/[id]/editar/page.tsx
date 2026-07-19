import Link                        from 'next/link';
import { notFound }                from 'next/navigation';
import { requireAdminAccess }      from '@/lib/rbac/server';
import { getAdminActivityById }    from '@/lib/bitacora/queries';
import { ActivityAdminForm }       from '@/components/bitacora/ActivityAdminForm';
import { PhotoUploader }           from '@/components/bitacora/PhotoUploader';
import { NarrativeReviewPanel }    from '@/components/bitacora/NarrativeReviewPanel';
import { CommentModerationPanel }  from '@/components/bitacora/CommentModerationPanel';
import { BitacoraPublishStepper }  from '@/components/bitacora/BitacoraPublishStepper';
import { NextActionCallout }       from '@/components/bitacora/NextActionCallout';
import { MagazineActionBar }       from '@/components/bitacora/MagazineActionBar';
import { GalleryPhotoImporter }    from '@/components/bitacora/GalleryPhotoImporter';
import { fetchImportablePhotos }   from '@/lib/historiaGraficaQueries';
import { computePublishSteps }     from '@/lib/bitacora/stepper-logic';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditarActividadPage({ params }: PageProps) {
  await requireAdminAccess();
  const { locale, id } = await params;

  const activity = await getAdminActivityById(id);
  if (!activity) notFound();

  // Pre-fetch Historia Gráfica photos server-side to avoid client auth issues
  const importablePhotos = await fetchImportablePhotos(id);

  // Derived state used by section headers, callout and action bar
  const isPublished     = activity.status === 'publicado';
  const hasCover        = activity.photos.some((p) => p.featured);
  const pendingComments = activity.comments.filter((c) => !c.approved).length;
  const narrativeStatus = activity.narrative?.status ?? null;
  const narrativeId     = activity.narrative?.id     ?? null;
  const doneCount       = computePublishSteps(activity, locale).filter((s) => s.state === 'done').length;

  // Narrative status badge config
  const narrativeBadge = narrativeStatus === 'aprobado'
    ? { label: '✓ Aprobada',  cls: 'bg-green-100 text-green-700' }
    : narrativeStatus === 'borrador'
    ? { label: 'Borrador',    cls: 'bg-yellow-100 text-yellow-700' }
    : narrativeStatus === 'rechazado'
    ? { label: 'Rechazada',   cls: 'bg-red-100 text-red-600' }
    : null;

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6 pb-24">

      {/* ── Top bar: breadcrumb + title + links ─────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <nav className="text-xs text-gray-400">
            <Link href={`/${locale}/admin/bitacora`} className="hover:text-red-600 transition-colors">
              ← Bitácora
            </Link>
          </nav>
          <h1 className="text-xl font-bold text-gray-900 line-clamp-2 leading-tight">
            {activity.title}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {activity.type === 'evento_deportivo' ? 'Evento deportivo' : 'Consulta'}
            {' · '}
            {isPublished ? (
              <span className="text-green-600 font-semibold">● Publicada</span>
            ) : (
              <span className="text-gray-400 font-medium">○ Borrador</span>
            )}
          </p>
        </div>

        {/* Quick external links */}
        <div className="flex shrink-0 gap-2">
          {isPublished && (
            <Link
              href={`/${locale}/bitacora/${activity.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              Bitácora pública ↗
            </Link>
          )}
          {narrativeStatus === 'aprobado' && activity.narrative && (
            <Link
              href={`/${locale}/revista/${activity.narrative.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-semibold"
            >
              Ver en Revista ↗
            </Link>
          )}
        </div>
      </div>

      {/* ── Stepper: flujo de 6 pasos ───────────────────────────────────── */}
      <BitacoraPublishStepper activity={activity} locale={locale} />

      {/* ── Siguiente acción: banner contextual ────────────────────────── */}
      <NextActionCallout activity={activity} />

      {/* ── Sección 1: Información ─────────────────────────────────────── */}
      <section id="section-info" className="scroll-mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 pb-2 border-b border-gray-100 flex items-center justify-between">
          <span>Información</span>
          {isPublished && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full normal-case tracking-normal bg-green-100 text-green-700">
              ● Publicada
            </span>
          )}
        </h2>
        <ActivityAdminForm activity={activity} locale={locale} />
      </section>

      {/* ── Sección 2: Fotos ────────────────────────────────────────────── */}
      <section id="section-fotos" className="scroll-mt-6">
        <div className="flex items-center justify-between gap-4 mb-4 pb-2 border-b border-gray-100">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-3">
            <span>Fotos ({activity.photos.length})</span>
            {hasCover ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full normal-case tracking-normal bg-green-100 text-green-700">
                ★ Portada lista
              </span>
            ) : activity.photos.length > 0 ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full normal-case tracking-normal bg-amber-100 text-amber-700">
                Sin portada marcada
              </span>
            ) : null}
          </h2>
          {/* Import from Historia Gráfica */}
          <GalleryPhotoImporter
            activityId={id}
            currentPhotoCount={activity.photos.length}
            initialPhotos={importablePhotos}
          />
        </div>
        <PhotoUploader activityId={id} initialPhotos={activity.photos} />
      </section>

      {/* ── Sección 3: Narrativa AI / Revista ──────────────────────────── */}
      <section id="section-narrativa" className="scroll-mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 pb-2 border-b border-gray-100 flex items-center justify-between">
          <span>Narrativa AI / Revista</span>
          {narrativeBadge && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full normal-case tracking-normal ${narrativeBadge.cls}`}>
              {narrativeBadge.label}
            </span>
          )}
        </h2>
        <NarrativeReviewPanel
          activityId={id}
          narrative={activity.narrative}
          isEligible={activity.editorial_eligible}
          isPublished={isPublished}
          locale={locale}
        />
      </section>

      {/* ── Sección 4: Comentarios ──────────────────────────────────────── */}
      <section id="section-comentarios" className="scroll-mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 pb-2 border-b border-gray-100 flex items-center justify-between">
          <span>Comentarios ({activity.comments.length})</span>
          {pendingComments > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full normal-case tracking-normal bg-amber-100 text-amber-700">
              {pendingComments} pendiente{pendingComments > 1 ? 's' : ''}
            </span>
          )}
        </h2>
        <CommentModerationPanel comments={activity.comments} />
      </section>


      {/* ── Barra de acción flotante ───────────────────────────────────────── */}
      <MagazineActionBar
        activityId={id}
        narrativeId={narrativeId}
        isPublished={isPublished}
        hasPhotos={activity.photos.length > 0}
        hasCover={hasCover}
        isEligible={activity.editorial_eligible}
        narrativeStatus={narrativeStatus}
        doneCount={doneCount}
      />

    </div>
  );
}

import Link                        from 'next/link';
import { requireAdminAccess }       from '@/lib/rbac/server';
import { getAdminActivities }       from '@/lib/bitacora/queries';
import { StorageUsageIndicator }    from '@/components/bitacora/StorageUsageIndicator';
import { NarrativeQuickApprove }    from '@/components/bitacora/NarrativeQuickApprove';
import { format }                   from 'date-fns';
import { es }                       from 'date-fns/locale';
import type { ActivityStatus }      from '@/lib/types/bitacora';

interface PageProps {
  params:       Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

// ── Etapa del flujo editorial (combina status + narrative_status) ─────────────
type EtapaConfig = { label: string; cls: string; actionLabel: string };

function getEtapa(
  status:          ActivityStatus,
  narrativeStatus: string | null,
  editorialElig:   boolean,
): EtapaConfig {
  if (narrativeStatus === 'aprobado') {
    return { label: '★ En Revista',        cls: 'bg-green-100 text-green-700',  actionLabel: 'Ver' };
  }
  if (narrativeStatus === 'borrador') {
    return { label: '✓ Por aprobar',       cls: 'bg-yellow-100 text-yellow-700', actionLabel: 'Revisar' };
  }
  if (narrativeStatus === 'rechazado') {
    return { label: '↺ Narrativa rechazada', cls: 'bg-red-100 text-red-600',      actionLabel: 'Regenerar' };
  }
  if (status === 'publicado' && editorialElig) {
    return { label: '✦ Generar narrativa',  cls: 'bg-blue-100 text-blue-700',    actionLabel: 'Generar' };
  }
  if (status === 'publicado') {
    return { label: '● Publicado',          cls: 'bg-blue-50 text-blue-500',     actionLabel: 'Editar' };
  }
  return   { label: '○ Borrador',           cls: 'bg-gray-100 text-gray-500',    actionLabel: 'Editar' };
}

// Builds the edit page href with a section anchor where relevant
function getEditHref(baseHref: string, etapa: EtapaConfig, narrativeStatus: string | null): string {
  if (narrativeStatus === 'borrador' || narrativeStatus === 'rechazado') {
    return `${baseHref}#section-narrativa`;
  }
  if (etapa.actionLabel === 'Generar') {
    return `${baseHref}#section-narrativa`;
  }
  return baseHref;
}

export default async function AdminBitacoraPage({ params, searchParams }: PageProps) {
  await requireAdminAccess();

  const { locale } = await params;
  const sp         = await searchParams;

  const { activities, total } = await getAdminActivities({
    status: sp.status as ActivityStatus | undefined,
    type:   sp.type as ('evento_deportivo' | 'consulta') | undefined,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bitácora</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} actividades en total</p>
        </div>
        <Link
          href={`/${locale}/admin/bitacora/nueva`}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + Nueva actividad
        </Link>
      </div>

      {/* Indicador de storage */}
      <StorageUsageIndicator />

      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-2">
        {[
          { href: `/${locale}/admin/bitacora`,                        label: 'Todas' },
          { href: `/${locale}/admin/bitacora?status=borrador`,         label: 'Borrador' },
          { href: `/${locale}/admin/bitacora?status=publicado`,        label: 'Publicadas' },
        ].map(({ href, label }) => (
          <Link
            key={label}
            href={href}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Tabla */}
      {activities.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No hay actividades todavía.</p>
          <Link href={`/${locale}/admin/bitacora/nueva`} className="text-red-600 hover:underline text-sm mt-2 inline-block">
            Crear la primera actividad →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Título</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Fecha</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Fotos</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Coment.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Etapa del flujo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activities.map((activity) => {
                const etapa = getEtapa(
                  activity.status,
                  activity.narrative_status,
                  activity.editorial_eligible,
                );
                const date     = activity.event_date
                  ? format(new Date(activity.event_date), 'd MMM yyyy', { locale: es })
                  : '—';
                const baseHref = `/${locale}/admin/bitacora/${activity.id}/editar`;
                const editHref = getEditHref(baseHref, etapa, activity.narrative_status);

                return (
                  <tr key={activity.id} className="hover:bg-gray-50 transition-colors group">
                    {/* Título */}
                    <td className="px-4 py-3">
                      <Link
                        href={editHref}
                        className="font-medium text-gray-900 hover:text-red-600 transition-colors line-clamp-1 block"
                      >
                        {activity.title}
                      </Link>
                      {activity.editorial_eligible && (
                        <span className="text-[11px] text-amber-600">✦ Elegible revista</span>
                      )}
                    </td>

                    {/* Tipo */}
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-400 text-xs">
                      {activity.type === 'evento_deportivo' ? 'Evento' : 'Consulta'}
                    </td>

                    {/* Fecha */}
                    <td className="px-4 py-3 hidden md:table-cell text-gray-400 text-xs">{date}</td>

                    {/* Fotos */}
                    <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-400 text-xs">
                      {activity.photo_count}
                    </td>

                    {/* Comentarios */}
                    <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-400 text-xs">
                      {activity.comment_count}
                    </td>

                    {/* Etapa del flujo + acciones inline */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-col gap-1.5">
                        <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${etapa.cls}`}>
                          {etapa.label}
                        </span>
                        {/* Approve/reject inline for borrador narratives */}
                        {activity.narrative_status === 'borrador' && activity.narrative_id && (
                          <NarrativeQuickApprove narrativeId={activity.narrative_id} />
                        )}
                      </div>
                    </td>

                    {/* Acción */}
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={editHref}
                        className="text-xs text-red-600 font-semibold hover:underline whitespace-nowrap"
                      >
                        {etapa.actionLabel} →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

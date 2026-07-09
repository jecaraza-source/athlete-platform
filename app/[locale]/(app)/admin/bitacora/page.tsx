import Link                        from 'next/link';
import { requireAdminAccess }       from '@/lib/rbac/server';
import { getAdminActivities }       from '@/lib/bitacora/queries';
import { StorageUsageIndicator }    from '@/components/bitacora/StorageUsageIndicator';
import { format }                   from 'date-fns';
import { es }                       from 'date-fns/locale';
import type { ActivityStatus }      from '@/lib/types/bitacora';

interface PageProps {
  params:       Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const statusConfig: Record<ActivityStatus, { label: string; class: string }> = {
  borrador:  { label: 'Borrador',  class: 'bg-gray-100 text-gray-600' },
  publicado: { label: 'Publicado', class: 'bg-green-100 text-green-700' },
};

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
          { href: `/${locale}/admin/bitacora`,            label: 'Todas' },
          { href: `/${locale}/admin/bitacora?status=borrador`,  label: 'Borrador' },
          { href: `/${locale}/admin/bitacora?status=publicado`, label: 'Publicadas' },
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
                <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Fotos</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Coment.</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Narrativa</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activities.map((activity) => {
                const badge = statusConfig[activity.status];
                const date  = activity.event_date
                  ? format(new Date(activity.event_date), 'd MMM yyyy', { locale: es })
                  : '—';

                return (
                  <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 line-clamp-1">{activity.title}</p>
                      {activity.editorial_eligible && (
                        <span className="text-xs text-amber-600">✦ Elegible revista</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-500">
                      {activity.type === 'evento_deportivo' ? 'Evento' : 'Consulta'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">{date}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.class}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-400">
                      {activity.photo_count}
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-400">
                      {activity.comment_count}
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      {activity.has_narrative
                        ? <span className="text-green-500 text-xs font-bold">✓</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/${locale}/admin/bitacora/${activity.id}/editar`}
                        className="text-xs text-red-600 font-semibold hover:underline"
                      >
                        Editar
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

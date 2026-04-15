import Link from 'next/link';
import { requirePermission } from '@/lib/rbac/server';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';

export const dynamic = 'force-dynamic';

export default async function PushTemplatesPage() {
  await requirePermission('manage_notification_templates');

  const { data: templates } = await supabaseAdmin
    .from('push_templates')
    .select('id, name, title, message, status, version, updated_at')
    .order('name');

  return (
    <main className="p-8">
      <BackButton href="/admin/notificaciones/push" label="Volver a Push" />

      <div className="mt-4 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-violet-700">Plantillas Push</h1>
          <p className="text-sm text-gray-500 mt-1">Plantillas para notificaciones push.</p>
        </div>
        <Link href="/admin/notificaciones/push/plantillas/nueva"
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
          + Nueva plantilla
        </Link>
      </div>

      {!templates || templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
          No hay plantillas push. Crea la primera.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Título</th>
                <th className="px-4 py-3 text-left">Mensaje</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{t.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{t.title}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-xs">{t.message}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {t.status === 'active' ? 'Activa' : t.status === 'draft' ? 'Borrador' : 'Archivada'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/notificaciones/push/plantillas/${t.id}`}
                      className="text-xs text-violet-600 hover:underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

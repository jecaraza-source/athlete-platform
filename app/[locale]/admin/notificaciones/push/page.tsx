import Link from 'next/link';
import { requirePermission }  from '@/lib/rbac/server';
import { supabaseAdmin }      from '@/lib/supabase-admin';
import { getPushOverallStats, getActiveDeviceCount } from '@/lib/notifications/analytics';
import BackButton from '@/components/back-button';
import PushCampaignRow from './push-campaign-row';

export const dynamic = 'force-dynamic';

export default async function PushCampaignsPage() {
  await requirePermission('manage_push_campaigns');

  const [{ data: campaigns }, stats, activeDevices] = await Promise.all([
    supabaseAdmin
      .from('push_campaigns')
      .select('id, name, status, audience_type, selection_mode, scheduled_at, sent_at, created_at')
      .order('created_at', { ascending: false }),
    getPushOverallStats(),
    getActiveDeviceCount(),
  ]);

  return (
    <main className="p-8">
      <BackButton href="/admin/notificaciones" label="Volver a Notificaciones" />

      <div className="mt-4 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-violet-700">Push Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            Envía notificaciones push a los dispositivos móviles.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/notificaciones/push/dispositivos"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Dispositivos
          </Link>
          <Link
            href="/admin/notificaciones/push/plantillas"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Plantillas
          </Link>
          <Link
            href="/admin/notificaciones/push/nueva"
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            + Nueva campaña
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Dispositivos activos', value: activeDevices },
          { label: 'Total enviados',       value: stats.sent },
          { label: 'Pendientes',           value: stats.pending },
          { label: 'Fallidos',             value: stats.failed },
          { label: 'Token inválido',       value: stats.invalid_token },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {!campaigns || campaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
          No hay campañas push. Crea la primera.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Audiencia</th>
                <th className="px-4 py-3 text-left">Programado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((c) => (
                <PushCampaignRow key={c.id} campaign={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

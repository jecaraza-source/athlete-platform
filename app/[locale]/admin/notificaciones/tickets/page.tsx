import Link from 'next/link';
import { requirePermission } from '@/lib/rbac/server';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import { getTicketEmailStats } from '@/lib/notifications/analytics';
import BackButton from '@/components/back-button';

export const dynamic = 'force-dynamic';

export default async function TicketEmailsPage() {
  await requirePermission('manage_ticket_emails');

  const [{ data: templates }, { data: rules }, stats] = await Promise.all([
    supabaseAdmin
      .from('ticket_email_templates')
      .select('id, event_key, name, is_active, updated_at')
      .order('event_key'),
    supabaseAdmin
      .from('ticket_automation_rules')
      .select('id, name, trigger_event, delay_minutes, is_active, updated_at')
      .order('created_at', { ascending: false }),
    getTicketEmailStats(),
  ]);

  return (
    <main className="p-8">
      <BackButton href="/admin/notificaciones" label="Volver a Notificaciones" />

      <div className="mt-4 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-amber-700">Correos de Seguimiento de Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona plantillas, reglas de automatización y el historial de correos de tickets.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/notificaciones/tickets/reglas"
            className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
          >
            Ver todas las reglas
          </Link>
          <Link
            href="/admin/notificaciones/tickets/reglas/nueva"
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            + Nueva regla
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total correos',   value: stats.total },
          { label: 'Enviados',        value: stats.sent },
          { label: 'Fallidos',        value: stats.failed },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
        <div className="rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{Object.keys(stats.by_type).length}</p>
          <p className="text-xs text-gray-500 mt-1">Tipos de email</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Templates */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Plantillas de Eventos</h2>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            {!templates || templates.length === 0 ? (
              <p className="p-6 text-sm text-gray-400 text-center italic">Sin plantillas.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left">Evento</th>
                    <th className="px-4 py-2 text-left">Estado</th>
                    <th className="px-4 py-2 text-right">Editar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {templates.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs text-gray-700">{t.event_key}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {t.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link href={`/admin/notificaciones/tickets/plantillas/${t.id}`} className="text-xs text-amber-600 hover:underline">
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Automation rules */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Reglas de Automatización</h2>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            {!rules || rules.length === 0 ? (
              <p className="p-6 text-sm text-gray-400 text-center italic">Sin reglas.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left">Nombre</th>
                    <th className="px-4 py-2 text-left">Evento</th>
                    <th className="px-4 py-2 text-left">Demora</th>
                    <th className="px-4 py-2 text-left">Estado</th>
                    <th className="px-4 py-2 text-right">Editar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-800 font-medium">{r.name}</td>
                      <td className="px-4 py-2 text-xs font-mono text-gray-500">{r.trigger_event}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {r.delay_minutes === 0 ? 'Inmediato' : `${r.delay_minutes}m`}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link href={`/admin/notificaciones/tickets/reglas/${r.id}`} className="text-xs text-amber-600 hover:underline">
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

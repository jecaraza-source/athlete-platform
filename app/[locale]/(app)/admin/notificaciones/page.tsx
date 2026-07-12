import Link from 'next/link';
import { requirePermission } from '@/lib/rbac/server';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';

export const dynamic = 'force-dynamic';

export default async function NotificacionesHubPage() {
  await requirePermission('view_notification_logs');

  // Count pending newsletter drafts for the badge
  const { count: pendingNewsletters } = await supabaseAdmin
    .from('newsletter_drafts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  return (
    <main className="p-8">
      <BackButton href="/admin" label="Volver a Admin" />
      <h1 className="text-3xl font-bold mt-4 text-rose-700">Notificaciones</h1>
      <p className="mt-2 text-gray-600 mb-8">
        Gestión centralizada de recordatorios, push, newsletter diario y correos de seguimiento.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Module 1 */}
        <Link
          href="/admin/notificaciones/email"
          className="rounded-lg border border-rose-200 bg-rose-50 p-6 hover:bg-rose-100 transition-colors"
        >
          <div className="text-2xl mb-3">📧</div>
          <h2 className="text-lg font-semibold text-rose-800">Recordatorios por Email</h2>
          <p className="text-sm text-rose-600 mt-1">
            Crea y programa campañas de correo para atletas y staff.
          </p>
          <ul className="mt-3 text-xs text-rose-500 space-y-0.5">
            <li>· Campañas individuales y colectivas</li>
            <li>· Plantillas con variables</li>
            <li>· Recurrencia y programación</li>
            <li>· Logs de entrega</li>
          </ul>
        </Link>

        {/* Module 2 */}
        <Link
          href="/admin/notificaciones/push"
          className="rounded-lg border border-violet-200 bg-violet-50 p-6 hover:bg-violet-100 transition-colors"
        >
          <div className="text-2xl mb-3">📱</div>
          <h2 className="text-lg font-semibold text-violet-800">Push Notifications</h2>
          <p className="text-sm text-violet-600 mt-1">
            Envía notificaciones push a dispositivos móviles vía OneSignal.
          </p>
          <ul className="mt-3 text-xs text-violet-500 space-y-0.5">
            <li>· Campañas a atletas y staff</li>
            <li>· Deep links y payloads</li>
            <li>· Gestión de dispositivos</li>
            <li>· Tokens inválidos auto-desactivados</li>
          </ul>
        </Link>

        {/* Module 3 */}
        <Link
          href="/admin/notificaciones/tickets"
          className="rounded-lg border border-amber-200 bg-amber-50 p-6 hover:bg-amber-100 transition-colors"
        >
          <div className="text-2xl mb-3">🎫</div>
          <h2 className="text-lg font-semibold text-amber-800">Correos de Tickets</h2>
          <p className="text-sm text-amber-600 mt-1">
            Recordatorios y seguimiento por correo integrados con el sistema de tickets.
          </p>
          <ul className="mt-3 text-xs text-amber-500 space-y-0.5">
            <li>· Envíos manuales y automáticos</li>
            <li>· Reglas SLA configurables</li>
            <li>· 9 plantillas de eventos</li>
            <li>· Historial en cada ticket</li>
          </ul>
        </Link>

        {/* Newsletter Diario */}
        <Link
          href="/admin/notificaciones/newsletter"
          className="rounded-lg border border-teal-200 bg-teal-50 p-6 hover:bg-teal-100 transition-colors relative"
        >
          {(pendingNewsletters ?? 0) > 0 && (
            <span className="absolute top-3 right-3 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500 text-white">
              {pendingNewsletters}
            </span>
          )}
          <div className="text-2xl mb-3">📰</div>
          <h2 className="text-lg font-semibold text-teal-800">Newsletter Diario</h2>
          <p className="text-sm text-teal-600 mt-1">
            Tips automáticos generados con IA para atletas y coaches.
          </p>
          <ul className="mt-3 text-xs text-teal-500 space-y-0.5">
            <li>· Generación diaria con Claude AI</li>
            <li>· Flujo de aprobación antes del envío</li>
            <li>· Editor de tips inline</li>
            <li>· Entrega por email vía OneSignal</li>
          </ul>
        </Link>

        {/* Scheduler */}
        <Link
          href="/admin/notificaciones/scheduler"
          className="rounded-lg border border-gray-200 bg-gray-50 p-6 hover:bg-gray-100 transition-colors"
        >
          <div className="text-2xl mb-3">⏱️</div>
          <h2 className="text-lg font-semibold text-gray-800">Scheduler</h2>
          <p className="text-sm text-gray-600 mt-1">
            Estado de la cola, jobs fallidos y ejecución manual.
          </p>
          <ul className="mt-3 text-xs text-gray-500 space-y-0.5">
            <li>· Campañas programadas pendientes</li>
            <li>· Backlog de jobs</li>
            <li>· Trigger manual (dev)</li>
          </ul>
        </Link>

        {/* Aviso de Privacidad */}
        <Link
          href="/privacy-policy"
          className="rounded-lg border border-indigo-200 bg-indigo-50 p-6 hover:bg-indigo-100 transition-colors"
        >
          <div className="text-2xl mb-3">🔒</div>
          <h2 className="text-lg font-semibold text-indigo-800">Aviso de Privacidad</h2>
          <p className="text-sm text-indigo-600 mt-1">
            Consulta el aviso de privacidad y tratamiento de datos personales.
          </p>
          <ul className="mt-3 text-xs text-indigo-500 space-y-0.5">
            <li>· Datos recopilados y finalidades</li>
            <li>· Derechos ARCO del titular</li>
            <li>· Fundamento legal (LFPDPPP)</li>
            <li>· Contacto: privacidad@aodeporte.com</li>
          </ul>
        </Link>
      </div>
    </main>
  );
}

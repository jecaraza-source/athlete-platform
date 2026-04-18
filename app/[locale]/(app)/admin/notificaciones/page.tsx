import Link from 'next/link';
import { requirePermission } from '@/lib/rbac/server';
import BackButton from '@/components/back-button';

export default async function NotificacionesHubPage() {
  await requirePermission('view_notification_logs');

  return (
    <main className="p-8">
      <BackButton href="/admin" label="Volver a Admin" />
      <h1 className="text-3xl font-bold mt-4 text-rose-700">Notificaciones</h1>
      <p className="mt-2 text-gray-600 mb-8">
        Gestión centralizada de recordatorios, push y correos de seguimiento de tickets.
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
      </div>
    </main>
  );
}

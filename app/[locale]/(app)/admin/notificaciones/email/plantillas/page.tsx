import Link from 'next/link';
import { requirePermission } from '@/lib/rbac/server';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';
import EmailTemplateRow from './email-template-row';

export const dynamic = 'force-dynamic';

export default async function EmailTemplatesPage() {
  await requirePermission('manage_notification_templates');

  const { data: templates } = await supabaseAdmin
    .from('email_templates')
    .select('id, name, subject, status, version, updated_at')
    .order('name');

  return (
    <main className="p-8">
      <BackButton href="/admin/notificaciones/email" label="Volver a Campañas" />

      <div className="mt-4 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-rose-700">Plantillas de Email</h1>
          <p className="text-sm text-gray-500 mt-1">
            Crea y gestiona plantillas reutilizables para tus campañas.
          </p>
        </div>
        <Link
          href="/admin/notificaciones/email/plantillas/nueva"
          className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
        >
          + Nueva plantilla
        </Link>
      </div>

      {!templates || templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
          No hay plantillas. Crea la primera.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Asunto</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Versión</th>
                <th className="px-4 py-3 text-left">Actualizada</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((t) => (
                <EmailTemplateRow key={t.id} template={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

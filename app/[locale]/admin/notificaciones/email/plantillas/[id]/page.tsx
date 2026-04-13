import { notFound }           from 'next/navigation';
import { requirePermission }  from '@/lib/rbac/server';
import { supabaseAdmin }      from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';
import EditEmailTemplateForm from './edit-email-template-form';

export const dynamic = 'force-dynamic';

interface PageProps { params: Promise<{ id: string }> }

export default async function EditEmailTemplatePage({ params }: PageProps) {
  await requirePermission('manage_notification_templates');
  const { id } = await params;

  const { data: template } = await supabaseAdmin
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!template) notFound();

  return (
    <main className="p-8 max-w-3xl">
      <BackButton href="/admin/notificaciones/email/plantillas" label="Volver a Plantillas" />
      <h1 className="text-2xl font-bold text-rose-700 mt-4 mb-1">{template.name}</h1>
      <p className="text-xs text-gray-400 mb-6">v{template.version} · {template.status}</p>
      <EditEmailTemplateForm template={template} />
    </main>
  );
}

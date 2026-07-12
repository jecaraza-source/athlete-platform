import { notFound }          from 'next/navigation';
import { requirePermission } from '@/lib/rbac/server';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';
import EditTicketTemplateForm from './edit-ticket-template-form';

export const dynamic = 'force-dynamic';
interface PageProps { params: Promise<{ id: string }> }

export default async function EditTicketTemplatePage({ params }: PageProps) {
  await requirePermission('manage_ticket_emails');
  const { id } = await params;

  const { data: template } = await supabaseAdmin
    .from('ticket_email_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!template) notFound();

  return (
    <main className="p-8 max-w-3xl">
      <BackButton href="/admin/notificaciones/tickets" label="Volver a Tickets" />
      <h1 className="text-2xl font-bold text-amber-700 mt-4 mb-1">{template.name}</h1>
      <p className="text-xs text-gray-400 font-mono mb-6">{template.event_key}</p>
      <EditTicketTemplateForm template={template} />
    </main>
  );
}

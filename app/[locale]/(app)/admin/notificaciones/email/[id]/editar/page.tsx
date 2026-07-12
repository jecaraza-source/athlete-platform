import { notFound }          from 'next/navigation';
import { requirePermission } from '@/lib/rbac/server';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';
import EditEmailCampaignForm from './edit-email-campaign-form';

export const dynamic = 'force-dynamic';

interface PageProps { params: Promise<{ id: string }> }

export default async function EditEmailCampaignPage({ params }: PageProps) {
  await requirePermission('manage_email_campaigns');
  const { id } = await params;

  const [{ data: campaign }, { data: templates }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('email_campaigns').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('email_templates').select('id, name, subject').eq('status', 'active').order('name'),
    supabaseAdmin.from('profiles').select('id, first_name, last_name, email, role').order('first_name'),
  ]);

  if (!campaign) notFound();

  return (
    <main className="p-8 max-w-2xl">
      <BackButton href="/admin/notificaciones/email" label="Volver a Campañas" />
      <h1 className="text-2xl font-bold text-rose-700 mt-4 mb-6">Editar Campaña</h1>
      <EditEmailCampaignForm
        campaign={campaign}
        templates={templates ?? []}
        profiles={profiles ?? []}
      />
    </main>
  );
}

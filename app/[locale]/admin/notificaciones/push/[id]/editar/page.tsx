import { notFound }          from 'next/navigation';
import { requirePermission } from '@/lib/rbac/server';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';
import EditPushCampaignForm from './edit-push-campaign-form';

export const dynamic = 'force-dynamic';

interface PageProps { params: Promise<{ id: string }> }

export default async function EditPushCampaignPage({ params }: PageProps) {
  await requirePermission('manage_push_campaigns');
  const { id } = await params;

  const [{ data: campaign }, { data: templates }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('push_campaigns').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('push_templates').select('id, name, title').eq('status', 'active').order('name'),
    supabaseAdmin.from('profiles').select('id, first_name, last_name, email, role').order('first_name'),
  ]);

  if (!campaign) notFound();

  return (
    <main className="p-8 max-w-2xl">
      <BackButton href="/admin/notificaciones/push" label="Volver a Push" />
      <h1 className="text-2xl font-bold text-violet-700 mt-4 mb-6">Editar Campaña Push</h1>
      <EditPushCampaignForm
        campaign={campaign}
        templates={templates ?? []}
        profiles={profiles ?? []}
      />
    </main>
  );
}

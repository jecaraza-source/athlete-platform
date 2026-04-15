import { requirePermission } from '@/lib/rbac/server';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';
import NewPushCampaignForm from './new-push-campaign-form';

export const dynamic = 'force-dynamic';

export default async function NewPushCampaignPage() {
  await requirePermission('manage_push_campaigns');

  const [{ data: templates }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('push_templates').select('id, name, title').eq('status', 'active').order('name'),
    supabaseAdmin.from('profiles').select('id, first_name, last_name, email, role').order('first_name'),
  ]);

  return (
    <main className="p-8 max-w-2xl">
      <BackButton href="/admin/notificaciones/push" label="Volver a Push" />
      <h1 className="text-2xl font-bold text-violet-700 mt-4 mb-6">Nueva Campaña Push</h1>
      <NewPushCampaignForm templates={templates ?? []} profiles={profiles ?? []} />
    </main>
  );
}

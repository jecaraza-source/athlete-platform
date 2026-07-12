import { redirect }         from 'next/navigation';
import { requirePermission } from '@/lib/rbac/server';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';
import NewEmailCampaignForm from './new-email-campaign-form';

export const dynamic = 'force-dynamic';

export default async function NewEmailCampaignPage() {
  await requirePermission('manage_email_campaigns');

  const [{ data: templates }, { data: profiles }] = await Promise.all([
    supabaseAdmin
      .from('email_templates')
      .select('id, name, subject')
      .eq('status', 'active')
      .order('name'),
    supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, role')
      .order('first_name'),
  ]);

  return (
    <main className="p-8 max-w-2xl">
      <BackButton href="/admin/notificaciones/email" label="Volver a Campañas" />
      <h1 className="text-2xl font-bold text-rose-700 mt-4 mb-6">Nueva Campaña de Email</h1>
      <NewEmailCampaignForm
        templates={templates ?? []}
        profiles={profiles ?? []}
      />
    </main>
  );
}

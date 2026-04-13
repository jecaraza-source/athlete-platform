import { notFound }          from 'next/navigation';
import { requirePermission } from '@/lib/rbac/server';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';
import EditRuleForm from './edit-rule-form';

export const dynamic = 'force-dynamic';
interface PageProps { params: Promise<{ id: string }> }

export default async function EditRulePage({ params }: PageProps) {
  await requirePermission('manage_ticket_emails');
  const { id } = await params;

  const { data: rule } = await supabaseAdmin
    .from('ticket_automation_rules')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!rule) notFound();

  return (
    <main className="p-8 max-w-2xl">
      <BackButton href="/admin/notificaciones/tickets/reglas" label="Volver a Reglas" />
      <h1 className="text-2xl font-bold text-amber-700 mt-4 mb-6">Editar Regla</h1>
      <EditRuleForm rule={rule} />
    </main>
  );
}

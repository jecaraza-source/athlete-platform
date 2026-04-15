import { notFound }          from 'next/navigation';
import Link                  from 'next/link';
import { requirePermission } from '@/lib/rbac/server';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import BackButton            from '@/components/back-button';

export const dynamic = 'force-dynamic';

interface PageProps { params: Promise<{ id: string }> }

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  sending:   'bg-yellow-100 text-yellow-700',
  sent:      'bg-green-100 text-green-700',
  paused:    'bg-orange-100 text-orange-700',
  failed:    'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', scheduled: 'Programado', sending: 'Enviando',
  sent: 'Enviado', paused: 'Pausado', failed: 'Fallido', cancelled: 'Cancelado',
};

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

export default async function PushCampaignDetailPage({ params }: PageProps) {
  await requirePermission('manage_push_campaigns');
  const { id } = await params;

  const [{ data: campaign }, { data: jobs }] = await Promise.all([
    supabaseAdmin
      .from('push_campaigns')
      .select('*, created_by_profile:profiles!push_campaigns_created_by_fkey(first_name, last_name)')
      .eq('id', id)
      .maybeSingle(),
    supabaseAdmin
      .from('push_jobs')
      .select('status')
      .eq('campaign_id', id),
  ]);

  if (!campaign) notFound();

  // Fetch associated template (sequential — needs campaign.template_id)
  const { data: tmpl } = campaign.template_id
    ? await supabaseAdmin.from('push_templates').select('id, name, title').eq('id', campaign.template_id).maybeSingle()
    : { data: null };

  // Aggregate job stats
  const stats = (jobs ?? []).reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  const total       = jobs?.length ?? 0;
  const canEdit     = ['draft', 'paused', 'scheduled'].includes(campaign.status);

  return (
    <main className="p-8 max-w-3xl">
      <BackButton href="/admin/notificaciones/push" label="Volver a Push" />

      {/* Header */}
      <div className="mt-4 mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-violet-700">{campaign.name}</h1>
          {campaign.description && (
            <p className="text-sm text-gray-500 mt-1">{campaign.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[campaign.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABELS[campaign.status] ?? campaign.status}
          </span>
          {canEdit && (
            <Link
              href={`/admin/notificaciones/push/${id}/editar`}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              Editar
            </Link>
          )}
        </div>
      </div>

      {/* Campaign metadata */}
      <div className="rounded-lg border border-gray-200 p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Plantilla</p>
          <p className="text-gray-800">{tmpl?.name ?? '—'}</p>
          {tmpl?.title && <p className="text-xs text-gray-500 mt-0.5">{tmpl.title}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Audiencia</p>
          <p className="text-gray-800 capitalize">
            {campaign.audience_type === 'athlete' ? 'Atletas'
              : campaign.audience_type === 'staff' ? 'Staff' : 'Mixto'}{' · '}
            {campaign.selection_mode === 'individual' ? 'Individual' : 'Colectivo'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Programado</p>
          <p className="text-gray-800">
            {campaign.scheduled_at
              ? new Date(campaign.scheduled_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Enviado</p>
          <p className="text-gray-800">
            {campaign.sent_at
              ? new Date(campaign.sent_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Zona horaria</p>
          <p className="text-gray-800">{campaign.timezone ?? 'UTC'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Recurrencia</p>
          <p className="text-gray-800 capitalize">{campaign.recurrence ?? 'none'}</p>
        </div>
      </div>

      {/* Delivery stats */}
      <h2 className="text-base font-semibold text-gray-700 mb-3">
        Estadísticas de entrega <span className="text-gray-400 font-normal text-sm">({total} jobs)</span>
      </h2>
      {total === 0 ? (
        <p className="text-sm text-gray-400 mb-6">
          {campaign.status === 'draft' || campaign.status === 'scheduled'
            ? 'La campaña aún no ha sido enviada.'
            : 'No hay jobs registrados para esta campaña.'}
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
          <Stat label="Enviados"       value={stats.sent        ?? 0} color="text-green-600" />
          <Stat label="Entregados"     value={stats.delivered   ?? 0} color="text-emerald-600" />
          <Stat label="Pendientes"     value={stats.pending     ?? 0} color="text-gray-600" />
          <Stat label="Fallidos"       value={stats.failed      ?? 0} color="text-red-600" />
          <Stat label="Token inválido" value={stats.invalid_token ?? 0} color="text-orange-600" />
        </div>
      )}

      {/* Created by */}
      <p className="text-xs text-gray-400">
        Creado el{' '}
        {new Date(campaign.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
        {campaign.created_by_profile && (
          <> por {(campaign.created_by_profile as { first_name: string; last_name: string }).first_name}{' '}
          {(campaign.created_by_profile as { first_name: string; last_name: string }).last_name}</>
        )}
      </p>
    </main>
  );
}

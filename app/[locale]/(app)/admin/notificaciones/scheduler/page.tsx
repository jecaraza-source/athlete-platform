import { requireAdminAccess } from '@/lib/rbac/server';
import { supabaseAdmin }      from '@/lib/supabase-admin';
import { getSchedulerStatus } from '@/lib/notifications/scheduler';
import BackButton from '@/components/back-button';
import SchedulerTriggerPanel from './scheduler-trigger-panel';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

async function getUpcomingCampaigns() {
  const [{ data: email }, { data: push }] = await Promise.all([
    supabaseAdmin
      .from('email_campaigns')
      .select('id, name, status, scheduled_at, recurrence, audience_type, selection_mode')
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true })
      .limit(10),

    supabaseAdmin
      .from('push_campaigns')
      .select('id, name, status, scheduled_at, recurrence, audience_type, selection_mode')
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true })
      .limit(10),
  ]);

  return { email: email ?? [], push: push ?? [] };
}

async function getJobBacklog() {
  const [emailPending, pushPending, emailRetrying, pushRetrying] = await Promise.all([
    supabaseAdmin
      .from('email_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),

    supabaseAdmin
      .from('push_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),

    supabaseAdmin
      .from('email_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'retrying'),

    supabaseAdmin
      .from('push_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'retrying'),
  ]);

  return {
    email_pending:  emailPending.count  ?? 0,
    push_pending:   pushPending.count   ?? 0,
    email_retrying: emailRetrying.count ?? 0,
    push_retrying:  pushRetrying.count  ?? 0,
  };
}

async function getRecentActivity() {
  const since = new Date(Date.now() - 60 * 60_000).toISOString(); // last hour

  const [{ data: sentEmails }, { data: sentPush }, { data: failedEmails }, { data: failedPush }] = await Promise.all([
    supabaseAdmin
      .from('email_jobs')
      .select('id, campaign_id, recipient_email, subject, processed_at')
      .eq('status', 'sent')
      .gte('processed_at', since)
      .order('processed_at', { ascending: false })
      .limit(5),

    supabaseAdmin
      .from('push_jobs')
      .select('id, campaign_id, onesignal_player_id, title, processed_at')
      .eq('status', 'sent')
      .gte('processed_at', since)
      .order('processed_at', { ascending: false })
      .limit(5),

    supabaseAdmin
      .from('email_jobs')
      .select('id, recipient_email, subject, last_error, attempt_count, max_attempts')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5),

    supabaseAdmin
      .from('push_jobs')
      .select('id, title, last_error, attempt_count, max_attempts')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return {
    sent_emails:   sentEmails   ?? [],
    sent_push:     sentPush     ?? [],
    failed_emails: failedEmails ?? [],
    failed_push:   failedPush   ?? [],
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SchedulerPage() {
  await requireAdminAccess();

  const [status, upcoming, backlog, activity] = await Promise.all([
    getSchedulerStatus(),
    getUpcomingCampaigns(),
    getJobBacklog(),
    getRecentActivity(),
  ]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <main className="p-8">
      <BackButton href="/admin/notificaciones" label="Volver a Notificaciones" />

      <div className="mt-4 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Scheduler</h1>
          <p className="text-sm text-gray-500 mt-1">
            Estado de la cola de envíos y trabajos programados.
          </p>
        </div>
        {isDev && (
          <span className="rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium px-3 py-1">
            Modo desarrollo
          </span>
        )}
      </div>

      {/* ── Health KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Campañas email programadas" value={status.email_campaigns_scheduled} color="rose" />
        <KpiCard label="Campañas push programadas"  value={status.push_campaigns_scheduled}  color="violet" />
        <KpiCard label="Jobs email fallidos"         value={status.email_jobs_failed}         color={status.email_jobs_failed > 0 ? 'red' : 'green'} />
        <KpiCard label="Jobs push fallidos"          value={status.push_jobs_failed}          color={status.push_jobs_failed > 0 ? 'red' : 'green'} />
      </div>

      {/* ── Job backlog ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Email pendientes" value={backlog.email_pending}  color="gray" />
        <KpiCard label="Email reintento"  value={backlog.email_retrying} color={backlog.email_retrying > 0 ? 'yellow' : 'gray'} />
        <KpiCard label="Push pendientes"  value={backlog.push_pending}   color="gray" />
        <KpiCard label="Push reintento"   value={backlog.push_retrying}  color={backlog.push_retrying > 0 ? 'yellow' : 'gray'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Upcoming campaigns ──────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Cron schedule reference */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Horarios Vercel Cron
            </h2>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Job</th>
                    <th className="px-4 py-2 text-left">Frecuencia</th>
                    <th className="px-4 py-2 text-left">Endpoint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {[
                    { job: 'Email',  freq: 'Cada minuto',    path: '/api/cron/process-email-jobs' },
                    { job: 'Push',   freq: 'Cada minuto',    path: '/api/cron/process-push-jobs' },
                    { job: 'Ticket', freq: 'Cada 5 minutos', path: '/api/cron/process-ticket-automation' },
                  ].map((row) => (
                    <tr key={row.job}>
                      <td className="px-4 py-2 font-medium text-gray-700">{row.job}</td>
                      <td className="px-4 py-2 text-gray-500">{row.freq}</td>
                      <td className="px-4 py-2 font-mono text-gray-400">{row.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Upcoming email campaigns */}
          {upcoming.email.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Próximas campañas de email ({upcoming.email.length})
              </h2>
              <UpcomingTable campaigns={upcoming.email} color="rose" />
            </section>
          )}

          {/* Upcoming push campaigns */}
          {upcoming.push.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Próximas campañas push ({upcoming.push.length})
              </h2>
              <UpcomingTable campaigns={upcoming.push} color="violet" />
            </section>
          )}

          {upcoming.email.length === 0 && upcoming.push.length === 0 && (
            <p className="text-sm text-gray-400 italic">No hay campañas programadas.</p>
          )}

          {/* Failed jobs */}
          {(activity.failed_emails.length > 0 || activity.failed_push.length > 0) && (
            <section>
              <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">
                Jobs fallidos recientes
              </h2>
              <div className="rounded-lg border border-red-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-red-50 text-red-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Canal</th>
                      <th className="px-4 py-2 text-left">Destinatario / Título</th>
                      <th className="px-4 py-2 text-left">Error</th>
                      <th className="px-4 py-2 text-left">Intentos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50">
                    {activity.failed_emails.map((j) => (
                      <tr key={j.id}>
                        <td className="px-4 py-2 text-rose-600 font-medium">Email</td>
                        <td className="px-4 py-2 text-gray-700 max-w-[180px] truncate">{j.recipient_email}</td>
                        <td className="px-4 py-2 text-red-500 max-w-[200px] truncate">{j.last_error ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-500">{j.attempt_count}/{j.max_attempts}</td>
                      </tr>
                    ))}
                    {activity.failed_push.map((j) => (
                      <tr key={j.id}>
                        <td className="px-4 py-2 text-violet-600 font-medium">Push</td>
                        <td className="px-4 py-2 text-gray-700 max-w-[180px] truncate">{j.title}</td>
                        <td className="px-4 py-2 text-red-500 max-w-[200px] truncate">{j.last_error ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-500">{j.attempt_count}/{j.max_attempts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* ── Right panel: trigger + recent sends ──────────────────── */}
        <div className="space-y-6">
          <SchedulerTriggerPanel />

          {/* Recent sends (last hour) */}
          {(activity.sent_emails.length > 0 || activity.sent_push.length > 0) && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Enviados última hora
              </h2>
              <ul className="space-y-2">
                {activity.sent_emails.map((j) => (
                  <li key={j.id} className="text-xs border-l-2 border-rose-200 pl-3">
                    <p className="font-medium text-gray-700 truncate">{j.subject}</p>
                    <p className="text-gray-400">{j.recipient_email}</p>
                    {j.processed_at && (
                      <p className="text-gray-400">
                        {new Date(j.processed_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </li>
                ))}
                {activity.sent_push.map((j) => (
                  <li key={j.id} className="text-xs border-l-2 border-violet-200 pl-3">
                    <p className="font-medium text-gray-700 truncate">{j.title}</p>
                    <p className="text-gray-400 font-mono text-[10px] truncate">{j.onesignal_player_id}</p>
                    {j.processed_at && (
                      <p className="text-gray-400">
                        {new Date(j.processed_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    rose:   'text-rose-700',
    violet: 'text-violet-700',
    red:    'text-red-600',
    green:  'text-green-700',
    yellow: 'text-yellow-600',
    gray:   'text-gray-800',
  };
  return (
    <div className="rounded-lg border border-gray-200 p-4 text-center">
      <p className={`text-3xl font-bold ${colorMap[color] ?? 'text-gray-800'}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

const RECURRENCE_LABELS: Record<string, string> = {
  none: '—', daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual', custom: 'Custom',
};

function UpcomingTable({
  campaigns,
  color,
}: {
  campaigns: Array<{
    id: string; name: string; scheduled_at: string | null;
    recurrence: string; audience_type: string; selection_mode: string;
  }>;
  color: 'rose' | 'violet';
}) {
  const accent = color === 'rose' ? 'text-rose-600' : 'text-violet-600';

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left">Nombre</th>
            <th className="px-4 py-2 text-left">Próximo envío</th>
            <th className="px-4 py-2 text-left">Recurrencia</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {campaigns.map((c) => {
            const nextRun  = c.scheduled_at ? new Date(c.scheduled_at) : null;
            const minsLeft = nextRun
              ? Math.round((nextRun.getTime() - Date.now()) / 60_000)
              : null;

            return (
              <tr key={c.id}>
                <td className={`px-4 py-2 font-medium ${accent} max-w-[160px] truncate`}>{c.name}</td>
                <td className="px-4 py-2 text-gray-600">
                  {nextRun ? (
                    <span title={nextRun.toLocaleString('es-MX')}>
                      {minsLeft !== null && minsLeft <= 60
                        ? `en ${minsLeft} min`
                        : nextRun.toLocaleDateString('es-MX', {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-2 text-gray-400">
                  {RECURRENCE_LABELS[c.recurrence] ?? c.recurrence}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

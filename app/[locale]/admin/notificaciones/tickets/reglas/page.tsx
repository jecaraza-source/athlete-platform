import Link from 'next/link';
import { requirePermission } from '@/lib/rbac/server';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';
import RuleCard   from './rule-card';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TRIGGER_LABELS: Record<string, string> = {
  ticket_created:          'Al crear ticket',
  ticket_assigned:         'Al asignar ticket',
  ticket_status_changed:   'Al cambiar estado',
  ticket_overdue:          'Ticket vencido',
  ticket_pending_response: 'Sin respuesta',
  ticket_resolved:         'Ticket resuelto',
  ticket_closed:           'Ticket cerrado',
};

/**
 * Count tickets currently matching each time-based rule so admins can
 * see impact before enabling/disabling.
 */
async function getMatchingTicketCount(rule: {
  trigger_event: string;
  delay_minutes:  number;
  filter_statuses:   string[] | null;
  filter_priorities: string[] | null;
}): Promise<number> {
  const statusFilter   = rule.filter_statuses   ?? ['open', 'in_progress'];
  const priorityFilter = rule.filter_priorities;
  const now            = new Date();

  // Only time-based rules have a "currently matching" concept
  if (rule.trigger_event === 'ticket_overdue') {
    let q = supabaseAdmin
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', statusFilter)
      .not('due_date', 'is', null)
      .lte('due_date', now.toISOString());
    if (priorityFilter) q = q.in('priority', priorityFilter);
    const { count } = await q;
    return count ?? 0;
  }

  if (rule.trigger_event === 'ticket_pending_response') {
    const cutoff = new Date(now.getTime() - rule.delay_minutes * 60_000).toISOString();
    let q = supabaseAdmin
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', statusFilter)
      .lte('updated_at', cutoff);
    if (priorityFilter) q = q.in('priority', priorityFilter);
    const { count } = await q;
    return count ?? 0;
  }

  // Event-based rules don't have a static count
  return -1;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AutomationRulesDashboardPage() {
  await requirePermission('manage_ticket_emails');

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [{ data: rules }, { count: emailsToday }, { data: recentActivity }] = await Promise.all([
    supabaseAdmin
      .from('ticket_automation_rules')
      .select('*')
      .order('created_at', { ascending: true }),

    supabaseAdmin
      .from('ticket_email_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('trigger_type', 'automatic')
      .gte('created_at', today.toISOString()),

    supabaseAdmin
      .from('ticket_email_jobs')
      .select(`
        id, event_key, email_type, trigger_type, recipient_email,
        subject, status, created_at, processed_at,
        ticket:tickets(id, title),
        triggered_by_profile:profiles!ticket_email_jobs_triggered_by_fkey(first_name, last_name)
      `)
      .eq('trigger_type', 'automatic')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const activeRules   = (rules ?? []).filter((r) => r.is_active).length;
  const inactiveRules = (rules ?? []).filter((r) => !r.is_active).length;

  // Compute matching ticket counts for each time-based rule
  const matchCounts = await Promise.all(
    (rules ?? []).map((r) => getMatchingTicketCount(r))
  );

  return (
    <main className="p-8">
      <BackButton href="/admin/notificaciones/tickets" label="Volver a Correos de Tickets" />

      <div className="mt-4 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-amber-700">Reglas de Automatización</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configura cuándo y cómo se envían emails automáticos según el ciclo de vida de los tickets.
          </p>
        </div>
        <Link
          href="/admin/notificaciones/tickets/reglas/nueva"
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 shrink-0"
        >
          + Nueva regla
        </Link>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Reglas activas',    value: activeRules,         color: 'text-green-700'  },
          { label: 'Reglas inactivas',  value: inactiveRules,       color: 'text-gray-500'   },
          { label: 'Emails hoy (auto)', value: emailsToday ?? 0,    color: 'text-amber-700'  },
          { label: 'Total reglas',      value: (rules ?? []).length, color: 'text-gray-800'  },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-gray-200 p-4 text-center">
            <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Rules list ───────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Reglas ({(rules ?? []).length})
          </h2>

          {!rules || rules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
              No hay reglas configuradas.{' '}
              <Link href="/admin/notificaciones/tickets/reglas/nueva" className="text-amber-600 hover:underline">
                Crear la primera
              </Link>
            </div>
          ) : (
            rules.map((rule, i) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                triggerLabel={TRIGGER_LABELS[rule.trigger_event] ?? rule.trigger_event}
                matchingCount={matchCounts[i]}
              />
            ))
          )}
        </div>

        {/* ── Recent automation activity ───────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
            Actividad reciente
          </h2>

          {!recentActivity || recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              Aún no hay emails automáticos enviados.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentActivity.map((job) => {
                const ticket = Array.isArray(job.ticket) ? job.ticket[0] : job.ticket;
                return (
                  <li key={job.id} className="rounded-lg border border-gray-100 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-800 truncate max-w-[160px]">
                        {(ticket as { title: string } | null)?.title ?? '—'}
                      </span>
                      <StatusDot status={job.status} />
                    </div>
                    <p className="text-gray-500 font-mono">{job.event_key}</p>
                    <p className="text-gray-400">Para: {job.recipient_email}</p>
                    <p className="text-gray-400">
                      {new Date(job.created_at).toLocaleString('es-MX', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    sent:       'bg-green-500',
    failed:     'bg-red-500',
    pending:    'bg-yellow-400',
    processing: 'bg-blue-400',
    retrying:   'bg-orange-400',
  };
  return (
    <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${colors[status] ?? 'bg-gray-300'}`}
      title={status} />
  );
}

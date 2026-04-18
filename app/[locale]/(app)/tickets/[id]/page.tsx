import { notFound, redirect }                    from 'next/navigation';
import BackButton                                 from '@/components/back-button';
import { getTranslations }                        from 'next-intl/server';
import { requireAuthenticated }                   from '@/lib/rbac/server';
import { supabaseAdmin }                          from '@/lib/supabase-admin';
import type { TicketStatus, TicketPriority }      from '@/lib/tickets/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Labels & colours
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<TicketStatus, string> = {
  open:        'Abierto',
  in_progress: 'En progreso',
  resolved:    'Resuelto',
  closed:      'Cerrado',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low:    'Baja',
  medium: 'Media',
  high:   'Alta',
  urgent: 'Urgente',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  open:        'bg-blue-100  text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved:    'bg-green-100 text-green-700',
  closed:      'bg-gray-100  text-gray-600',
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low:    'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100   text-red-700',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MyTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [user, { id }, t] = await Promise.all([
    requireAuthenticated(),
    params,
    getTranslations('athleteTickets'),
  ]);

  // Fetch ticket + assignee profile
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select(`
      id, title, description, status, priority,
      created_at, updated_at, created_by,
      assigned_to_profile:profiles!assigned_to(first_name, last_name)
    `)
    .eq('id', id)
    .maybeSingle();

  if (!ticket) notFound();

  // Security: only the ticket creator can access this page.
  // Staff/admins should use /admin/tickets/[id] instead.
  if (ticket.created_by !== user.profile?.id) {
    redirect('/tickets');
  }

  const status   = ticket.status   as TicketStatus;
  const priority = ticket.priority as TicketPriority;

  // Supabase infers joined profiles as an array; cast via unknown.
  const rawAssignee = ticket.assigned_to_profile as unknown;
  const assignee = (Array.isArray(rawAssignee) ? rawAssignee[0] : rawAssignee) as
    { first_name: string; last_name: string } | null | undefined;

  return (
    <main className="p-8 max-w-3xl">
      <BackButton href="/tickets" label={t('backToTickets')} />

      {/* Header */}
      <div className="mt-6 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              PRIORITY_COLORS[priority] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {PRIORITY_LABELS[priority] ?? priority}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {STATUS_LABELS[status] ?? status}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
        <p className="text-xs text-gray-400 mt-1">
          Enviado el{' '}
          {new Date(ticket.created_at).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'long', year: 'numeric',
          })}
        </p>
      </div>

      {/* Body */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">

        {/* Description */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t('descriptionSection')}
          </h2>
          {ticket.description ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">{t('noDescription')}</p>
          )}
        </div>

        {/* Assignee */}
        {assignee && (
          <div className="border-t border-gray-100 pt-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {t('assignedTo')}
            </h2>
            <p className="text-sm text-gray-700">
              {assignee.first_name} {assignee.last_name}
            </p>
          </div>
        )}

        {/* Status info banner */}
        {(status === 'resolved' || status === 'closed') && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            ✓ {t('statusBannerDone', { status: status === 'resolved' ? t('resolved') : t('closed') })}
          </div>
        )}

        {status === 'open' && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {t('statusBannerOpen')}
          </div>
        )}

        {status === 'in_progress' && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
            {t('statusBannerInProgress')}
          </div>
        )}
      </div>
    </main>
  );
}

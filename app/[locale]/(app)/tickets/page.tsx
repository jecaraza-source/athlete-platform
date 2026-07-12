import Link           from 'next/link';
import BackButton     from '@/components/back-button';
import { getTranslations } from 'next-intl/server';
import { requireAuthenticated } from '@/lib/rbac/server';
import { supabaseAdmin }         from '@/lib/supabase-admin';
import type { TicketStatus, TicketPriority } from '@/lib/tickets/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// UI helpers
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

export default async function MyTicketsPage() {
  const user = await requireAuthenticated();
  const t    = await getTranslations('athleteTickets');
  const tc   = await getTranslations('common');

  // Fetch only tickets created by this user
  const { data: tickets, error } = await supabaseAdmin
    .from('tickets')
    .select('id, title, status, priority, created_at, updated_at')
    .eq('created_by', user.profile?.id ?? '')
    .order('created_at', { ascending: false });

  return (
    <main className="p-8 max-w-4xl">
      <BackButton href="/dashboard" label={tc('backToDashboard')} />

      <div className="flex items-start justify-between mt-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-teal-700">{t('title')}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('description')}</p>
        </div>
        <Link
          href="/tickets/new"
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
        >
          {t('newTicket')}
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t('errorLoading')} {error.message}
        </div>
      )}

      {!error && (!tickets || tickets.length === 0) ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm font-medium text-gray-500">{t('empty')}</p>
          <p className="text-xs text-gray-400 mt-1">{t('emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(tickets ?? []).map((ticket) => {
            const status   = ticket.status   as TicketStatus;
            const priority = ticket.priority as TicketPriority;
            return (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-teal-300 hover:shadow-md transition-all"
              >
                {/* Title + date */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {ticket.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(ticket.created_at).toLocaleDateString('es-MX', {
                      day:   '2-digit',
                      month: 'short',
                      year:  'numeric',
                    })}
                  </p>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 shrink-0">
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
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

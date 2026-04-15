import { notFound } from 'next/navigation';
import BackButton from '@/components/back-button';
import { requirePermission, getCurrentUser } from '@/lib/rbac/server';
import { getTranslations } from 'next-intl/server';
import {
  getTicket,
  getTicketComments,
  getTicketActivity,
  getTicketAssignees,
  getTicketAthletes,
  getStaffProfiles,
  getAllAthletes,
} from '@/lib/tickets/queries';
import {
  canAssignTicket,
  canCloseTicket,
  canCommentTicket,
  canEditTicket,
  isSuperAdminOrAdmin,
} from '@/lib/tickets/permissions';
import { StatusBadge, PriorityBadge } from '../ticket-badges';
import AddCommentForm from './add-comment-form';
import AssignTicketForm from './assign-ticket-form';
import AthleteLinksForm from './athlete-links-form';
import ChangeStatusForm from './change-status-form';
import DeleteTicketButton from './delete-ticket-button';
import type { ActivityLogEntry } from '@/lib/tickets/types';
import { getTicketEmailHistory } from '@/lib/notifications/analytics';
import TicketEmailPanel from './ticket-email-panel';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: PageProps) {
  await requirePermission('view_tickets');
  const t = await getTranslations('admin.tickets');

  const { id } = await params;

  const [ticket, comments, activity, assignees, linkedAthletes, staffProfiles, athletes, currentUser, emailHistory] = await Promise.all([
    getTicket(id),
    getTicketComments(id),
    getTicketActivity(id),
    getTicketAssignees(id),
    getTicketAthletes(id),
    getStaffProfiles(),
    getAllAthletes(),
    getCurrentUser(),
    getTicketEmailHistory(id),
  ]);

  if (!ticket) notFound();

  const assigneeIds  = assignees.map((a) => a.profile_id);
  const athleteIds   = linkedAthletes.map((a) => a.athlete_id);

  // Derive per-action permissions for this user + ticket combination
  const userCanEdit    = currentUser ? canEditTicket(currentUser, ticket)  : false;
  const userCanClose   = currentUser ? canCloseTicket(currentUser)          : false;
  const userCanAssign  = currentUser ? canAssignTicket(currentUser)         : false;
  const userCanComment = currentUser ? canCommentTicket(currentUser)        : false;

  const showActions  = userCanEdit || userCanClose || userCanAssign;
  const userCanDelete = currentUser ? isSuperAdminOrAdmin(currentUser) : false;

  return (
    <main className="p-8">
      <BackButton href="/admin/tickets" label={t('backToTickets')} />

      {/* ── Header ─────────────────────────────────────────────────────────────────── */}
      <div className="mt-4 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-rose-700 mb-3">{ticket.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>
        {userCanDelete && <DeleteTicketButton ticketId={ticket.id} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Main column ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Description */}
          <section className="rounded-lg border border-gray-200 p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {t('descriptionLabel')}
            </h2>
            {ticket.description ? (
              <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                {ticket.description}
              </p>
            ) : (
              <p className="text-gray-400 italic text-sm">{t('noDescriptionProvided')}</p>
            )}
          </section>

          {/* Comments */}
          <section>
            <h2 className="text-lg font-semibold mb-4">
              {t('commentsLabel')}{' '}
              {comments.length > 0 && (
                <span className="text-sm font-normal text-gray-400">
                  ({comments.length})
                </span>
              )}
            </h2>
            <AddCommentForm
              ticketId={ticket.id}
              initialComments={comments}
              currentUserProfile={
                userCanComment && currentUser?.profile
                  ? {
                      id:         currentUser.profile.id,
                      first_name: currentUser.profile.first_name,
                      last_name:  currentUser.profile.last_name,
                      email:      currentUser.profile.email ?? null,
                    }
                  : null
              }
            />
          </section>

          {/* ── Email communication panel ───────────────────────────── */}
          <TicketEmailPanel
            ticketId={ticket.id}
            initialHistory={(emailHistory ?? []).map((j: Record<string, unknown>) => ({
              ...j,
              triggered_by_profile: Array.isArray(j.triggered_by_profile)
                ? (j.triggered_by_profile as { first_name: string; last_name: string }[])[0] ?? null
                : (j.triggered_by_profile as { first_name: string; last_name: string } | null),
              recipient_profile: Array.isArray(j.recipient_profile)
                ? (j.recipient_profile as { first_name: string; last_name: string }[])[0] ?? null
                : (j.recipient_profile as { first_name: string; last_name: string } | null),
              deliveries: Array.isArray(j.deliveries) ? j.deliveries : [],
            })) as Parameters<typeof TicketEmailPanel>[0]['initialHistory']}
            recipients={[
              // Creator
              ...(ticket.created_by_profile?.email ? [{
                profileId: ticket.created_by,
                email:     ticket.created_by_profile.email,
                label:     `${ticket.created_by_profile.first_name} ${ticket.created_by_profile.last_name}`,
                role:      'creator' as const,
              }] : []),
              // All assignees with email
              ...assignees
                .filter((a) => a.profile?.email)
                .map((a) => ({
                  profileId: a.profile_id,
                  email:     a.profile!.email!,
                  label:     `${a.profile!.first_name} ${a.profile!.last_name}`,
                  role:      'assignee' as const,
                }))
                .filter((r, i, arr) => arr.findIndex((x) => x.email === r.email) === i), // deduplicate
            ]}
          />
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Metadata card */}
          <div className="rounded-lg border border-gray-200 p-5 space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                {t('createdByLabel')}
              </p>
              <p className="text-gray-800">
                {ticket.created_by_profile
                  ? `${ticket.created_by_profile.first_name} ${ticket.created_by_profile.last_name}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                {t('assignedStaffLabel')}
              </p>
              {assignees.length === 0 ? (
                <span className="text-gray-400 italic text-sm">{t('unassignedLabel')}</span>
              ) : (
                <ul className="space-y-1">
                  {assignees.map((a) => (
                    <li key={a.profile_id} className="text-gray-800">
                      {a.profile
                        ? `${a.profile.first_name} ${a.profile.last_name}`
                        : '—'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {linkedAthletes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  {t('linkedAthletesLabel')}
                </p>
                <ul className="space-y-1">
                  {linkedAthletes.map((la) => (
                    <li key={la.athlete_id} className="text-gray-800">
                      {la.athlete
                        ? `${la.athlete.first_name} ${la.athlete.last_name}`
                        : '—'}
                      {la.athlete?.athlete_code && (
                        <span className="ml-1.5 text-xs text-gray-400 font-mono">
                          {la.athlete.athlete_code}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ticket.due_date && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  {t('dueDateLabel')}
                </p>
                <p className={`font-medium ${
                  new Date(ticket.due_date) < new Date() && ticket.status !== 'closed' && ticket.status !== 'resolved'
                    ? 'text-red-600'
                    : 'text-gray-600'
                }`}>
                  {new Date(ticket.due_date).toLocaleDateString('es-MX', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                  {new Date(ticket.due_date) < new Date() && ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                    <span className="ml-1 text-xs">({t('overdueLabel')})</span>
                  )}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                {t('openedOnLabel')}
              </p>
              <p className="text-gray-600">
                {new Date(ticket.created_at).toLocaleDateString('es-MX', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                {t('lastUpdatedLabel')}
              </p>
              <p className="text-gray-600">
                {new Date(ticket.updated_at).toLocaleDateString('es-MX', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <>
              {(userCanEdit || userCanClose) && (
                <div className="rounded-lg border border-gray-200 p-5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {t('changeStatusLabel')}
                  </h3>
                  <ChangeStatusForm
                    ticketId={ticket.id}
                    currentStatus={ticket.status}
                    canClose={userCanClose}
                  />
                </div>
              )}

              {userCanAssign && (
                <div className="rounded-lg border border-gray-200 p-5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {t('assignStaffLabel')}
                  </h3>
                  <AssignTicketForm
                    ticketId={ticket.id}
                    currentAssigneeIds={assigneeIds}
                    profiles={staffProfiles}
                  />
                </div>
              )}

              {(userCanEdit || userCanAssign) && (
                <div className="rounded-lg border border-gray-200 p-5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {t('athleteFollowUpLabel')}
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    {t('athleteFollowUpDesc')}
                  </p>
                  <AthleteLinksForm
                    ticketId={ticket.id}
                    currentAthleteIds={athleteIds}
                    athletes={athletes}
                  />
                </div>
              )}
            </>
          )}

          {/* Activity log */}
          {activity.length > 0 && (
            <div className="rounded-lg border border-gray-200 p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {t('activityLabel')}
              </h3>
              <ul className="space-y-2.5">
                {activity.map((entry) => (
                  <li key={entry.id} className="text-xs text-gray-600">
                    <span className="font-medium text-gray-800">
                      {entry.performer
                        ? `${entry.performer.first_name} ${entry.performer.last_name}`
                        : 'Unknown'}
                    </span>{' '}
                    {formatAction(entry)}{' '}
                    <span className="text-gray-400">
                      ·{' '}
                      {new Date(entry.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day:   'numeric',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Activity label helper
// ---------------------------------------------------------------------------

function formatAction(entry: ActivityLogEntry): string {
  const meta = entry.metadata ?? {};
  switch (entry.action) {
    case 'created':
      return `opened this ticket`;
    case 'status_changed':
      return `changed status from "${meta.from}" to "${meta.to}"`;
    case 'assigned':
      return meta.assigned_to ? 'assigned this ticket' : 'unassigned this ticket';
    case 'comment_added':
      return 'añadió un comentario';
    case 'email_sent': {
      const emailMeta = meta as { email_type?: string; recipient_email?: string; trigger_type?: string };
      const label = emailMeta.email_type === 'reminder' ? 'recordatorio' :
                    emailMeta.email_type === 'follow_up' ? 'seguimiento' :
                    emailMeta.email_type === 'overdue'   ? 'alerta de vencimiento' :
                    'email';
      return `envió ${label} a ${emailMeta.recipient_email ?? ''}`.trim();
    }
    default:
      return entry.action.replace(/_/g, ' ');
  }
}

// =============================================================================
// components/newsletter/NewsletterHomeCard.tsx
// Server Component — shows the latest published newsletter on the dashboard home.
//
// "Published" = status 'approved' or 'sent'. Drafts auto-approve without human
// review, so 'approved' is already the live/current newsletter regardless of
// whether the email dispatch (status -> 'sent') has run yet.
//
// For staff/coaches: shows the latest newsletter for 'coach' audience.
// For athletes:      shows the latest newsletter for 'atleta' audience.
// For admins (super_admin, program_director, event_coordinator):
//   also shows a pending approval banner inside the card.
// Returns null if no newsletter has been published yet.
// =============================================================================

import { getCurrentUser }  from '@/lib/rbac/server';
import { supabaseAdmin }   from '@/lib/supabase-admin';
import NewsletterReadModal from './NewsletterReadModal';
import Link                from 'next/link';
import type { Tip }        from '@/lib/newsletter/types';

const ADMIN_ROLES = new Set([
  'super_admin', 'program_director', 'event_coordinator',
]);

export default async function NewsletterHomeCard() {
  const user = await getCurrentUser();
  if (!user?.profile) return null;

  const isAthlete = user.roles.some((r) => r.code === 'athlete');
  const isAdmin   = user.roles.some((r) => ADMIN_ROLES.has(r.code));
  const audiencia = isAthlete ? 'atleta' : 'coach';

  // Fetch latest published newsletter for this audience (or 'all').
  // "Published" = approved or sent — auto-approval means 'approved' is
  // already live, independent of whether the email dispatch has run.
  const { data: candidates } = await supabaseAdmin
    .from('newsletter_drafts')
    .select('id, audiencia, asunto, preview_text, intro, tips_json, html_content, sent_at, approved_at')
    .in('status', ['approved', 'sent'])
    .in('audiencia', [audiencia, 'all'])
    .order('approved_at', { ascending: false })
    .limit(1);

  const latest = candidates?.[0];
  if (!latest) return null;

  const publishedAt = latest.sent_at ?? latest.approved_at;

  // Count pending drafts (admins only)
  let pendingCount = 0;
  if (isAdmin) {
    const { count } = await supabaseAdmin
      .from('newsletter_drafts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    pendingCount = count ?? 0;
  }

  const tips = (latest.tips_json as Tip[]) ?? [];

  const sentLabel = publishedAt
    ? new Date(publishedAt).toLocaleDateString('es-MX', {
        weekday: 'short', day: 'numeric', month: 'long',
      })
    : null;

  // Relative time
  const sentRelative = publishedAt
    ? (() => {
        const diffHours = Math.floor(
          (Date.now() - new Date(publishedAt).getTime()) / 3_600_000
        );
        if (diffHours < 1)  return 'hace menos de 1 h';
        if (diffHours < 24) return `hace ${diffHours} h`;
        const diffDays = Math.floor(diffHours / 24);
        return `hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
      })()
    : null;

  const historialHref = isAthlete
    ? '/admin/notificaciones/newsletter/historial'
    : '/admin/notificaciones/newsletter/historial';

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-5 mb-6">
      {/* Admin pending banner */}
      {isAdmin && pendingCount > 0 && (
        <Link
          href="/admin/notificaciones/newsletter"
          className="flex items-center justify-between mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 hover:bg-amber-100 transition-colors"
        >
          <span className="text-sm font-medium text-amber-800">
            ⚠ {pendingCount} newsletter{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de aprobación
          </span>
          <span className="text-xs text-amber-600 font-semibold">Revisar ahora →</span>
        </Link>
      )}

      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-teal-600 uppercase tracking-wider">
          📰 Newsletter de hoy
        </span>
        {sentRelative && (
          <span className="text-xs text-gray-400">{sentRelative}</span>
        )}
      </div>

      {/* Subject */}
      <h2 className="text-lg font-bold text-teal-900 leading-snug mb-1">
        {latest.asunto}
      </h2>
      {sentLabel && (
        <p className="text-xs text-gray-400 mb-3">{sentLabel}</p>
      )}

      {/* Intro (clamped) */}
      {latest.intro && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {latest.intro}
        </p>
      )}

      {/* Tips preview (emoji + title only) */}
      {tips.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-4">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-base">{tip.emoji}</span>
              <span className="text-sm font-medium text-gray-700 truncate">{tip.titulo}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <NewsletterReadModal
        htmlContent={latest.html_content}
        title={latest.asunto}
        historialHref={historialHref}
      />
    </div>
  );
}

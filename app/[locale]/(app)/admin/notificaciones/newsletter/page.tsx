// app/[locale]/(app)/admin/notificaciones/newsletter/page.tsx
// Newsletter admin panel — Server Component.
// Guarded to staff roles with newsletter.view or newsletter.approve.

import { requirePermission }         from '@/lib/rbac/server';
import { getCurrentUser }            from '@/lib/rbac/server';
import { supabaseAdmin }             from '@/lib/supabase-admin';
import BackButton                    from '@/components/back-button';
import NewsletterAdminPanel          from './components/NewsletterAdminPanel';
import type { NewsletterDraft, Tip } from '@/lib/newsletter/types';

export const dynamic = 'force-dynamic';

// Supabase returns tips_json as Json — cast it to our type
type DraftRow = Omit<NewsletterDraft, 'tips_json' | 'html_content'> & {
  tips_json: Tip[];
};

export default async function NewsletterAdminPage() {
  // Guard — any staff role with newsletter access
  await requirePermission('newsletter.view');

  const user = await getCurrentUser();
  const canApprove = !!(
    user?.permissions.has('newsletter.approve') ||
    user?.roles.some((r) =>
      ['super_admin', 'program_director', 'event_coordinator',
       'coach', 'medic', 'physio', 'psychologist', 'nutritionist'].includes(r.code)
    )
  );

  // Recent drafts (last 7 days) — auto-approved, sent, or pending
  const { data: pending } = await supabaseAdmin
    .from('newsletter_drafts')
    .select(
      'id, audiencia, asunto, preview_text, intro, tips_json, status, ' +
      'scheduled_for, approved_by, approved_at, approval_note, rejected_reason, ' +
      'recipient_count, sent_at, created_at, updated_at, onesignal_id'
    )
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <main className="p-8">
      <BackButton href="/admin/notificaciones" label="Volver a Notificaciones" />

      <div className="mt-4 mb-6">
        <h1 className="text-3xl font-bold text-teal-700">Newsletter Diario</h1>
        <p className="text-sm text-gray-500 mt-1">
          El newsletter se genera y envía automáticamente cada día a las 7:00 AM,
          solo cuando hay actividad reciente de coaches o staff. Aquí puedes ver el historial.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Envío automático activo — no requiere aprobación manual
        </div>
      </div>

      <NewsletterAdminPanel
        pendingDrafts={(pending ?? []) as unknown as DraftRow[]}
        canApprove={canApprove}
      />
    </main>
  );
}

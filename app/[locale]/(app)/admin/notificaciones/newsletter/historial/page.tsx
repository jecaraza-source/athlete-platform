// app/[locale]/(app)/admin/notificaciones/newsletter/historial/page.tsx
// Public history of sent newsletters — accessible to any authenticated user.

import { requireAuthenticated } from '@/lib/rbac/server';
import { supabaseAdmin }        from '@/lib/supabase-admin';
import BackButton               from '@/components/back-button';
import Link                     from 'next/link';
import NewsletterReadModal       from '@/components/newsletter/NewsletterReadModal';

export const dynamic = 'force-dynamic';

const AUDIENCIA_LABEL: Record<string, string> = {
  atleta: 'Atletas',
  coach:  'Coaches',
  all:    'Todos',
};

const AUDIENCIA_COLORS: Record<string, string> = {
  atleta: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  coach:  'border-sky-200 bg-sky-50 text-sky-700',
  all:    'border-violet-200 bg-violet-50 text-violet-700',
};

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default async function NewsletterHistorialPage() {
  await requireAuthenticated();

  const { data: newsletters } = await supabaseAdmin
    .from('newsletter_drafts')
    .select('id, audiencia, asunto, preview_text, intro, tips_json, html_content, sent_at, recipient_count')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(50);

  const items = newsletters ?? [];

  return (
    <main className="p-8">
      <BackButton href="/admin/notificaciones/newsletter" label="Volver a Newsletter" />

      <div className="mt-4 mb-8">
        <h1 className="text-3xl font-bold text-teal-700">Historial de Newsletters</h1>
        <p className="text-sm text-gray-500 mt-1">
          Todos los newsletters enviados a atletas y coaches.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-16 text-center text-gray-400">
          Aún no se han enviado newsletters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Header: audiencia + date */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${AUDIENCIA_COLORS[item.audiencia] ?? 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                  {AUDIENCIA_LABEL[item.audiencia] ?? item.audiencia}
                </span>
                <span className="text-xs text-gray-400">{fmt(item.sent_at)}</span>
              </div>

              {/* Subject */}
              <h2 className="text-base font-bold text-gray-800 leading-snug">
                {item.asunto}
              </h2>

              {/* Intro preview */}
              {item.intro && (
                <p className="text-sm text-gray-500 line-clamp-2">{item.intro}</p>
              )}

              {/* Recipients */}
              {item.recipient_count > 0 && (
                <p className="text-xs text-gray-400">
                  {item.recipient_count.toLocaleString('es-MX')} destinatarios
                </p>
              )}

              {/* Read action */}
              <div className="mt-auto">
                <NewsletterReadModal
                  htmlContent={item.html_content}
                  title={item.asunto}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Back to panel */}
      <div className="mt-8 text-center">
        <Link
          href="/admin/notificaciones/newsletter"
          className="text-sm text-teal-600 hover:text-teal-800 font-medium"
        >
          ← Volver al panel de administración
        </Link>
      </div>
    </main>
  );
}

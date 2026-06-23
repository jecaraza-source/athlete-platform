import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentUser } from '@/lib/rbac/server';
import BackButton from '@/components/back-button';

export const dynamic = 'force-dynamic';

const MEDICAL_ROLE_CODES = [
  'medic', 'psychologist', 'nutritionist', 'physio',
  'admin', 'super_admin', 'program_director', 'event_coordinator',
];

const STATUS_PILL: Record<string, string> = {
  scheduled:      'bg-blue-100 text-blue-700',
  show:           'bg-emerald-100 text-emerald-700',
  no_show:        'bg-red-100 text-red-700',
  no_show_remote: 'bg-orange-100 text-orange-700',
  rescheduled:    'bg-amber-100 text-amber-700',
  cancelled:      'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<string, string> = {
  scheduled:      'Programada',
  show:           'Atendida',
  no_show:        'No asistió',
  no_show_remote: 'Llamada/Mensaje',
  rescheduled:    'Reagendada',
  cancelled:      'Cancelada',
};

type EventRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: string;
  event_participants: {
    // aliased as 'athlete' with !participant_id FK hint
    athlete: { first_name: string; last_name: string } | null;
  }[];
};

export default async function AppointmentsListPage() {
  const locale = await getLocale();

  const user = await getCurrentUser();
  if (!user?.profile) redirect(`/${locale}/login`);

  const userRoleCodes = user.roles.map((r) => r.code);
  if (!userRoleCodes.some((c) => MEDICAL_ROLE_CODES.includes(c))) {
    redirect(`/${locale}/dashboard`);
  }

  const isAdmin = userRoleCodes.some((c) =>
    ['admin', 'super_admin', 'program_director', 'event_coordinator'].includes(c),
  );

  // Build query — admins see all medical events, specialists see their own
  // Note: !participant_id hint needed because FK column name differs from table name
  let query = supabaseAdmin
    .from('events')
    .select(`
      id, title, start_at, end_at, status,
      event_participants(
        athlete:athletes!participant_id(first_name, last_name)
      )
    `)
    .eq('event_type', 'medical')
    .order('start_at', { ascending: false })
    .limit(50);

  // Filter by created_by_profile_id (used as specialist identifier)
  if (!isAdmin) {
    query = query.eq('created_by_profile_id', user.profile.id);
  }

  const { data, error } = await query;
  const events = (data ?? []) as unknown as EventRow[];

  // Separate upcoming vs past
  const now = new Date();
  const CLOSED = ['show', 'no_show', 'no_show_remote', 'rescheduled', 'cancelled'];
  const upcoming = events.filter((e) => !CLOSED.includes(e.status) || new Date(e.start_at) >= now);
  const past     = events.filter((e) => CLOSED.includes(e.status) && new Date(e.start_at) < now);

  function renderList(items: EventRow[]) {
    if (items.length === 0) {
      return <p className="text-sm text-gray-400 italic py-2">Sin citas en este período.</p>;
    }
    return (
      <ul className="divide-y divide-gray-100">
        {items.map((ev) => {
          const athlete = ev.event_participants?.[0]?.athlete;
          const athleteName = athlete
            ? `${athlete.first_name} ${athlete.last_name}`
            : 'Atleta no asignado';
          const needsAction = ev.status === 'scheduled';

          return (
            <li key={ev.id}>
              <Link
                href={`/medical/appointments/${ev.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                {/* Date block */}
                <div className="w-12 text-center shrink-0">
                  <p className="text-xs font-medium text-gray-400 uppercase">
                    {new Date(ev.start_at).toLocaleDateString('es-MX', { month: 'short' })}
                  </p>
                  <p className="text-2xl font-bold text-gray-800 leading-none">
                    {new Date(ev.start_at).getDate()}
                  </p>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800 truncate">{athleteName}</p>
                    {needsAction && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-indigo-500" title="Requiere acción" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(ev.start_at).toLocaleTimeString('es-MX', {
                      hour:   '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}
                    {ev.title}
                  </p>
                </div>

                {/* Status pill */}
                <span className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_PILL[ev.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[ev.status] ?? ev.status}
                </span>

                {/* Arrow */}
                <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-sm">›</span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <BackButton href="/dashboard" label="Volver al dashboard" />

      <h1 className="mt-5 text-2xl font-bold text-gray-900">Mis citas médicas</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        {isAdmin ? 'Todas las citas médicas del sistema.' : 'Citas asignadas a tu perfil.'}
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Error al cargar las citas: {error.message}
        </div>
      )}

      {/* Upcoming */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Próximas · pendientes de acción
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {renderList(upcoming)}
        </div>
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Historial reciente
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {renderList(past)}
          </div>
        </section>
      )}
    </main>
  );
}

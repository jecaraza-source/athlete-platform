import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentUser } from '@/lib/rbac/server';
import Link from 'next/link';
import AppointmentHeader from '@/components/medical/AppointmentHeader';
import AthleteHistory from '@/components/medical/AthleteHistory';
import AttendanceActions from '@/components/medical/AttendanceActions';
import AppointmentReadOnly from '@/components/medical/AppointmentReadOnly';

export const dynamic = 'force-dynamic';

// Role codes that can access this view
const MEDICAL_ROLE_CODES = [
  'medic', 'psychologist', 'nutritionist', 'physio',
  'admin', 'super_admin', 'program_director',
];
const ADMIN_ROLE_CODES = ['admin', 'super_admin', 'program_director'];

// Statuses that make the view read-only
const CLOSED_STATUSES = ['show', 'no_show', 'rescheduled', 'cancelled'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AthleteRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  profile_id: string | null;
};

type ParticipantRow = {
  participant_id: string;
  attendance_status: string;
  athletes: AthleteRow | AthleteRow[] | null;
};

type SpecialistRow = {
  id: string;
  first_name: string;
  last_name: string;
};

type ConfirmedByRow = {
  first_name: string;
  last_name: string;
};

export type AppointmentEvent = {
  id: string;
  title: string;
  event_type: string;
  start_at: string;
  end_at: string;
  status: string;
  description: string | null;
  no_show_reason: string | null;
  reschedule_reason: string | null;
  original_event_id: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  specialist_id: string | null;
  specialist: SpecialistRow | SpecialistRow[] | null;
  confirmed_by_profile: ConfirmedByRow | ConfirmedByRow[] | null;
  event_participants: ParticipantRow[];
};

export type HistoryRow = {
  id: string;
  start_at: string;
  status: string;
  event_type: string;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const locale = await getLocale();
  const { eventId } = await params;

  // Auth guard
  const user = await getCurrentUser();
  if (!user?.profile) redirect(`/${locale}/login`);

  const userRoleCodes = user.roles.map((r) => r.code);
  const isMedicalStaff = userRoleCodes.some((c) => MEDICAL_ROLE_CODES.includes(c));
  if (!isMedicalStaff) redirect(`/${locale}/dashboard`);

  // Fetch the event with all related data
  const { data: rawEvent, error } = await supabaseAdmin
    .from('events')
    .select(`
      id, title, event_type, start_at, end_at, status, description,
      no_show_reason, reschedule_reason, original_event_id,
      confirmed_by, confirmed_at, specialist_id,
      specialist:profiles!specialist_id(id, first_name, last_name),
      confirmed_by_profile:profiles!confirmed_by(first_name, last_name),
      event_participants(
        participant_id, attendance_status,
        athletes(id, first_name, last_name, email, profile_id)
      )
    `)
    .eq('id', eventId)
    .single();

  if (error || !rawEvent) {
    return (
      <main className="p-8">
        <Link
          href="/medical/appointments"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors mb-6"
        >
          ← Volver a mis citas
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          Cita no encontrada o sin acceso.
        </div>
      </main>
    );
  }

  const event = rawEvent as unknown as AppointmentEvent;

  // Ownership check: specialist_id must match or user is admin
  const isAdmin = userRoleCodes.some((c) => ADMIN_ROLE_CODES.includes(c));
  const isOwner = event.specialist_id === user.profile.id;
  if (!isOwner && !isAdmin) redirect(`/${locale}/dashboard`);

  // Extract athlete from event_participants (individual medical appointments have one participant)
  const participant = event.event_participants?.[0] ?? null;
  const athleteRaw  = participant
    ? (Array.isArray(participant.athletes) ? participant.athletes[0] : participant.athletes)
    : null;
  const athlete = athleteRaw as AthleteRow | null;

  // Resolve specialist
  const specialistRaw = Array.isArray(event.specialist)
    ? event.specialist[0]
    : event.specialist;
  const specialist = specialistRaw as SpecialistRow | null;

  // Resolve confirmed-by
  const confirmedByRaw = Array.isArray(event.confirmed_by_profile)
    ? event.confirmed_by_profile[0]
    : event.confirmed_by_profile;
  const confirmedByProfile = confirmedByRaw as ConfirmedByRow | null;

  // Fetch athlete's appointment history
  let history: HistoryRow[] = [];
  if (athlete?.id) {
    const { data: histData } = await supabaseAdmin
      .from('event_participants')
      .select(`
        events(id, start_at, status, event_type)
      `)
      .eq('participant_id', athlete.id)
      .order('participant_id', { ascending: false })
      .limit(20);

    history = ((histData ?? []) as Array<{ events: HistoryRow | HistoryRow[] | null }>)
      .map((r) => (Array.isArray(r.events) ? r.events[0] : r.events))
      .filter((e): e is HistoryRow => e != null && e.id !== eventId)
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
      .slice(0, 10);
  }

  const isReadOnly = CLOSED_STATUSES.includes(event.status);
  const canEdit = isOwner || isAdmin;

  return (
    <main className="p-6 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/medical/appointments"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
      >
        ← Volver a mis citas
      </Link>

      {/* Specialist name */}
      {specialist && (
        <p className="mt-3 text-xs text-gray-400 font-medium uppercase tracking-wide">
          {specialist.first_name} {specialist.last_name}
        </p>
      )}

      {/* Appointment header card */}
      <AppointmentHeader
        eventId={event.id}
        title={event.title}
        athlete={athlete}
        startAt={event.start_at}
        endAt={event.end_at}
        status={event.status}
        eventType={event.event_type}
      />

      {/* Athlete history (collapsible) */}
      {athlete && (
        <AthleteHistory
          athleteId={athlete.id}
          history={history}
          currentEventId={eventId}
        />
      )}

      {/* Main section: read-only vs interactive */}
      {isReadOnly ? (
        <AppointmentReadOnly
          event={event}
          confirmedBy={confirmedByProfile}
          canEdit={canEdit}
          currentUserId={user.profile.id}
        />
      ) : (
        <AttendanceActions
          eventId={eventId}
          specialistId={event.specialist_id ?? user.profile.id}
          serviceType={event.title}
          athleteId={athlete?.id ?? ''}
          athleteProfileId={athlete?.profile_id ?? null}
          startAt={event.start_at}
          endAt={event.end_at}
        />
      )}
    </main>
  );
}

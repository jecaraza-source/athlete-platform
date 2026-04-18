import BackButton from '@/components/back-button';
import { getTranslations } from 'next-intl/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/rbac/server';
import MonthCalendar from './month-calendar';
import EventsListClient from './events-list-client';

export const dynamic = 'force-dynamic';

type Sport = { id: string; name: string; category_type: string };

type EventRow = {
  id: string;
  title: string;
  event_type: string;
  sport_id: string | null;
  sport_name: string | null; // resolved from the sports join
  start_at: string;
  end_at: string;
  status: string;
  description: string | null;
};

export default async function CalendarPage() {
  await requirePermission('view_calendar');

  const [
    { data, error },
    { data: profilesData },
    { data: athletesData },
    { data: participantsData },
    { data: sportsData },
  ] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select('id, title, event_type, sport_id, start_at, end_at, status, description, sports(id, name)')
      .order('start_at', { ascending: true }),
    supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .order('last_name', { ascending: true }),
    supabaseAdmin
      .from('athletes')
      .select('id, first_name, last_name')
      .order('last_name', { ascending: true }),
    supabaseAdmin
      .from('event_participants')
      .select('event_id, participant_id'),
    supabaseAdmin
      .from('sports')
      .select('id, name, category_type')
      .eq('status', 'active')
      .order('name'),
  ]);

  // Flatten the sports join on each event (Supabase returns sports as array from the join)
  const rawEvents = (data ?? []) as unknown as (Omit<EventRow, 'sport_name'> & {
    sports: { id: string; name: string }[] | { id: string; name: string } | null;
  })[];
  const events: EventRow[] = rawEvents.map((e) => ({
    ...e,
    sport_name: (Array.isArray(e.sports) ? e.sports[0] : e.sports)?.name ?? null,
  }));

  const profiles    = (profilesData ?? []) as { id: string; first_name: string; last_name: string }[];
  const athletes    = (athletesData ?? []) as { id: string; first_name: string; last_name: string }[];
  const participants = (participantsData ?? []) as { event_id: string; participant_id: string }[];
  const sports      = (sportsData    ?? []) as Sport[];

  // Build a map: event_id → athletes who are participants
  const athleteById = Object.fromEntries(athletes.map((a) => [a.id, a]));
  const participantsByEvent: Record<string, { id: string; first_name: string; last_name: string }[]> = {};
  for (const p of participants) {
    const athlete = athleteById[p.participant_id];
    if (athlete) {
      (participantsByEvent[p.event_id] ??= []).push(athlete);
    }
  }

  const t = await getTranslations('calendar');
  const tc = await getTranslations('common');

  return (
    <main className="p-8">
      <BackButton href="/dashboard" label={tc('backToDashboard')} />
      <h1 className="text-3xl font-bold mt-4 mb-6 text-sky-700">{t('title')}</h1>

      <MonthCalendar
        events={events}
        profiles={profiles}
        athletes={athletes}
        participants={participants}
        sports={sports}
      />

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {t('errorLoadingEvents')} {error.message}
        </div>
      )}

      {!error && (
        <EventsListClient
          events={events}
          athletes={athletes}
          participantsByEvent={participantsByEvent}
          sports={sports}
        />
      )}
    </main>
  );
}
import BackButton from '@/components/back-button';
import { getTranslations } from 'next-intl/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPermission, requirePermission, getCurrentUser } from '@/lib/rbac/server';
import { DISCIPLINES } from '@/lib/types/diagnostic';
import MonthCalendar from './month-calendar';
import EventsListClient from './events-list-client';

export type Shift = 'morning' | 'afternoon';

export const dynamic = 'force-dynamic';

type Sport = { id: string; name: string; category_type: string };

type EventRow = {
  id: string;
  title: string;
  event_type: string;
  sport_id: string | null;
  sport_name: string | null;
  start_at: string;
  end_at: string;
  status: string;
  description: string | null;
  shift: Shift;
};

const PAGE = 1000;

/** Paginates events filtered by allowed shifts. */
async function fetchAllEvents(shifts: Shift[]) {
  const all: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    let q = supabaseAdmin
      .from('events')
      .select('id, title, event_type, sport_id, start_at, end_at, status, description, shift, sports(id, name)')
      .order('start_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (shifts.length === 1) q = q.eq('shift', shifts[0]);
    else q = q.in('shift', shifts);
    const { data, error } = await q;
    if (error || !data?.length) break;
    all.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/** Paginates all event_participants (bypasses Supabase's 1,000-row server cap). */
async function fetchAllParticipants() {
  const all: { event_id: string; participant_id: string }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('event_participants')
      .select('event_id, participant_id')
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    all.push(...(data as { event_id: string; participant_id: string }[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/** Paginates all athletes. */
async function fetchAllAthletes() {
  const all: { id: string; first_name: string; last_name: string; discipline: string | null }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('athletes')
      .select('id, first_name, last_name, discipline')
      .order('last_name', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    all.push(...(data as { id: string; first_name: string; last_name: string; discipline: string | null }[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export default async function CalendarPage() {
  const [canViewAfternoon, canViewMorning, canManageMorning] = await Promise.all([
    hasPermission('view_calendar'),
    hasPermission('view_morning_calendar'),
    hasPermission('manage_morning_calendar'),
  ]);

  if (!canViewAfternoon && !canViewMorning) {
    await requirePermission('view_calendar'); // triggers redirect
  }

  const availableShifts: Shift[] = [
    ...(canViewAfternoon ? ['afternoon' as Shift] : []),
    ...(canViewMorning   ? ['morning'   as Shift] : []),
  ];

  const currentUser = await getCurrentUser();
  const currentProfileId = currentUser?.profile?.id ?? '';

  // Fetch events, athletes, participants and sports in parallel.
  // events and event_participants exceed 1,000 rows, so we use paginated fetchers.
  const [rawEventsAll, athletesData, participantsAll, { data: sportsData }] = await Promise.all([
    fetchAllEvents(availableShifts),
    fetchAllAthletes(),
    fetchAllParticipants(),
    supabaseAdmin.from('sports').select('id, name, category_type').eq('status', 'active').order('name'),
  ]);

  const error = null; // paginated fetchers handle errors internally

  // Flatten the sports join on each event (Supabase returns sports as array from the join)
  const rawEvents = rawEventsAll as unknown as (Omit<EventRow, 'sport_name'> & {
    sports: { id: string; name: string }[] | { id: string; name: string } | null;
  })[];
  const events: EventRow[] = Array.from(
    new Map(
      rawEvents.map((e) => [
        e.id,
        {
          ...e,
          sport_name: (Array.isArray(e.sports) ? e.sports[0] : e.sports)?.name ?? null,
          shift: (e.shift as Shift) ?? 'afternoon',
        },
      ])
    ).values()
  );

  const athletes    = athletesData;
  const participants = participantsAll;

  // Deduplicate sports by normalized name (strips accents, spaces, lowercases)
  // e.g. "Tae Kwon Do" and "Taekwondo" collapse to the same key
  const normalizeName = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
  const uniqueSportsMap = new Map<string, Sport>();
  for (const s of (sportsData ?? []) as Sport[]) {
    const key = normalizeName(s.name);
    if (!uniqueSportsMap.has(key)) uniqueSportsMap.set(key, s);
  }
  const sports = Array.from(uniqueSportsMap.values());

  // Build a map: event_id → athletes who are participants (includes discipline for filtering)
  const athleteById = Object.fromEntries(athletes.map((a) => [a.id, a]));
  const participantsByEvent: Record<string, { id: string; first_name: string; last_name: string; discipline?: string | null }[]> = {};
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
        currentProfileId={currentProfileId}
        athletes={athletes}
        participants={participants}
        sports={sports}
        disciplines={DISCIPLINES}
        availableShifts={availableShifts}
        canManage={canManageMorning || canViewAfternoon}
      />

      <EventsListClient
        events={events}
        athletes={athletes}
        participantsByEvent={participantsByEvent}
        sports={sports}
        disciplines={DISCIPLINES.map((d) => ({ value: d.value, label: d.label }))}
        availableShifts={availableShifts}
        canManageMorning={canManageMorning}
      />
    </main>
  );
}
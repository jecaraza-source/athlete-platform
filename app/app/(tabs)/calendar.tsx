import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, useColorScheme, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, PRIMARY } from '@/constants/theme';
import { useAuthStore } from '@/store';
import { listEventsInRange, listEventsForAthlete, type CalendarEvent } from '@/services/calendar';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

type EventTypeConfig = { label: string; color: string; bg: string; icon: string };

const EVENT_TYPE: Record<string, EventTypeConfig> = {
  training:    { label: 'Entrenamiento', color: '#0369a1', bg: '#e0f2fe', icon: 'barbell-outline' },
  competition: { label: 'Competencia',  color: '#dc2626', bg: '#fee2e2', icon: 'trophy-outline' },
  meeting:     { label: 'Reunión',      color: '#7c3aed', bg: '#f3e8ff', icon: 'people-outline' },
  medical:     { label: 'Médico',       color: '#15803d', bg: '#dcfce7', icon: 'medical-outline' },
};
const EVENT_TYPE_DEFAULT: EventTypeConfig = {
  label: 'Evento', color: '#92400e', bg: '#fef3c7', icon: 'calendar-outline',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function rangeForMonth(year: number, month: number): [string, string] {
  const start = new Date(year, month, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, month + 1, 0);
  end.setHours(23, 59, 59, 999);
  return [start.toISOString(), end.toISOString()];
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Event card
// ---------------------------------------------------------------------------

function EventCard({ event }: { event: CalendarEvent }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const cfg = EVENT_TYPE[event.event_type] ?? EVENT_TYPE_DEFAULT;

  // Build participant names string (only for staff view where participants are fetched)
  const participantNames = event.participants.length > 0
    ? event.participants.map((p) => `${p.first_name} ${p.last_name}`).join(', ')
    : null;

  return (
    <View
      style={[
        styles.eventCard,
        { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff', borderLeftColor: cfg.color },
      ]}
    >
      <View style={styles.eventCardRow}>
        <View style={[styles.eventTypeBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as never} size={13} color={cfg.color} />
          <Text style={[styles.eventTypeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={[styles.eventTime, { color: colors.icon }]}>
          {formatTime(event.start_at)}
          {event.end_at ? ` – ${formatTime(event.end_at)}` : ''}
        </Text>
      </View>
      <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
      {event.description ? (
        <Text style={[styles.eventDesc, { color: colors.icon }]} numberOfLines={2}>
          {event.description}
        </Text>
      ) : null}
      {participantNames && (
        <View style={styles.participantsRow}>
          <Ionicons name="people-outline" size={12} color={colors.icon} />
          <Text style={[styles.participantsText, { color: colors.icon }]} numberOfLines={1}>
            {participantNames}
          </Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function CalendarScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const today = new Date();

  const isInitialized = useAuthStore((s) => s.isInitialized);
  const profileId     = useAuthStore((s) => s.profile?.id);
  // isAthleteUser controls DATA filtering (participant-based vs all-events) — keep as role check
  const isAthleteUser    = useAuthStore((s) => s.roles.some((r) => r.code === 'athlete'));
  // FAB visibility is an ACCESS CONTROL decision — use permission
  const canManageCalendar = useAuthStore((s) => s.hasPermission('manage_calendar'));

  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());

  const [events, setEvents]         = useState<CalendarEvent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey]   = useState(0);

  // Set of YYYY-MM-DD strings that have at least one event
  const eventDays = new Set(events.map((e) => e.start_at.slice(0, 10)));

  // Events for the currently selected day
  const selectedKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const dayEvents = events.filter((e) => e.start_at.slice(0, 10) === selectedKey);

  // ---------------------------------------------------------------------------
  // Main data-loading effect.
  // Runs whenever: year/month changes, profile loads, auth fully initializes,
  // the cached athleteId is set, or the user pulls to refresh.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isInitialized) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
        try {
          const [startISO, endISO] = rangeForMonth(year, month);
          let data: CalendarEvent[];

          if (isAthleteUser) {
            // Athlete: filter events by their profile ID.
            if (profileId) {
              data = await listEventsForAthlete(profileId, startISO, endISO);
            } else {
              // profile not yet resolved — show all as fallback
              data = await listEventsInRange(startISO, endISO);
            }
          } else {
            // Staff / admin / any other role: show ALL events in the range
            data = await listEventsInRange(startISO, endISO);
          }

        if (!cancelled) setEvents(data);
      } catch (e) {
        console.warn('[calendar] load error', e);
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [year, month, isInitialized, isAthleteUser, profileId, reloadKey]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedDay(1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedDay(1);
  }
  function forceReload() {
    setRefreshing(true);
    setReloadKey((k) => k + 1);
  }

  // Build calendar grid
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
    <ScrollView
      style={styles.flex}
      refreshControl={
        <RefreshControl
        refreshing={refreshing}
          onRefresh={forceReload}
        />
      }
    >
      {/* Month navigator */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>
          {MONTHS_ES[month]} {year}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={22} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {/* Day-of-week header */}
      <View style={styles.row}>
        {DAY_LABELS.map((d) => (
          <View key={d} style={styles.cell}>
            <Text style={[styles.dayOfWeek, { color: colors.icon }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((day, ci) => {
            if (day === null) return <View key={ci} style={styles.cell} />;
            const isToday =
              day === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();
            const isSelected = day === selectedDay;
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasEvent = eventDays.has(dateKey);

            return (
              <TouchableOpacity
                key={ci}
                style={styles.cell}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.dayCircle,
                    isSelected && { backgroundColor: PRIMARY },
                    isToday && !isSelected && { borderWidth: 2, borderColor: PRIMARY },
                  ]}
                >
                  <Text style={[styles.dayText, { color: isSelected ? '#fff' : colors.text }]}>
                    {day}
                  </Text>
                </View>
                {hasEvent && (
                  <View style={[styles.dot, { backgroundColor: isSelected ? '#fff' : PRIMARY }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Events for selected day */}
      <View style={styles.eventsSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {DAY_LABELS[new Date(year, month, selectedDay).getDay()]}{' '}
          {selectedDay} de {MONTHS_ES[month]}
        </Text>

        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 20 }} />
        ) : dayEvents.length === 0 ? (
          <View style={styles.emptyDay}>
            <Ionicons name="calendar-outline" size={36} color={colors.icon} />
            <Text style={[styles.emptyText, { color: colors.icon }]}>Sin eventos este día</Text>
          </View>
        ) : (
          dayEvents.map((ev) => <EventCard key={ev.id} event={ev} />)
        )}
      </View>
    </ScrollView>

    {/* FAB — visible only with manage_calendar permission */}
    {canManageCalendar && (
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: PRIMARY }]}
        onPress={() => router.push('/app/calendar/create' as never)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 54, height: 54, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  navBtn: { padding: 4 },
  monthLabel: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayOfWeek: { fontSize: 11, fontWeight: '600' },
  dayCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  dayText: { fontSize: 14, fontWeight: '500' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  eventsSection: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  emptyDay: { alignItems: 'center', paddingTop: 24, gap: 8 },
  emptyText: { fontSize: 14 },
  eventCard: {
    borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  eventCardRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  eventTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  eventTypeText: { fontSize: 11, fontWeight: '600' },
  eventTime: { fontSize: 12 },
  eventTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  eventDesc: { fontSize: 13, lineHeight: 18 },
  participantsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  participantsText: { fontSize: 11, flex: 1 },
});

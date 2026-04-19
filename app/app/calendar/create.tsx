/**
 * calendar/create.tsx
 *
 * Form screen for creating a new calendar event.
 * Only reachable for staff/coach users (the FAB in calendar.tsx is hidden
 * for athletes). RLS also enforces this on the server side.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, useColorScheme,
  TouchableOpacity, Alert, Modal, FlatList, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY } from '@/constants/theme';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store';
import { createCalendarEvent, addEventParticipants } from '@/services/calendar';
import { notifyProfiles } from '@/services/notifications';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Event type options
// ---------------------------------------------------------------------------

type EventTypeOption = { value: string; label: string; color: string; icon: string };

const EVENT_TYPES: EventTypeOption[] = [
  { value: 'training',    label: 'Entrenamiento', color: '#0369a1', icon: 'barbell-outline' },
  { value: 'competition', label: 'Competencia',   color: '#dc2626', icon: 'trophy-outline' },
  { value: 'meeting',     label: 'Reunión',       color: '#7c3aed', icon: 'people-outline' },
  { value: 'medical',     label: 'Médico',        color: '#15803d', icon: 'medical-outline' },
  { value: 'other',       label: 'Otro',          color: '#92400e', icon: 'calendar-outline' },
];

// ---------------------------------------------------------------------------
// DateTimeField — date navigator + separate hour/minute selectors
// ---------------------------------------------------------------------------

const HS = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * Serialise a Date to a local-time ISO string (YYYY-MM-DDTHH:mm).
 * Unlike toISOString(), this does NOT convert to UTC, so the displayed
 * date/time always matches the device's clock.
 */
function toLocalISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function shiftDate(iso: string, delta: number): string {
  const d = new Date(iso); // parses as local — correct because we write local
  d.setDate(d.getDate() + delta);
  return toLocalISO(d);
}

function shiftHour(iso: string, delta: number): string {
  const d = new Date(iso);
  d.setHours(d.getHours() + delta);
  return toLocalISO(d);
}

function shiftMinute(iso: string, delta: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + delta);
  return toLocalISO(d);
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function DateTimeField({
  label, value, onChange, error,
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const borderColor = error ? '#dc2626' : (scheme === 'dark' ? '#374151' : '#e2e8f0');
  const bg          = scheme === 'dark' ? '#1e2022' : '#f8fafc';

  const dateStr = value.slice(0, 10);  // "2024-04-19"
  const hourStr = value.slice(11, 13); // "14"
  const minStr  = value.slice(14, 16); // "30"

  return (
    <View style={dtStyles.wrapper}>
      <Text style={[dtStyles.label, { color: colors.text }]}>{label}</Text>

      {/* ── Date row ──────────────────────────────────────── */}
      <View style={[dtStyles.row, { backgroundColor: bg, borderColor }]}>
        <TouchableOpacity onPress={() => onChange(shiftDate(value, -1))} hitSlop={HS} style={dtStyles.btn}>
          <Ionicons name="chevron-back" size={20} color={PRIMARY} />
        </TouchableOpacity>
        <View style={dtStyles.center}>
          <Text style={[dtStyles.main, { color: colors.text }]}>{dateStr}</Text>
          <Text style={[dtStyles.sub, { color: colors.icon }]}>
            {new Date(value).toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })}
          </Text>
        </View>
        <TouchableOpacity onPress={() => onChange(shiftDate(value, 1))} hitSlop={HS} style={dtStyles.btn}>
          <Ionicons name="chevron-forward" size={20} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {/* ── Time row ──────────────────────────────────────── */}
      <View style={[dtStyles.timeRow, { backgroundColor: bg, borderColor }]}>
        {/* Hour */}
        <TouchableOpacity onPress={() => onChange(shiftHour(value, -1))} hitSlop={HS} style={dtStyles.btn}>
          <Ionicons name="chevron-back" size={18} color={PRIMARY} />
        </TouchableOpacity>
        <View style={dtStyles.timeUnit}>
          <Text style={[dtStyles.timeVal, { color: colors.text }]}>{hourStr}</Text>
          <Text style={[dtStyles.timeLbl, { color: colors.icon }]}>hr</Text>
        </View>
        <TouchableOpacity onPress={() => onChange(shiftHour(value, 1))} hitSlop={HS} style={dtStyles.btn}>
          <Ionicons name="chevron-forward" size={18} color={PRIMARY} />
        </TouchableOpacity>

        <Text style={[dtStyles.colon, { color: colors.text }]}>:</Text>

        {/* Minute — steps of 15 */}
        <TouchableOpacity onPress={() => onChange(shiftMinute(value, -15))} hitSlop={HS} style={dtStyles.btn}>
          <Ionicons name="chevron-back" size={18} color={PRIMARY} />
        </TouchableOpacity>
        <View style={dtStyles.timeUnit}>
          <Text style={[dtStyles.timeVal, { color: colors.text }]}>{minStr}</Text>
          <Text style={[dtStyles.timeLbl, { color: colors.icon }]}>min</Text>
        </View>
        <TouchableOpacity onPress={() => onChange(shiftMinute(value, 15))} hitSlop={HS} style={dtStyles.btn}>
          <Ionicons name="chevron-forward" size={18} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {error && <Text style={dtStyles.error}>{error}</Text>}
    </View>
  );
}

const dtStyles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label:   { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  // Date row
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 10,
  },
  btn:    { paddingHorizontal: 12, paddingVertical: 10 },
  center: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  main:   { fontSize: 15, fontWeight: '600' },
  sub:    { fontSize: 11, marginTop: 2 },
  error:  { marginTop: 4, fontSize: 12, color: '#dc2626' },
  // Time row
  timeRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 10, marginTop: 8,
  },
  timeUnit: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  timeVal:  { fontSize: 22, fontWeight: '700' },
  timeLbl:  { fontSize: 10, marginTop: 1 },
  colon:    { fontSize: 22, fontWeight: '700', paddingHorizontal: 2 },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

function nowISO(): string {
  const d = new Date();
  // Round up to nearest 30 min
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0);
  return toLocalISO(d); // local time so the picker shows the device clock
}

export default function CreateCalendarEventScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { profile } = useAuthStore();

  const [title,       setTitle]       = useState('');
  const [eventType,   setEventType]   = useState('training');
  const [startAt,     setStartAt]     = useState(nowISO());
  const [hasEnd,      setHasEnd]      = useState(false);
  const [endAt,       setEndAt]       = useState(() => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30 + 60, 0, 0);
    return toLocalISO(d);
  });
  const [description, setDescription] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  // Participant picker state
  type PersonProfile = { id: string; first_name: string; last_name: string };
  const [participants,   setParticipants]   = useState<PersonProfile[]>([]);
  const [peopleList,     setPeopleList]     = useState<PersonProfile[]>([]);
  const [pickerOpen,     setPickerOpen]     = useState(false);
  const [pickerSearch,   setPickerSearch]   = useState('');

  // Notification options
  const [notifyPush,  setNotifyPush]  = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);

  const filteredPeople = pickerSearch.trim()
    ? peopleList.filter((p) =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(pickerSearch.toLowerCase())
      )
    : peopleList;

  // Load all profiles for participant assignment
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .order('last_name', { ascending: true });
        if (!error) {
          setPeopleList(
            (data ?? [])
              .filter((p) => p.id && p.first_name)
              .map(({ id, first_name, last_name }) => ({ id, first_name, last_name })) as PersonProfile[],
          );
        }
      } catch (e) {
        console.warn('[calendar/create] load people error', e);
      }
    })();
  }, []);

  async function handleCreate() {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'El título es obligatorio';
    if (!startAt)      errs.startAt = 'La fecha de inicio es obligatoria';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!profile) { Alert.alert('Error', 'No se encontró tu perfil.'); return; }

    setErrors({});
    setLoading(true);
    try {
      const event = await createCalendarEvent({
        title:                  title.trim(),
        event_type:             eventType,
        start_at:               new Date(startAt).toISOString(),
        end_at:                 hasEnd ? new Date(endAt).toISOString() : null,
        description:            description.trim() || null,
        created_by_profile_id:  profile.id,
      });
      if (participants.length > 0) {
        await addEventParticipants(event.id, participants.map((p) => p.id));
      }

      // Send notifications BEFORE navigating so any error is shown on this screen
      if ((notifyPush || notifyEmail) && participants.length > 0) {
        try {
          await notifyProfiles(
            participants.map((p) => p.id),
            {
              notifyPush,
              notifyEmail,
              entityType:     'event',
              entityId:       event.id,
              pushTitle:      `Nuevo evento: ${title.trim()}`,
              pushMessage:    `${title.trim()} — ${formatDateTime(startAt)}`,
              emailSubject:   `Nuevo evento: ${title.trim()}`,
              emailHtmlBody:  `<p>Se ha creado el evento <strong>${title.trim()}</strong> para el ${formatDateTime(startAt)}.</p>`,
              emailPlainBody: `Se ha creado el evento "${title.trim()}" para el ${formatDateTime(startAt)}.`,
            },
          );
        } catch (ne: unknown) {
          const nm = (ne as { message?: string })?.message ?? 'Error desconocido';
          console.error('[calendar] notify error:', nm);
          Alert.alert(
            'Notificación no enviada',
            `El evento fue creado pero las notificaciones fallaron.\n\nDetalle: ${nm}\n\nVerifica que la migración 026 esté aplicada en Supabase.`,
          );
        }
      }

      router.back();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'No se pudo crear el evento';
      Alert.alert('Error al crear evento', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Input
          label="Título *"
          placeholder="Ej. Entrenamiento de fuerza"
          value={title}
          onChangeText={(v) => { setTitle(v); setErrors((p) => ({ ...p, title: '' })); }}
          error={errors.title}
        />

        {/* Event type selector */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Tipo de evento</Text>
        <View style={styles.typesRow}>
          {EVENT_TYPES.map((et) => {
            const selected = eventType === et.value;
            return (
              <TouchableOpacity
                key={et.value}
                onPress={() => setEventType(et.value)}
                style={[
                  styles.typeBtn,
                  {
                    backgroundColor: selected ? et.color + '22' : (scheme === 'dark' ? '#1e2022' : '#f1f5f9'),
                    borderColor: selected ? et.color : 'transparent',
                    borderWidth: selected ? 1.5 : 0,
                  },
                ]}
                activeOpacity={0.75}
              >
                <Ionicons name={et.icon as never} size={16} color={selected ? et.color : colors.icon} />
                <Text style={[styles.typeBtnText, { color: selected ? et.color : colors.icon }]}>
                  {et.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <DateTimeField
          label="Inicio *"
          value={startAt}
          onChange={(v) => { setStartAt(v); setErrors((p) => ({ ...p, startAt: '' })); }}
          error={errors.startAt}
        />

        {/* Toggle end time */}
        <TouchableOpacity
          onPress={() => setHasEnd((v) => !v)}
          style={styles.toggleRow}
          activeOpacity={0.7}
        >
          <View style={[
            styles.toggleDot,
            { backgroundColor: hasEnd ? PRIMARY : colors.icon },
          ]}>
            {hasEnd && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>
            Agregar hora de fin
          </Text>
        </TouchableOpacity>

        {hasEnd && (
          <DateTimeField
            label="Fin"
            value={endAt}
            onChange={setEndAt}
          />
        )}

        <Input
          label="Descripción (opcional)"
          placeholder="Detalles del evento..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: 'top' }}
        />

        {/* Notification options — visible when participants are selected */}
        {participants.length > 0 && (
          <View style={styles.notifSection}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Notificaciones</Text>
            <TouchableOpacity
              onPress={() => setNotifyPush((v) => !v)}
              style={styles.toggleRow}
              activeOpacity={0.7}
            >
              <View style={[styles.toggleDot, { backgroundColor: notifyPush ? PRIMARY : colors.icon }]}>
                {notifyPush && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Ionicons name="notifications-outline" size={15} color={notifyPush ? PRIMARY : colors.icon} style={{ marginLeft: 4, marginRight: 6 }} />
              <Text style={[styles.toggleLabel, { color: notifyPush ? colors.text : colors.icon }]}>Push notification</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setNotifyEmail((v) => !v)}
              style={styles.toggleRow}
              activeOpacity={0.7}
            >
              <View style={[styles.toggleDot, { backgroundColor: notifyEmail ? PRIMARY : colors.icon }]}>
                {notifyEmail && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Ionicons name="mail-outline" size={15} color={notifyEmail ? PRIMARY : colors.icon} style={{ marginLeft: 4, marginRight: 6 }} />
              <Text style={[styles.toggleLabel, { color: notifyEmail ? colors.text : colors.icon }]}>Email</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Participant picker */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Participantes (opcional)</Text>
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          style={[
            styles.pickerBtn,
            {
              backgroundColor: scheme === 'dark' ? '#1e2022' : '#f8fafc',
              borderColor: scheme === 'dark' ? '#374151' : '#e2e8f0',
            },
          ]}
        >
          <Ionicons name="people-outline" size={16} color={colors.icon} style={{ marginRight: 8 }} />
          <Text style={[styles.pickerBtnText, { color: colors.icon }]}>
            {participants.length > 0 ? `${participants.length} participante(s)` : 'Agregar participantes...'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.icon} />
        </TouchableOpacity>

        {/* Selected participant chips — horizontally scrollable */}
        {participants.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            style={styles.chipsScrollView}
            contentContainerStyle={styles.chipsContent}
          >
            {participants.map((p) => (
              <View
                key={p.id}
                style={[styles.chip, { backgroundColor: PRIMARY + '18', borderColor: PRIMARY + '40' }]}
              >
                <Text style={[styles.chipText, { color: PRIMARY }]}>
                  {p.first_name} {p.last_name}
                </Text>
                <TouchableOpacity
                  onPress={() => setParticipants((prev) => prev.filter((x) => x.id !== p.id))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color={PRIMARY} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Participant picker modal */}
        <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Agregar participantes</Text>
              <TouchableOpacity onPress={() => { setPickerOpen(false); setPickerSearch(''); }}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>

            <View style={[styles.modalSearch, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#f1f5f9' }]}>
              <Ionicons name="search-outline" size={16} color={colors.icon} style={{ marginRight: 6 }} />
              <TextInput
                style={[styles.modalSearchInput, { color: colors.text }]}
                placeholder="Buscar..."
                placeholderTextColor={colors.icon}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoFocus
              />
            </View>

            {/* None option */}
            <TouchableOpacity
              style={[styles.personRow, { borderBottomColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}
              onPress={() => { setParticipants([]); setPickerOpen(false); setPickerSearch(''); }}
            >
              <View style={styles.personAvatar}>
                <Ionicons name="people-outline" size={16} color={colors.icon} />
              </View>
              <Text style={[styles.personName, { color: colors.icon }]}>Sin participantes</Text>
              {participants.length === 0 && <Ionicons name="checkmark" size={18} color={PRIMARY} />}
            </TouchableOpacity>

            <FlatList
              data={filteredPeople}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const initials = `${item.first_name[0] ?? ''}${item.last_name[0] ?? ''}`.toUpperCase();
                const selected = participants.some((a) => a.id === item.id);
                return (
                  <TouchableOpacity
                    style={[styles.personRow, { borderBottomColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}
                    onPress={() =>
                      setParticipants((prev) =>
                        prev.some((a) => a.id === item.id)
                          ? prev.filter((a) => a.id !== item.id)
                          : [...prev, item],
                      )
                    }
                  >
                    <View style={[styles.personAvatar, { backgroundColor: PRIMARY }]}>
                      <Text style={styles.personInitials}>{initials}</Text>
                    </View>
                    <Text style={[styles.personName, { color: colors.text }]}>
                      {item.first_name} {item.last_name}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={18} color={PRIMARY} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.icon }]}>Sin resultados</Text>
              }
            />

            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: PRIMARY }]}
              onPress={() => { setPickerOpen(false); setPickerSearch(''); }}
            >
              <Text style={styles.doneBtnText}>Listo</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        <Button
          label="Crear evento"
          onPress={handleCreate}
          loading={loading}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },

  sectionLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },

  typesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  typeBtnText: { fontSize: 12, fontWeight: '600' },

  toggleRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  toggleDot:   {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  toggleLabel: { fontSize: 14 },

  // Participant picker
  pickerBtn: {
    height: 48, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, flexDirection: 'row',
    alignItems: 'center', marginBottom: 10,
  },
  pickerBtnText: { fontSize: 15, flex: 1 },

  // Chips
  chipsScrollView: { marginBottom: 14 },
  chipsContent:    { gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { fontSize: 13, fontWeight: '500' },

  // Picker modal
  modalContainer: { flex: 1, paddingTop: 12 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0',
  },
  modalTitle:       { fontSize: 17, fontWeight: '700' },
  modalSearch: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 10,
    borderRadius: 10, paddingHorizontal: 12, height: 40,
  },
  modalSearchInput: { flex: 1, fontSize: 14 },
  personRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  personAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  personInitials: { color: '#fff', fontSize: 13, fontWeight: '700' },
  personName:     { flex: 1, fontSize: 15 },
  emptyText:      { textAlign: 'center', padding: 24, fontSize: 14 },
  doneBtn: {
    margin: 16, borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Notification section
  notifSection: { marginBottom: 14 },
});

/**
 * calendar/create.tsx
 *
 * Form screen for creating a new calendar event.
 * Only reachable for staff/coach users (the FAB in calendar.tsx is hidden
 * for athletes). RLS also enforces this on the server side.
 */

import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, useColorScheme,
  TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY } from '@/constants/theme';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store';
import { createCalendarEvent } from '@/services/calendar';

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
// DateTimeField — simple navigation-based date+time selector
// ---------------------------------------------------------------------------

function shiftDate(iso: string, delta: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
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

  return (
    <View style={dtStyles.wrapper}>
      <Text style={[dtStyles.label, { color: colors.text }]}>{label}</Text>
      <View style={[
        dtStyles.row,
        {
          backgroundColor: scheme === 'dark' ? '#1e2022' : '#f8fafc',
          borderColor: error ? '#dc2626' : scheme === 'dark' ? '#374151' : '#e2e8f0',
        },
      ]}>
        <TouchableOpacity
          onPress={() => onChange(shiftDate(value, -1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={dtStyles.btn}
        >
          <Ionicons name="chevron-back" size={20} color={PRIMARY} />
        </TouchableOpacity>

        <View style={dtStyles.center}>
          <Text style={[dtStyles.main, { color: colors.text }]}>
            {value.slice(0, 10)}  {value.slice(11, 16)}
          </Text>
          <Text style={[dtStyles.sub, { color: colors.icon }]}>
            {formatDateTime(value)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => onChange(shiftDate(value, 1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={dtStyles.btn}
        >
          <Ionicons name="chevron-forward" size={20} color={PRIMARY} />
        </TouchableOpacity>
      </View>
      {error && <Text style={dtStyles.error}>{error}</Text>}
    </View>
  );
}

const dtStyles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label:   { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 10,
  },
  btn:    { paddingHorizontal: 12, paddingVertical: 12 },
  center: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  main:   { fontSize: 15, fontWeight: '600' },
  sub:    { fontSize: 11, marginTop: 2 },
  error:  { marginTop: 4, fontSize: 12, color: '#dc2626' },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

function nowISO(): string {
  const d = new Date();
  // Round to nearest 30 min
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0);
  return d.toISOString().slice(0, 16);
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
    return d.toISOString().slice(0, 16);
  });
  const [description, setDescription] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  async function handleCreate() {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'El título es obligatorio';
    if (!startAt)      errs.startAt = 'La fecha de inicio es obligatoria';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!profile) { Alert.alert('Error', 'No se encontró tu perfil.'); return; }

    setErrors({});
    setLoading(true);
    try {
      await createCalendarEvent({
        title:                  title.trim(),
        event_type:             eventType,
        start_at:               new Date(startAt).toISOString(),
        end_at:                 hasEnd ? new Date(endAt).toISOString() : null,
        description:            description.trim() || null,
        created_by_profile_id:  profile.id,
      });
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
});

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme,
  RefreshControl, Alert, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { EmptyView } from '@/components/ui/empty-view';
import { useAuthStore } from '@/store';
import { getAthleteByEmail, getAthleteByProfileId } from '@/services/athletes';
import {
  listTrainingSessions,
  createTrainingSession,
  type TrainingSession,
} from '@/services/training';

// ---------------------------------------------------------------------------
// Session card
// ---------------------------------------------------------------------------

function SessionCard({ session }: { session: TrainingSession }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const date = new Date(session.session_date).toLocaleDateString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

  const duration =
    session.start_time && session.end_time
      ? `${session.start_time} – ${session.end_time}`
      : session.start_time ?? null;

  return (
    <Card style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <View style={[styles.sessionIcon, { backgroundColor: PRIMARY + '18' }]}>
          <Ionicons name="barbell-outline" size={18} color={PRIMARY} />
        </View>
        <View style={styles.sessionMeta}>
          <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
            {session.title}
          </Text>
          <Text style={[styles.sessionDate, { color: colors.icon }]}>{date}</Text>
        </View>
      </View>

      {(duration || session.location) && (
        <View style={styles.sessionDetails}>
          {duration && (
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={13} color={colors.icon} />
              <Text style={[styles.detailText, { color: colors.icon }]}>{duration}</Text>
            </View>
          )}
          {session.location && (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={13} color={colors.icon} />
              <Text style={[styles.detailText, { color: colors.icon }]}>{session.location}</Text>
            </View>
          )}
        </View>
      )}

      {session.notes && (
        <Text style={[styles.sessionNotes, { color: colors.icon }]} numberOfLines={3}>
          {session.notes}
        </Text>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// New session form (inline)
// ---------------------------------------------------------------------------

type FormState = {
  title: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
};

const todayISO = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// DateField — accesible date selector sin dependencias extra
// Muestra la fecha en formato largo y permite navegar ±1 día.
// ---------------------------------------------------------------------------

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function parseISO(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function formatLong(iso: string): string {
  const d = parseISO(iso);
  if (!d) return 'Fecha inválida';
  return `${DAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

function shiftDay(iso: string, delta: number): string {
  const d = parseISO(iso) ?? new Date();
  d.setDate(d.getDate() + delta);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

type DateFieldProps = {
  value: string;
  onChange: (iso: string) => void;
  error?: string;
};

function DateField({ value, onChange, error }: DateFieldProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const isValid = parseISO(value) !== null;

  return (
    <View style={styles.fieldWrapper}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>Fecha *</Text>

      {/* Navigation row */}
      <View style={[
        styles.dateRow,
        {
          backgroundColor: scheme === 'dark' ? '#1e2022' : '#f8fafc',
          borderColor: error ? '#dc2626' : scheme === 'dark' ? '#374151' : '#e2e8f0',
        },
      ]}>
        {/* Previous day */}
        <TouchableOpacity
          onPress={() => onChange(shiftDay(value, -1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.dateBtnWrap}
        >
          <Ionicons name="chevron-back" size={20} color={PRIMARY} />
        </TouchableOpacity>

        {/* Date display — tapping it resets to today */}
        <TouchableOpacity
          style={styles.dateLabelWrap}
          onPress={() => onChange(todayISO)}
          hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
        >
          <Text style={[styles.dateISO, { color: isValid ? colors.text : '#dc2626' }]}>
            {value || '—'}
          </Text>
          <Text style={[styles.dateLong, { color: isValid ? colors.icon : '#dc2626' }]}>
            {isValid ? formatLong(value) : 'Formato inválido (usa AAAA-MM-DD)'}
          </Text>
        </TouchableOpacity>

        {/* Next day */}
        <TouchableOpacity
          onPress={() => onChange(shiftDay(value, +1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.dateBtnWrap}
        >
          <Ionicons name="chevron-forward" size={20} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.fieldError}>{error}</Text>}
      <Text style={[styles.dateHint, { color: colors.icon }]}>
        Toca la fecha para volver a hoy
      </Text>
    </View>
  );
}

function NewSessionForm({
  athleteId,
  onSaved,
  onCancel,
}: {
  athleteId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { profile } = useAuthStore();

  const [form, setForm] = useState<FormState>({
    title: '',
    session_date: todayISO,
    start_time: '',
    end_time: '',
    location: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  async function handleSave() {
    const errs: Partial<FormState> = {};
    if (!form.title.trim()) errs.title = 'El título es obligatorio';
    if (!form.session_date) errs.session_date = 'La fecha es obligatoria';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    if (!profile) {
      Alert.alert('Error', 'No se encontró tu perfil de usuario.');
      return;
    }
    setSaving(true);
    try {
      await createTrainingSession({
        athlete_id: athleteId,
        coach_profile_id: profile.id,
        title: form.title.trim(),
        session_date: form.session_date,
        start_time: form.start_time || undefined,
        end_time: form.end_time || undefined,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      onSaved();
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : (e as { message?: string })?.message ?? 'No se pudo guardar la sesión';
      Alert.alert('Error al guardar', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={styles.formCard}>
      <Text style={[styles.formTitle, { color: colors.text }]}>Nueva sesión</Text>

      <Input
        label="Título *"
        placeholder="Ej. Entrenamiento de fuerza"
        value={form.title}
        onChangeText={(v) => set('title', v)}
        error={errors.title}
      />

      {/* Date field */}
      <DateField
        value={form.session_date}
        onChange={(v) => set('session_date', v)}
        error={errors.session_date}
      />

      {/* Time row */}
      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <Input
            label="Hora inicio"
            placeholder="08:00"
            value={form.start_time}
            onChangeText={(v) => set('start_time', v)}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.timeSep} />
        <View style={styles.timeField}>
          <Input
            label="Hora fin"
            placeholder="09:30"
            value={form.end_time}
            onChangeText={(v) => set('end_time', v)}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      <Input
        label="Lugar"
        placeholder="Ej. Gimnasio principal"
        value={form.location}
        onChangeText={(v) => set('location', v)}
      />

      <Input
        label="Notas / Observaciones"
        placeholder="Describe el entrenamiento, cómo te sentiste..."
        value={form.notes}
        onChangeText={(v) => set('notes', v)}
        multiline
        numberOfLines={4}
        style={{ height: 90, textAlignVertical: 'top' }}
      />

      <View style={styles.formActions}>
        <Button
          label="Guardar sesión"
          onPress={handleSave}
          loading={saving}
          style={styles.saveBtn}
        />
        <Button
          label="Cancelar"
          onPress={onCancel}
          variant="secondary"
          style={styles.cancelBtn}
        />
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function TrainingScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { profile } = useAuthStore();

  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function loadData(refresh = false) {
    if (!profile) { setLoading(false); return; }
    try {
      // Resolve athlete ID from profile on first load.
      // Primary: match by email (requires athletes.email set in admin).
      // Fallback: match by profile_id (legacy explicit link).
      let aId = athleteId;
      if (!aId) {
        const email = profile.email;
        if (email) {
          const byEmail = await getAthleteByEmail(email);
          aId = byEmail?.id ?? null;
        }
        if (!aId) {
          const byProfile = await getAthleteByProfileId(profile.id);
          aId = byProfile?.id ?? null;
        }
        setAthleteId(aId);
      }
      if (!aId) { setLoading(false); return; }
      const data = await listTrainingSessions(aId);
      setSessions(data);
    } catch (e) {
      console.warn('[training] load error', e);
    } finally {
      setLoading(false);
      if (refresh) setRefreshing(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [profile?.id]);

  const onRefresh = () => { setRefreshing(true); loadData(true); };

  const handleSaved = () => {
    setShowForm(false);
    setLoading(true);
    loadData();
  };

  if (loading) return <Loading fullScreen />;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* New session form (shown inline when tapping +) */}
        {showForm && athleteId ? (
          <NewSessionForm
            athleteId={athleteId}
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          /* Quick-add button when list is visible */
          !showForm && (
            <TouchableOpacity
              onPress={() => setShowForm(true)}
              style={[styles.addBtn, { backgroundColor: PRIMARY }]}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Registrar sesión de entrenamiento</Text>
            </TouchableOpacity>
          )
        )}

        {/* Session list */}
        {!athleteId ? (
          <EmptyView
            title="Perfil de atleta no encontrado"
            subtitle="Solicita al administrador que vincule tu usuario a un expediente de atleta."
          />
        ) : sessions.length === 0 && !showForm ? (
          <EmptyView
            title="Sin sesiones registradas"
            subtitle="Registra tu primera sesión de entrenamiento con el botón de arriba."
          />
        ) : (
          sessions.map((s) => <SessionCard key={s.id} session={s} />)
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, paddingBottom: 40 },

  // Add button
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, padding: 14, marginBottom: 16, gap: 8,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Session card
  sessionCard: { marginBottom: 12 },
  sessionHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  sessionIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  sessionMeta: { flex: 1 },
  sessionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  sessionDate: { fontSize: 12 },
  sessionDetails: { gap: 4, marginBottom: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 12 },
  sessionNotes: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },

  // New session form
  formCard: { marginBottom: 16 },
  formTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14 },

  // Date field
  fieldWrapper: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 10, overflow: 'hidden',
  },
  dateBtnWrap: { paddingHorizontal: 12, paddingVertical: 12 },
  dateLabelWrap: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  dateISO: { fontSize: 15, fontWeight: '600' },
  dateLong: { fontSize: 11, marginTop: 2 },
  dateHint: { fontSize: 10, marginTop: 4, textAlign: 'center' },
  fieldError: { marginTop: 4, fontSize: 12, color: '#dc2626' },

  // Time row
  timeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  timeField: { flex: 1 },
  timeSep: { width: 12 },

  // Form actions
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  saveBtn: { flex: 1 },
  cancelBtn: { flex: 1 },
});

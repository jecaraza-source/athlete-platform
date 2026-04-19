import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme,
  RefreshControl, Alert, TouchableOpacity,
  KeyboardAvoidingView, Platform, Modal, FlatList, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Colors, PRIMARY } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { EmptyView } from '@/components/ui/empty-view';
import { useAuthStore } from '@/store';
import { listAthletes } from '@/services/athletes';
import { notifyProfiles } from '@/services/notifications';
import {
  listTrainingSessions,
  createTrainingSession,
  updateSessionFeedback,
  type TrainingSession,
} from '@/services/training';
import {
  uploadSessionFile,
  formatFileSize,
  type UploadableFile,
} from '@/services/attachments';

// ---------------------------------------------------------------------------
// Session card
// ---------------------------------------------------------------------------

function SessionCard({
  session,
  isAthlete,
  isStaff,
  athleteProfileId,
}: {
  session: TrainingSession;
  isAthlete?: boolean;
  /** Show athlete comment to coach and allow push reply */
  isStaff?: boolean;
  athleteProfileId?: string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  // Athlete feedback local state (optimistic)
  const [isDone,        setIsDone]        = useState(session.is_done ?? false);
  const [showComment,   setShowComment]   = useState(false);
  const [editComment,   setEditComment]   = useState(session.athlete_comment ?? '');
  const [savingComment, setSavingComment] = useState(false);
  // Coach reply state
  const [showReply,    setShowReply]    = useState(false);
  const [replyText,    setReplyText]    = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const date = new Date(session.session_date).toLocaleDateString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

  const duration =
    session.start_time && session.end_time
      ? `${session.start_time} – ${session.end_time}`
      : session.start_time ?? null;

  async function toggleDone() {
    const next = !isDone;
    setIsDone(next); // optimistic
    updateSessionFeedback(session.id, { is_done: next })
      .catch(() => setIsDone(!next)); // revert on error
  }

  async function sendReply() {
    if (!replyText.trim() || !athleteProfileId) return;
    setSendingReply(true);
    try {
      await notifyProfiles([athleteProfileId], {
        notifyPush:     true,
        notifyEmail:    false,
        entityType:     'training',
        entityId:       session.id,
        pushTitle:      `Respuesta del entrenador: ${session.title}`,
        pushMessage:    replyText.trim(),
        emailSubject:   `Respuesta a tu sesión: ${session.title}`,
        emailHtmlBody:  `<p>El entrenador respondió a tu sesión <strong>${session.title}</strong>: ${replyText.trim()}</p>`,
        emailPlainBody: replyText.trim(),
      });
      setReplyText('');
      setShowReply(false);
      Alert.alert('Enviado', 'Respuesta enviada al atleta.');
    } catch {
      Alert.alert('Error', 'No se pudo enviar la notificación.');
    } finally {
      setSendingReply(false);
    }
  }

  async function saveComment() {
    setSavingComment(true);
    try {
      await updateSessionFeedback(session.id, { athlete_comment: editComment.trim() || null });
      setShowComment(false);
    } catch {
      Alert.alert('Error', 'No se pudo guardar el comentario.');
    } finally {
      setSavingComment(false);
    }
  }

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
        {isDone && (
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark-circle" size={13} color="#15803d" />
            <Text style={styles.doneBadgeText}>Hecho</Text>
          </View>
        )}
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

      {/* Coach view: athlete's comment + reply */}
      {isStaff && session.athlete_comment && (
        <View style={[styles.staffCommentBox, { borderLeftColor: PRIMARY, backgroundColor: PRIMARY + '08' }]}>
          <View style={styles.staffCommentHeader}>
            <Ionicons name="chatbubble-outline" size={13} color={PRIMARY} />
            <Text style={[styles.staffCommentLabel, { color: PRIMARY }]}>Comentario del atleta</Text>
          </View>
          <Text style={[styles.staffCommentText, { color: colors.text }]}>
            {session.athlete_comment}
          </Text>
          {athleteProfileId && (
            <TouchableOpacity
              onPress={() => { setShowReply((v) => !v); setReplyText(''); }}
              style={styles.replyBtn}
            >
              <Ionicons name={showReply ? 'close-outline' : 'send-outline'} size={13} color={PRIMARY} />
              <Text style={[styles.replyBtnText, { color: PRIMARY }]}>
                {showReply ? 'Cancelar' : 'Responder'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Coach reply editor */}
      {isStaff && showReply && athleteProfileId && (
        <View style={styles.replyEditor}>
          <TextInput
            style={[styles.replyInput, {
              color: colors.text,
              borderColor: scheme === 'dark' ? '#374151' : '#e2e8f0',
              backgroundColor: scheme === 'dark' ? '#1e2022' : '#f8fafc',
            }]}
            placeholder="Escribe tu respuesta..."
            placeholderTextColor={colors.icon}
            value={replyText}
            onChangeText={setReplyText}
            multiline
            numberOfLines={2}
            autoFocus
          />
          <TouchableOpacity
            onPress={sendReply}
            disabled={sendingReply || !replyText.trim()}
            style={[
              styles.replySendBtn,
              { backgroundColor: PRIMARY, opacity: (!replyText.trim() || sendingReply) ? 0.5 : 1 },
            ]}
          >
            <Ionicons name="send-outline" size={14} color="#fff" />
            <Text style={styles.replySendBtnText}>
              {sendingReply ? 'Enviando…' : 'Enviar push'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Saved comment preview (athlete) */}
      {isAthlete && (session.athlete_comment || editComment) && !showComment && (
        <View style={[styles.commentPreview, { backgroundColor: PRIMARY + '10' }]}>
          <Ionicons name="chatbubble-outline" size={13} color={PRIMARY} style={{ marginRight: 6 }} />
          <Text style={[styles.commentPreviewText, { color: colors.text }]} numberOfLines={2}>
            {session.athlete_comment ?? editComment}
          </Text>
        </View>
      )}

      {/* Athlete action buttons */}
      {isAthlete && (
        <View style={styles.athleteActions}>
          <TouchableOpacity
            onPress={() => { setShowComment((v) => !v); if (!showComment) setEditComment(session.athlete_comment ?? ''); }}
            style={[
              styles.athleteBtn,
              { backgroundColor: showComment ? PRIMARY + '18' : (scheme === 'dark' ? '#374151' : '#f1f5f9') },
            ]}
            activeOpacity={0.75}
          >
            <Ionicons name="chatbubble-outline" size={14} color={showComment ? PRIMARY : colors.icon} />
            <Text style={[styles.athleteBtnText, { color: showComment ? PRIMARY : colors.icon }]}>Comentario</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleDone}
            style={[
              styles.athleteBtn,
              { backgroundColor: isDone ? '#dcfce7' : (scheme === 'dark' ? '#374151' : '#f1f5f9') },
            ]}
            activeOpacity={0.75}
          >
            <Ionicons
              name={isDone ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={14}
              color={isDone ? '#15803d' : colors.icon}
            />
            <Text style={[styles.athleteBtnText, { color: isDone ? '#15803d' : colors.icon }]}>
              {isDone ? '¡Hecho!' : 'Hecho'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Inline comment editor */}
      {isAthlete && showComment && (
        <View style={styles.commentEditor}>
          <TextInput
            style={[styles.commentInput, {
              color: colors.text,
              borderColor: scheme === 'dark' ? '#374151' : '#e2e8f0',
              backgroundColor: scheme === 'dark' ? '#1e2022' : '#f8fafc',
            }]}
            placeholder="Tu comentario sobre esta sesión..."
            placeholderTextColor={colors.icon}
            value={editComment}
            onChangeText={setEditComment}
            multiline
            numberOfLines={3}
          />
          <View style={styles.commentEditorActions}>
            <TouchableOpacity onPress={() => setShowComment(false)} style={styles.commentCancelBtn}>
              <Text style={[styles.commentCancelText, { color: colors.icon }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={saveComment}
              disabled={savingComment}
              style={[styles.commentSaveBtn, { backgroundColor: PRIMARY }]}
            >
              <Text style={styles.commentSaveText}>
                {savingComment ? 'Guardando…' : 'Guardar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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

// ---------------------------------------------------------------------------
// FileChip — shows a pending attachment with a remove button
// ---------------------------------------------------------------------------

function FileChip({
  file, onRemove,
}: {
  file: UploadableFile;
  onRemove: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const isImage = file.mimeType.startsWith('image/');

  return (
    <View style={[
      styles.fileChip,
      { backgroundColor: scheme === 'dark' ? '#1e2022' : '#f1f5f9', borderColor: scheme === 'dark' ? '#374151' : '#e2e8f0' },
    ]}>
      <Ionicons
        name={isImage ? 'image-outline' : 'document-outline'}
        size={14}
        color={PRIMARY}
        style={{ marginRight: 5 }}
      />
      <Text style={[styles.fileChipName, { color: colors.text }]} numberOfLines={1}>
        {file.name}
      </Text>
      {!!file.size && (
        <Text style={[styles.fileChipSize, { color: colors.icon }]}>
          {' '}({formatFileSize(file.size)})
        </Text>
      )}
      <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 6 }}>
        <Ionicons name="close-circle" size={16} color={colors.icon} />
      </TouchableOpacity>
    </View>
  );
}

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
  athleteProfileId,
  isStaff,
  onSaved,
  onCancel,
}: {
  athleteId: string;
  /** profiles.id of the athlete — used to send push/email notifications. */
  athleteProfileId?: string;
  /** When true, shows notification toggles. */
  isStaff?: boolean;
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
  const [saving,       setSaving]       = useState(false);
  const [errors,       setErrors]       = useState<Partial<FormState>>({});
  const [pendingFiles, setPendingFiles] = useState<UploadableFile[]>([]);
  const [notifyPush,   setNotifyPush]   = useState(false);
  const [notifyEmail,  setNotifyEmail]  = useState(false);

  // ── File pickers ────────────────────────────────────────────────────────
  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Se necesita acceso a la galería para adjuntar fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const newFiles: UploadableFile[] = result.assets.map((asset) => {
      const ext  = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const name = asset.fileName ?? `foto_${Date.now()}.${ext}`;
      const mime = asset.mimeType ?? (ext === 'jpg' ? 'image/jpeg' : `image/${ext}`);
      return { uri: asset.uri, name, mimeType: mime, size: asset.fileSize ?? null };
    });
    setPendingFiles((prev) => [...prev, ...newFiles]);
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['*/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const newFiles: UploadableFile[] = result.assets.map((asset) => ({
      uri:      asset.uri,
      name:     asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size:     asset.size ?? null,
    }));
    setPendingFiles((prev) => [...prev, ...newFiles]);
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

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
      const session = await createTrainingSession({
        athlete_id: athleteId,
        // The DB column is NOT NULL, so we pass the athlete's own profile ID.
        // Self-registered sessions by athletes will have their own profile as
        // coach_profile_id; staff-created sessions override this in the back-office.
        coach_profile_id: profile.id,
        title: form.title.trim(),
        session_date: form.session_date,
        start_time: form.start_time || undefined,
        end_time: form.end_time || undefined,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });

      // Upload any pending attachments linked to the new session
      if (pendingFiles.length > 0) {
        const results = await Promise.all(
          pendingFiles.map((f) => uploadSessionFile(f, athleteId, session.id))
        );
        const failed = results.filter((r) => !r.ok).length;
        if (failed > 0) {
          Alert.alert(
            'Sesión guardada',
            `${failed} archivo${failed > 1 ? 's' : ''} no se pudo${failed > 1 ? 'ieron' : ''} subir. Intenta adjuntarlos nuevamente.`,
          );
        }
      }

      // Fire-and-forget push/email notification to the athlete
      if ((notifyPush || notifyEmail) && athleteProfileId) {
        notifyProfiles([athleteProfileId], {
          notifyPush,
          notifyEmail,
          entityType:     'training',
          entityId:       session.id,
          pushTitle:      `Sesión registrada: ${form.title.trim()}`,
          pushMessage:    `Entrenamiento del ${form.session_date}${form.location.trim() ? ' en ' + form.location.trim() : ''}`,
          emailSubject:   `Nueva sesión: ${form.title.trim()}`,
          emailHtmlBody:  `<p>Se registró la sesión <strong>${form.title.trim()}</strong> para el <strong>${form.session_date}</strong>${form.location.trim() ? ' en ' + form.location.trim() : ''}.</p>`,
          emailPlainBody: `Nueva sesión: ${form.title.trim()} - ${form.session_date}${form.location.trim() ? ' en ' + form.location.trim() : ''}.`,
        }).catch((e) => console.warn('[training] notify error:', e));
      }

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

      {/* ── Adjuntar archivos ─────────────────────────────────────────── */}
      <View style={styles.fieldWrapper}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>Adjuntar archivos</Text>
        <View style={styles.attachRow}>
          <TouchableOpacity
            style={[styles.attachBtn, { borderColor: PRIMARY + '60', backgroundColor: PRIMARY + '10' }]}
            onPress={pickFromGallery}
            disabled={saving}
          >
            <Ionicons name="images-outline" size={16} color={PRIMARY} />
            <Text style={[styles.attachBtnText, { color: PRIMARY }]}>Galería</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.attachBtn, { borderColor: PRIMARY + '60', backgroundColor: PRIMARY + '10' }]}
            onPress={pickDocument}
            disabled={saving}
          >
            <Ionicons name="document-attach-outline" size={16} color={PRIMARY} />
            <Text style={[styles.attachBtnText, { color: PRIMARY }]}>Documentos</Text>
          </TouchableOpacity>
        </View>

        {pendingFiles.length > 0 && (
          <View style={styles.fileList}>
            {pendingFiles.map((f, i) => (
              <FileChip key={`${f.name}-${i}`} file={f} onRemove={() => removeFile(i)} />
            ))}
          </View>
        )}
      </View>

      {/* Notification toggles — only for staff creating for an athlete */}
      {isStaff && athleteProfileId && (
        <View style={styles.fieldWrapper}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Notificaciones al atleta</Text>
          <TouchableOpacity
            onPress={() => setNotifyPush((v) => !v)}
            style={styles.notifRow}
            activeOpacity={0.7}
          >
            <View style={[styles.notifDot, { backgroundColor: notifyPush ? PRIMARY : colors.icon }]}>
              {notifyPush && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <Ionicons name="notifications-outline" size={15} color={notifyPush ? PRIMARY : colors.icon} style={{ marginLeft: 4, marginRight: 6 }} />
            <Text style={{ fontSize: 14, color: notifyPush ? colors.text : colors.icon }}>Push notification</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setNotifyEmail((v) => !v)}
            style={styles.notifRow}
            activeOpacity={0.7}
          >
            <View style={[styles.notifDot, { backgroundColor: notifyEmail ? PRIMARY : colors.icon }]}>
              {notifyEmail && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <Ionicons name="mail-outline" size={15} color={notifyEmail ? PRIMARY : colors.icon} style={{ marginLeft: 4, marginRight: 6 }} />
            <Text style={{ fontSize: 14, color: notifyEmail ? colors.text : colors.icon }}>Email</Text>
          </TouchableOpacity>
        </View>
      )}

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
  const storeAthleteId    = useAuthStore((s) => s.athleteId);
  // Use permissions instead of hardcoded role names so the superadmin can
  // grant/revoke these capabilities per role from the admin console.
  const canManageTraining = useAuthStore((s) => s.hasPermission('manage_training'));
  const canViewTraining   = useAuthStore((s) => s.hasPermission('view_training'));

  const [sessions,    setSessions]    = useState<TrainingSession[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [showForm,    setShowForm]    = useState(false);

  // Staff-only: athlete selection
  type AthleteOption = { id: string; first_name: string; last_name: string; profile_id: string | null };
  const [selectedAthleteId,      setSelectedAthleteId]      = useState<string | null>(null);
  const [selectedAthleteName,    setSelectedAthleteName]    = useState('');
  const [selectedAthleteProfileId, setSelectedAthleteProfileId] = useState<string | null>(null);
  const [athleteList,            setAthleteList]            = useState<AthleteOption[]>([]);
  const [athletePickerOpen,      setAthletePickerOpen]      = useState(false);
  const [athleteSearch,          setAthleteSearch]          = useState('');

  // Effective athlete: own ID for athletes; selected ID for staff (manage_training)
  const effectiveAthleteId = canManageTraining ? selectedAthleteId : storeAthleteId;

  const filteredAthletes = athleteSearch.trim()
    ? athleteList.filter((a) =>
        `${a.first_name} ${a.last_name}`.toLowerCase().includes(athleteSearch.toLowerCase())
      )
    : athleteList;

  // Load athlete list for staff users
  useEffect(() => {
    if (!canManageTraining) return;
    (async () => {
      try {
        const data = await listAthletes({ pageSize: 200 });
        setAthleteList(data.map((a) => ({ id: a.id, first_name: a.first_name, last_name: a.last_name, profile_id: a.profile_id })));
      } catch (e) {
        console.warn('[training] load athletes error', e);
      }
    })();
  }, [canManageTraining]);

  async function loadData(refresh = false) {
    if (!effectiveAthleteId) { setLoading(false); return; }
    if (!refresh) setLoading(true);
    try {
      const data = await listTrainingSessions(effectiveAthleteId);
      setSessions(data);
    } catch (e) {
      console.warn('[training] load error', e);
    } finally {
      setLoading(false);
      if (refresh) setRefreshing(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [effectiveAthleteId]);

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
        {/* Staff: athlete picker — shown when user has manage_training */}
        {canManageTraining && (
          <>
            <Text style={[styles.pickerLabel, { color: colors.text }]}>Atleta</Text>
            <TouchableOpacity
              onPress={() => setAthletePickerOpen(true)}
              style={[
                styles.pickerBtn,
                {
                  backgroundColor: scheme === 'dark' ? '#1e2022' : '#f8fafc',
                  borderColor: scheme === 'dark' ? '#374151' : '#e2e8f0',
                },
              ]}
            >
              <Ionicons name="person-outline" size={16} color={colors.icon} style={{ marginRight: 8 }} />
              <Text
                style={[styles.pickerBtnText, { color: selectedAthleteName ? colors.text : colors.icon }]}
                numberOfLines={1}
              >
                {selectedAthleteName || 'Seleccionar atleta...'}
              </Text>
              {selectedAthleteName ? (
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.icon}
                  onPress={() => {
                    setSelectedAthleteId(null);
                    setSelectedAthleteName('');
                    setSelectedAthleteProfileId(null);
                    setShowForm(false);
                    setSessions([]);
                  }}
                  // onPress is on the Ionicons, not the parent button,
                  // so no additional permission check needed here
                />
              ) : (
                <Ionicons name="chevron-down" size={18} color={colors.icon} />
              )}
            </TouchableOpacity>

            <Modal visible={athletePickerOpen} animationType="slide" presentationStyle="pageSheet">
              <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Seleccionar atleta</Text>
                  <TouchableOpacity onPress={() => { setAthletePickerOpen(false); setAthleteSearch(''); }}>
                    <Ionicons name="close" size={24} color={colors.icon} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.modalSearch, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#f1f5f9' }]}>
                  <Ionicons name="search-outline" size={16} color={colors.icon} style={{ marginRight: 6 }} />
                  <TextInput
                    style={[styles.modalSearchInput, { color: colors.text }]}
                    placeholder="Buscar atleta..."
                    placeholderTextColor={colors.icon}
                    value={athleteSearch}
                    onChangeText={setAthleteSearch}
                    autoFocus
                  />
                </View>
                <FlatList
                  data={filteredAthletes}
                  keyExtractor={(a) => a.id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const initials = `${item.first_name[0] ?? ''}${item.last_name[0] ?? ''}`.toUpperCase();
                    const isSelected = selectedAthleteId === item.id;
                    return (
                      <TouchableOpacity
                        style={[styles.staffRow, { borderBottomColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}
                  onPress={() => {
                          setSelectedAthleteId(item.id);
                          setSelectedAthleteName(`${item.first_name} ${item.last_name}`);
                          setSelectedAthleteProfileId(item.profile_id ?? null);
                          setSessions([]);
                          setAthletePickerOpen(false);
                          setAthleteSearch('');
                          setShowForm(false);
                        }}
                      >
                        <View style={[styles.staffAvatar, { backgroundColor: PRIMARY }]}>
                          <Text style={styles.staffInitials}>{initials}</Text>
                        </View>
                        <Text style={[styles.staffName, { color: colors.text }]}>
                          {item.first_name} {item.last_name}
                        </Text>
                        {isSelected && <Ionicons name="checkmark" size={18} color={PRIMARY} />}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={[styles.emptyText, { color: colors.icon }]}>Sin resultados</Text>
                  }
                />
              </View>
            </Modal>
          </>
        )}

        {/* New session form (shown inline when tapping +) */}
        {showForm && effectiveAthleteId ? (
          <NewSessionForm
            athleteId={effectiveAthleteId}
            athleteProfileId={canManageTraining ? (selectedAthleteProfileId ?? undefined) : undefined}
            isStaff={canManageTraining}
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          !showForm && effectiveAthleteId && (
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
        {!effectiveAthleteId ? (
          <EmptyView
          title={canManageTraining ? 'Selecciona un atleta' : 'Perfil de atleta no encontrado'}
            subtitle={
              canManageTraining
                ? 'Usa el selector de arriba para ver y registrar sesiones de entrenamiento.'
                : 'Solicita al administrador que vincule tu usuario a un expediente de atleta.'
            }
          />
        ) : sessions.length === 0 && !showForm ? (
          <EmptyView
            title="Sin sesiones registradas"
            subtitle="Registra la primera sesión de entrenamiento con el botón de arriba."
          />
        ) : (
          sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              isAthlete={canViewTraining && !canManageTraining}
              isStaff={canManageTraining}
              athleteProfileId={canManageTraining ? (selectedAthleteProfileId ?? undefined) : undefined}
            />
          ))
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
  sessionHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
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

  // Athlete feedback
  doneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#dcfce7', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
  },
  doneBadgeText: { fontSize: 11, color: '#15803d', fontWeight: '600' },
  commentPreview: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: 8, padding: 8, marginTop: 6,
  },
  commentPreviewText: { fontSize: 12, flex: 1, lineHeight: 17 },
  athleteActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  athleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 7, borderRadius: 8,
  },
  athleteBtnText: { fontSize: 12, fontWeight: '600' },
  commentEditor: { marginTop: 10 },
  commentInput: {
    borderWidth: 1, borderRadius: 8,
    padding: 10, fontSize: 13, minHeight: 70, textAlignVertical: 'top',
  },
  commentEditorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  commentCancelBtn: { paddingHorizontal: 12, paddingVertical: 7 },
  commentCancelText: { fontSize: 13 },
  commentSaveBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  commentSaveText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Coach: athlete comment display + reply
  staffCommentBox: {
    borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 8,
    borderRadius: 6, marginTop: 8,
  },
  staffCommentHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  staffCommentLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  staffCommentText:  { fontSize: 13, lineHeight: 18 },
  replyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },
  replyBtnText: { fontSize: 12, fontWeight: '600' },
  replyEditor: { marginTop: 8 },
  replyInput: {
    borderWidth: 1, borderRadius: 8,
    padding: 10, fontSize: 13, minHeight: 56, textAlignVertical: 'top',
  },
  replySendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 6, borderRadius: 8, paddingVertical: 9,
  },
  replySendBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

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

  // Attach buttons
  attachRow: { flexDirection: 'row', gap: 10 },
  attachBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  attachBtnText: { fontSize: 13, fontWeight: '600' },

  // File chip list
  fileList: { marginTop: 10, gap: 6 },
  fileChip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  fileChipName: { flex: 1, fontSize: 12 },
  fileChipSize: { fontSize: 11 },

  // Notification toggles inside NewSessionForm
  notifRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  notifDot: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },

  // Staff athlete picker
  pickerLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  pickerBtn: {
    height: 48, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerBtnText: { fontSize: 15, flex: 1 },
  modalContainer: { flex: 1, paddingTop: 12 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalSearch: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 10,
    borderRadius: 10, paddingHorizontal: 12, height: 40,
  },
  modalSearchInput: { flex: 1, fontSize: 14 },
  staffRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  staffAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  staffInitials: { color: '#fff', fontSize: 13, fontWeight: '700' },
  staffName: { flex: 1, fontSize: 15 },
  emptyText: { textAlign: 'center', padding: 24, fontSize: 14 },
});

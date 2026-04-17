import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Colors, PRIMARY, SectionColors, StatusColors } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { getAthlete } from '@/services/athletes';
import {
  getDiagnostic, getDiagnosticSections, upsertDiagnostic, updateSectionStatus,
} from '@/services/diagnostic';
import { listTrainingSessions, type TrainingSession } from '@/services/training';
import {
  listMedicalCases, listNutritionPlans, listPhysioCases, listPsychologyCases,
  type MedicalCase, type NutritionPlan, type PhysioCase, type PsychologyCase,
} from '@/services/follow-up';
import {
  listAthleteAttachments, uploadAthleteAttachment, type AthleteAttachment,
} from '@/services/attachments';
import { AttachmentItem } from '@/components/attachments/attachment-item';
import { useAuthStore } from '@/store';
import type { Athlete, AthleteInitialDiagnostic, AthleteSection, DiagnosticStatus, DiagnosticSectionKey } from '@/types';
import { SECTION_LABELS, DIAGNOSTIC_STATUS_LABELS, SECTION_KEYS, ATHLETE_STATUS_LABELS } from '@/types';

// ── Helpers para mostrar valores legibles ───────────────────────────────────
function labelSex(sex: string | null): string | null {
  if (!sex) return null;
  const map: Record<string, string> = {
    male: 'Masculino', m: 'Masculino',
    female: 'Femenino', f: 'Femenino',
  };
  return map[sex.toLowerCase()] ?? sex;
}
function labelSide(side: string | null): string | null {
  if (!side) return null;
  const map: Record<string, string> = {
    right: 'Derecho', left: 'Izquierdo', both: 'Ambos',
  };
  return map[side.toLowerCase()] ?? side;
}
function labelDisability(d: string | null): string | null {
  if (!d) return null;
  return d === 'con_discapacidad' ? 'Con discapacidad' : 'Sin discapacidad';
}

type ThemeColors = { text: string; icon: string };

// Fila de tabla clave–valor (reutilizable en todas las secciones)
function InfoRow({
  label, value, colors,
}: {
  label: string;
  value: string | number | null | undefined;
  colors: ThemeColors;
}) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.icon }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{String(value)}</Text>
    </View>
  );
}

// Bloque con título de sección + filas
function InfoSection({
  title, children, borderColor,
}: {
  title: string;
  children: React.ReactNode;
  borderColor: string;
}) {
  return (
    <View style={[styles.infoSection, { borderLeftColor: borderColor }]}>
      <Text style={[styles.infoSectionTitle, { color: borderColor }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function AthleteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [diagnostic, setDiagnostic] = useState<AthleteInitialDiagnostic | null>(null);
  const [sections, setSections] = useState<AthleteSection[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
  const [medicalCases, setMedicalCases] = useState<MedicalCase[]>([]);
  const [nutritionPlans, setNutritionPlans] = useState<NutritionPlan[]>([]);
  const [physioCases, setPhysioCases] = useState<PhysioCase[]>([]);
  const [psychCases, setPsychCases] = useState<PsychologyCase[]>([]);
  const [attachments, setAttachments] = useState<AthleteAttachment[]>([]); 
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'diagnostic' | 'seguimiento'>('info');

  const isStaffUser = useAuthStore((s) =>
    s.roles.some((r) => ['super_admin', 'admin', 'coach', 'staff', 'program_director'].includes(r.code))
  );

  // Track which section is being edited (null = none)
  const [editingSection, setEditingSection] = useState<DiagnosticSectionKey | null>(null);
  const [savingSection,  setSavingSection]  = useState(false);

  async function handleSectionStatus(section: DiagnosticSectionKey, newStatus: DiagnosticStatus) {
    if (!athlete) return;
    setSavingSection(true);
    try {
      // Ensure a diagnostic record exists
      let diag = diagnostic;
      if (!diag) {
        diag = await upsertDiagnostic(athlete.id);
        if (diag) setDiagnostic(diag);
      }
      if (!diag) {
        Alert.alert('Error', 'No se pudo crear el diagnóstico.');
        return;
      }

      const ok = await updateSectionStatus(diag.id, athlete.id, section, newStatus);
      if (ok) {
        // Refresh diagnostic + sections
        const [updatedDiag, updatedSecs] = await Promise.all([
          getDiagnostic(athlete.id),
          getDiagnosticSections(diag.id),
        ]);
        if (updatedDiag) setDiagnostic(updatedDiag);
        setSections(updatedSecs);
        setEditingSection(null);
      } else {
        Alert.alert('Error', 'No se pudo actualizar el estado.');
      }
    } finally {
      setSavingSection(false);
    }
  }

  async function handleAddImage() {
    if (!athlete) return;
    // Lazy-load expo-image-picker
    let ImagePicker: typeof import('expo-image-picker');
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ImagePicker = require('expo-image-picker');
    } catch {
      Alert.alert('Error', 'expo-image-picker no está disponible.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería para agregar imágenes.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingDoc(true);
    const { ok, error } = await uploadAthleteAttachment(result.assets[0], athlete.id, 'seguimiento');
    setUploadingDoc(false);

    if (ok) {
      // Refresh attachments list
      const updated = await listAthleteAttachments(athlete.id);
      setAttachments(updated);
    } else {
      Alert.alert('Error al subir imagen', error ?? 'No se pudo subir la imagen.');
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const a = await getAthlete(id);
        setAthlete(a);
        if (a) {
          const [diag, sessions, medical, plans, physio, psych, docs] = await Promise.all([
            getDiagnostic(a.id),
            listTrainingSessions(a.id),
            listMedicalCases(a.id),
            listNutritionPlans(a.id),
            listPhysioCases(a.id),
            listPsychologyCases(a.id),
            listAthleteAttachments(a.id),
          ]);
          setDiagnostic(diag);
          setTrainingSessions(sessions);
          setMedicalCases(medical);
          setNutritionPlans(plans);
          setPhysioCases(physio);
          setPsychCases(psych);
          setAttachments(docs);
          if (diag) {
            const secs = await getDiagnosticSections(diag.id);
            setSections(secs);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Loading fullScreen />;
  if (!athlete) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, textAlign: 'center', marginTop: 40 }}>
          Atleta no encontrado
        </Text>
      </SafeAreaView>
    );
  }

  const initials = `${athlete.first_name[0] ?? ''}${athlete.last_name[0] ?? ''}`.toUpperCase();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: PRIMARY }]}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>
            {athlete.first_name} {athlete.last_name}
          </Text>
          {athlete.status && (
            <Text style={[styles.status, { color: colors.icon }]}>
              {ATHLETE_STATUS_LABELS[athlete.status] ?? athlete.status}
            </Text>
          )}
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { borderBottomColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}>
          {(['info', 'diagnostic', 'seguimiento'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === tab ? PRIMARY : colors.icon },
              ]}>
                {tab === 'info' ? 'Información' : tab === 'diagnostic' ? 'Diagnóstico' : 'Seguimiento'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info tab */}
        {activeTab === 'info' && (
          <>
            {/* General */}
            <Card style={styles.card}>
              <InfoSection title="Información general" borderColor="#0a7ea4">
                <InfoRow label="Código" value={athlete.athlete_code} colors={colors} />
                <InfoRow label="Disciplina" value={athlete.discipline} colors={colors} />
                <InfoRow label="Discapacidad" value={labelDisability(athlete.disability_status)} colors={colors} />
                <InfoRow label="Correo" value={athlete.email} colors={colors} />
              </InfoSection>
            </Card>

            {/* Datos personales */}
            <Card style={styles.card}>
              <InfoSection title="Datos personales" borderColor="#7c3aed">
                <InfoRow label="Fecha de nacimiento" value={athlete.date_of_birth} colors={colors} />
                <InfoRow label="Sexo" value={labelSex(athlete.sex)} colors={colors} />
                <InfoRow label="Escuela / Club" value={athlete.school_or_club} colors={colors} />
              </InfoSection>
            </Card>

            {/* Datos físicos */}
            {(athlete.height_cm || athlete.weight_kg || athlete.dominant_side) && (
              <Card style={styles.card}>
                <InfoSection title="Datos físicos" borderColor="#15803d">
                  <InfoRow
                    label="Altura"
                    value={athlete.height_cm ? `${athlete.height_cm} cm` : null}
                    colors={colors}
                  />
                  <InfoRow
                    label="Peso"
                    value={athlete.weight_kg ? `${athlete.weight_kg} kg` : null}
                    colors={colors}
                  />
                  <InfoRow label="Lado dominante" value={labelSide(athlete.dominant_side)} colors={colors} />
                </InfoSection>
              </Card>
            )}

            {/* Tutor */}
            {(athlete.guardian_name || athlete.guardian_phone || athlete.guardian_email) && (
              <Card style={styles.card}>
                <InfoSection title="Tutor / Responsable" borderColor="#b45309">
                  <InfoRow label="Nombre" value={athlete.guardian_name} colors={colors} />
                  <InfoRow label="Teléfono" value={athlete.guardian_phone} colors={colors} />
                  <InfoRow label="Correo" value={athlete.guardian_email} colors={colors} />
                </InfoSection>
              </Card>
            )}

            {/* Contacto de emergencia */}
            {(athlete.emergency_contact_name || athlete.emergency_contact_phone) && (
              <Card style={styles.card}>
                <InfoSection title="Contacto de emergencia" borderColor="#dc2626">
                  <InfoRow label="Nombre" value={athlete.emergency_contact_name} colors={colors} />
                  <InfoRow label="Teléfono" value={athlete.emergency_contact_phone} colors={colors} />
                </InfoSection>
              </Card>
            )}

            {/* Notas médicas */}
            {athlete.medical_notes_summary && (
              <Card style={styles.card}>
                <InfoSection title="Notas médicas" borderColor="#be123c">
                  <Text style={[styles.notesText, { color: colors.text }]}>
                    {athlete.medical_notes_summary}
                  </Text>
                </InfoSection>
              </Card>
            )}
          </>
        )}

        {/* Seguimiento tab */}
        {activeTab === 'seguimiento' && (
          <>
            {/* Entrenamiento */}
            <Text style={[styles.sectionsTitle, { color: colors.text }]}>
              Entrenamiento ({trainingSessions.length})
            </Text>
            {trainingSessions.length === 0 ? (
              <Card><Text style={{ color: colors.icon, fontSize: 14 }}>Sin sesiones registradas.</Text></Card>
            ) : (
              trainingSessions.slice(0, 10).map((s) => (
                <Card key={s.id} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <View style={[styles.sessionIcon, { backgroundColor: PRIMARY + '18' }]}>
                      <Ionicons name="barbell-outline" size={16} color={PRIMARY} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                        {s.title}
                      </Text>
                      <Text style={[styles.sessionDate, { color: colors.icon }]}>
                        {new Date(s.session_date).toLocaleDateString('es-MX', {
                          weekday: 'short', day: '2-digit', month: 'short',
                        })}
                        {s.location ? ` • ${s.location}` : ''}
                      </Text>
                    </View>
                  </View>
                  {s.notes && (
                    <Text style={[styles.sessionNotes, { color: colors.icon }]} numberOfLines={2}>
                      {s.notes}
                    </Text>
                  )}
                </Card>
              ))
            )}

            {/* Nutrición */}
            <Text style={[styles.sectionsTitle, { color: colors.text, marginTop: 16 }]}>
              Nutrición ({nutritionPlans.length})
            </Text>
            {nutritionPlans.length === 0 ? (
              <Card><Text style={{ color: colors.icon, fontSize: 14 }}>Sin planes de nutrición.</Text></Card>
            ) : (
              nutritionPlans.map((p) => (
                <Card key={p.id} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <View style={[styles.sessionIcon, { backgroundColor: '#dcfce718' }]}>
                      <Ionicons name="nutrition-outline" size={16} color="#15803d" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                        {p.title}
                      </Text>
                      <Text style={[styles.sessionDate, { color: colors.icon }]}>
                        {new Date(p.start_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {p.end_date ? ` – ${new Date(p.end_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}` : ' (en curso)'}
                      </Text>
                    </View>
                    <View style={[styles.statusTag, { backgroundColor: '#f0fdf4' }]}>
                      <Text style={{ fontSize: 10, color: '#15803d', fontWeight: '600' }}>{p.status}</Text>
                    </View>
                  </View>
                </Card>
              ))
            )}

            {/* Servicios Médicos */}
            <Text style={[styles.sectionsTitle, { color: colors.text, marginTop: 16 }]}>
              Servicios Médicos ({medicalCases.length})
            </Text>
            {medicalCases.length === 0 ? (
              <Card><Text style={{ color: colors.icon, fontSize: 14 }}>Sin casos médicos.</Text></Card>
            ) : (
              medicalCases.map((c) => (
                <Card key={c.id} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <View style={[styles.sessionIcon, { backgroundColor: '#fff1f2' }]}>
                      <Ionicons name="medical-outline" size={16} color="#be123c" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                        {c.condition ?? 'Caso médico'}
                      </Text>
                      <Text style={[styles.sessionDate, { color: colors.icon }]}>
                        Abierto {new Date(c.opened_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                      {c.notes && (
                        <Text style={[styles.sessionNotes, { color: colors.icon }]} numberOfLines={2}>
                          {c.notes}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.statusTag, { backgroundColor: '#fff1f2' }]}>
                      <Text style={{ fontSize: 10, color: '#be123c', fontWeight: '600' }}>{c.status}</Text>
                    </View>
                  </View>
                </Card>
              ))
            )}

            {/* Fisioterapia */}
            <Text style={[styles.sectionsTitle, { color: colors.text, marginTop: 16 }]}>
              Fisioterapia ({physioCases.length})
            </Text>
            {physioCases.length === 0 ? (
              <Card><Text style={{ color: colors.icon, fontSize: 14 }}>Sin casos de fisioterapia.</Text></Card>
            ) : (
              physioCases.map((c) => (
                <Card key={c.id} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <View style={[styles.sessionIcon, { backgroundColor: '#ffe4e6' }]}>
                      <Ionicons name="body-outline" size={16} color="#be123c" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                        {c.injuries?.[0]?.injury_type ?? 'Caso de fisioterapia'}
                      </Text>
                      <Text style={[styles.sessionDate, { color: colors.icon }]}>
                        Abierto {new Date(c.opened_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={[styles.statusTag, { backgroundColor: '#fff1f2' }]}>
                      <Text style={{ fontSize: 10, color: '#be123c', fontWeight: '600' }}>{c.status}</Text>
                    </View>
                  </View>
                </Card>
              ))
            )}

            {/* Psicología */}
            <Text style={[styles.sectionsTitle, { color: colors.text, marginTop: 16 }]}>
              Psicología ({psychCases.length})
            </Text>
            {psychCases.length === 0 ? (
              <Card><Text style={{ color: colors.icon, fontSize: 14 }}>Sin casos de psicología.</Text></Card>
            ) : (
              psychCases.map((c) => (
                <Card key={c.id} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <View style={[styles.sessionIcon, { backgroundColor: '#fef9c3' }]}>
                      <Ionicons name="happy-outline" size={16} color="#854d0e" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                        {c.summary ?? 'Caso de psicología'}
                      </Text>
                      <Text style={[styles.sessionDate, { color: colors.icon }]}>
                        Abierto {new Date(c.opened_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={[styles.statusTag, { backgroundColor: '#fefce8' }]}>
                      <Text style={{ fontSize: 10, color: '#854d0e', fontWeight: '600' }}>{c.status}</Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
            {/* Documentos adjuntos */}
            <View style={styles.docHeader}>
              <Text style={[styles.sectionsTitle, { color: colors.text }]}>
                Documentos ({attachments.length})
              </Text>
              {isStaffUser && (
                <TouchableOpacity
                  onPress={handleAddImage}
                  disabled={uploadingDoc}
                  style={[styles.addDocBtn, { backgroundColor: PRIMARY + '18' }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {uploadingDoc ? (
                    <ActivityIndicator size="small" color={PRIMARY} />
                  ) : (
                    <Ionicons name="image-outline" size={16} color={PRIMARY} />
                  )}
                  <Text style={[styles.addDocText, { color: PRIMARY }]}>
                    {uploadingDoc ? 'Subiendo…' : 'Agregar imagen'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {attachments.length === 0 ? (
              <Card>
                <Text style={{ color: colors.icon, fontSize: 14 }}>Sin documentos adjuntos.</Text>
              </Card>
            ) : (
              <View style={{ gap: 8 }}>
                {attachments.map((att) => (
                  <AttachmentItem key={att.id} attachment={att} />
                ))}
              </View>
            )}
          </>
        )}

        {/* Diagnostic tab */}
        {activeTab === 'diagnostic' && (
          <>
            {diagnostic ? (
              <>
                <Card style={styles.card}>
                  <View style={styles.diagHeader}>
                    <Text style={[styles.diagTitle, { color: colors.text }]}>Estado general</Text>
                    <Badge
                      label={DIAGNOSTIC_STATUS_LABELS[diagnostic.overall_status as keyof typeof DIAGNOSTIC_STATUS_LABELS]}
                      bg={(StatusColors[diagnostic.overall_status as keyof typeof StatusColors] ?? StatusColors.pendiente).bg}
                      color={(StatusColors[diagnostic.overall_status as keyof typeof StatusColors] ?? StatusColors.pendiente).text}
                    />
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${diagnostic.completion_pct}%` as never, backgroundColor: PRIMARY },
                      ]}
                    />
                  </View>
                  <Text style={[styles.pct, { color: colors.icon }]}>
                    {diagnostic.completion_pct}% completado
                  </Text>
                </Card>

                <Text style={[styles.sectionsTitle, { color: colors.text }]}>Secciones</Text>
                {SECTION_KEYS.map((key) => {
                  const sec = sections.find((s: AthleteSection) => s.section === key);
                  const sc = SectionColors[key];
                  const status = (sec?.status ?? 'pendiente') as DiagnosticStatus;
                  const statusC = StatusColors[status] ?? StatusColors.pendiente;
                  const isEditing = editingSection === key;

                  return (
                    <Card key={key} style={{ ...styles.sectionCard, borderLeftColor: sc.border, borderLeftWidth: 4 }}>
                      <View style={styles.sectionRow}>
                        <View style={[styles.sectionBadge, { backgroundColor: sc.bg }]}>
                          <Text style={[styles.sectionBadgeText, { color: sc.text }]}>
                            {SECTION_LABELS[key]}
                          </Text>
                        </View>
                        <View style={styles.sectionRight}>
                          <Badge
                            label={DIAGNOSTIC_STATUS_LABELS[status]}
                            bg={statusC.bg}
                            color={statusC.text}
                          />
                          {isStaffUser && (
                            <TouchableOpacity
                              onPress={() => setEditingSection(isEditing ? null : key)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ marginLeft: 6 }}
                            >
                              <Ionicons
                                name={isEditing ? 'chevron-up' : 'create-outline'}
                                size={16}
                                color={colors.icon}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      {/* Inline status selector (staff only) */}
                      {isEditing && (
                        <View style={styles.statusPicker}>
                          {(['pendiente', 'en_proceso', 'completo', 'requiere_atencion'] as DiagnosticStatus[]).map((s) => {
                            const c = StatusColors[s];
                            return (
                              <TouchableOpacity
                                key={s}
                                onPress={() => !savingSection && handleSectionStatus(key, s)}
                                disabled={savingSection}
                                style={[
                                  styles.statusOption,
                                  {
                                    backgroundColor: status === s ? c.bg : (scheme === 'dark' ? '#374151' : '#f1f5f9'),
                                    borderColor: status === s ? c.border : 'transparent',
                                    borderWidth: status === s ? 1 : 0,
                                    opacity: savingSection ? 0.5 : 1,
                                  },
                                ]}
                              >
                                <Text style={[styles.statusOptionText, { color: status === s ? c.text : colors.icon }]}>
                                  {DIAGNOSTIC_STATUS_LABELS[s]}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}

                      {sec && (
                        <View style={styles.miniProgress}>
                          <View
                            style={[
                              styles.miniProgressFill,
                              { width: `${sec.completion_pct}%` as never, backgroundColor: sc.text },
                            ]}
                          />
                        </View>
                      )}
                    </Card>
                  );
                })}
              </>
            ) : (
              <Card>
                <Text style={{ color: colors.icon }}>Sin diagnóstico registrado.</Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  initials: { color: '#fff', fontSize: 26, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  status: { fontSize: 13 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: PRIMARY },
  tabText: { fontSize: 14, fontWeight: '600' },
  card: { marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' },
  infoLabel: { fontSize: 13, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },
  diagHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  diagTitle: { fontSize: 15, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, marginBottom: 6 },
  progressFill: { height: 6, borderRadius: 3 },
  pct: { fontSize: 12 },
  sectionsTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  sectionCard: { marginBottom: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sectionBadgeText: { fontSize: 13, fontWeight: '600' },
  sectionRight: { flexDirection: 'row', alignItems: 'center' },
  statusPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 4 },
  statusOption: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusOptionText: { fontSize: 11, fontWeight: '600' },
  miniProgress: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, marginTop: 8 },
  miniProgressFill: { height: 4, borderRadius: 2 },
  // Info sections (Información tab)
  infoSection: {
    borderLeftWidth: 3, paddingLeft: 12, marginBottom: 6,
  },
  infoSectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 10,
  },
  notesText: { fontSize: 13, lineHeight: 20 },
  // Documentos upload button
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  addDocBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  addDocText: { fontSize: 12, fontWeight: '600' },
  // Follow-up sections (Seguimiento tab)
  sessionCard: { marginBottom: 10 },
  sessionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  sessionIcon: {
    width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  sessionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  sessionDate: { fontSize: 12 },
  sessionNotes: { fontSize: 12, lineHeight: 17, marginTop: 4, fontStyle: 'italic' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
});

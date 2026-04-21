import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
  Modal, FlatList, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY } from '@/constants/theme';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createTicket } from '@/services/tickets';
import { notifyProfiles } from '@/services/notifications';
import { useAuthStore } from '@/store';
import { supabase } from '@/lib/supabase';
import type { TicketPriority } from '@/types';
import { TICKET_PRIORITY_LABELS } from '@/types';

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

type PersonProfile = { id: string; first_name: string; last_name: string };

export default function CreateTicketScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { profile } = useAuthStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  // Assignee state (multi-select: staff + athletes)
  const [assignees,    setAssignees]    = useState<PersonProfile[]>([]);
  const [peopleList,   setPeopleList]   = useState<PersonProfile[]>([]);
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Notification options
  const [notifyPush,  setNotifyPush]  = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);

  // Only users with assign_tickets permission see the assignee picker
  const canAssign = useAuthStore((s) => s.hasPermission('assign_tickets'));

  // Load all profiles (staff + athletes) for assignment
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .order('last_name', { ascending: true });
        if (error) {
          console.warn('[ticket] load people error:', error.message);
          return;
        }
        setPeopleList(
          (data ?? [])
            .filter((p) => p.id && p.first_name)
            .map(({ id, first_name, last_name }) => ({ id, first_name, last_name })) as PersonProfile[],
        );
      } catch (e) {
        console.warn('[ticket] load people error', e);
      }
    })();
  }, []);

  const filteredPeople = pickerSearch.trim()
    ? peopleList.filter((p) =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(pickerSearch.toLowerCase())
      )
    : peopleList;

  async function handleCreate() {
    const errs: typeof errors = {};
    if (!title.trim()) errs.title = 'El título es requerido';
    if (!description.trim()) errs.description = 'La descripción es requerida';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!profile) { Alert.alert('Error', 'No hay sesión activa'); return; }

    setErrors({});
    setLoading(true);
    try {
      const ticket = await createTicket({
        title:             title.trim(),
        description:       description.trim(),
        priority,
        created_by:        profile.id,
        // requester_user_id FK → profiles.id (migration 009).
        // Must be profile.id (NOT session.user.id which is auth.uid()).
        requester_user_id: profile.id,
        assigned_to:       assignees[0]?.id,
      });
      // Send notifications BEFORE navigating so any error is visible on this screen
      if ((notifyPush || notifyEmail) && assignees.length > 0) {
        try {
          await notifyProfiles(
            assignees.map((a) => a.id),
            {
              notifyPush,
              notifyEmail,
              entityType:     'ticket',
              entityId:       ticket.id,
              pushTitle:      `Ticket asignado: ${title.trim()}`,
              pushMessage:    `Se te asignó el ticket "${title.trim()}"`,
              emailSubject:   `Ticket asignado: ${title.trim()}`,
              emailHtmlBody:  `<p>Se te ha asignado el ticket <strong>${title.trim()}</strong> con prioridad <strong>${priority}</strong>.</p>`,
              emailPlainBody: `Se te asignó el ticket "${title.trim()}" con prioridad ${priority}.`,
            },
          );
        } catch (ne: unknown) {
          const nm = (ne as { message?: string })?.message ?? 'Error desconocido';
          console.error('[ticket] notify error:', nm);
          Alert.alert(
            'Notificación no enviada',
            `El ticket fue creado pero las notificaciones fallaron.\n\nDetalle: ${nm}\n\nVerifica que las migraciones 026 y 027 estén aplicadas en Supabase.`,
          );
        }
      }

      router.back();
    } catch (e: unknown) {
      // PostgrestError from Supabase is NOT instanceof Error — check .message directly.
      const msg = (e as { message?: string })?.message ?? 'No se pudo crear el ticket';
      console.error('[ticket] create error:', JSON.stringify(e));
      Alert.alert('Error al crear ticket', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* No SafeAreaView here — the Stack header above already handles the top inset */}
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[styles.heading, { color: colors.text }]}>Nuevo Ticket</Text>

          <Input
            label="Título"
            placeholder="Describe brevemente el problema"
            value={title}
            onChangeText={setTitle}
            error={errors.title}
          />

          <Input
            label="Descripción"
            placeholder="Detalla el problema o solicitud..."
            value={description}
            onChangeText={setDescription}
            error={errors.description}
            multiline
            numberOfLines={4}
            style={{ height: 100, textAlignVertical: 'top' }}
          />

          {/* Assignee picker — only for roles with assign_tickets permission */}
          {canAssign && <Text style={[styles.label, { color: colors.text }]}>Asignado a</Text>}
          {/* (invisible placeholder keeps layout consistent when hidden) */}
          {canAssign && (
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
            <Text style={[styles.pickerBtnText, { color: colors.icon }]}>
              {assignees.length > 0 ? `${assignees.length} asignado(s)` : 'Sin asignar (opcional)'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.icon} />
          </TouchableOpacity>
          )}

          {/* Selected assignees — horizontally scrollable chips */}
          {canAssign && assignees.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              style={styles.chipsScrollView}
              contentContainerStyle={styles.chipsContent}
            >
              {assignees.map((a) => (
                <View
                  key={a.id}
                  style={[styles.chip, { backgroundColor: PRIMARY + '18', borderColor: PRIMARY + '40' }]}
                >
                  <Text style={[styles.chipText, { color: PRIMARY }]}>
                    {a.first_name} {a.last_name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setAssignees((prev) => prev.filter((x) => x.id !== a.id))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color={PRIMARY} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Assignee picker modal */}
          <Modal visible={canAssign && pickerOpen} animationType="slide" presentationStyle="pageSheet">
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Seleccionar asignado</Text>
                <TouchableOpacity onPress={() => { setPickerOpen(false); setPickerSearch(''); }}>
                  <Ionicons name="close" size={24} color={colors.icon} />
                </TouchableOpacity>
              </View>

              {/* Search */}
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

              {/* "Sin asignar" option */}
              <TouchableOpacity
                style={[styles.staffRow, { borderBottomColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}
                onPress={() => { setAssignees([]); setPickerOpen(false); setPickerSearch(''); }}
              >
                <View style={styles.staffAvatar}>
                  <Ionicons name="person-outline" size={16} color={colors.icon} />
                </View>
                <Text style={[styles.staffName, { color: colors.icon }]}>Sin asignar</Text>
                {assignees.length === 0 && <Ionicons name="checkmark" size={18} color={PRIMARY} />}
              </TouchableOpacity>

              <FlatList
                data={filteredPeople}
                keyExtractor={(p) => p.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const initials = `${item.first_name[0] ?? ''}${item.last_name[0] ?? ''}`.toUpperCase();
                  const selected = assignees.some((a) => a.id === item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.staffRow, { borderBottomColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}
                      onPress={() =>
                        setAssignees((prev) =>
                          prev.some((a) => a.id === item.id)
                            ? prev.filter((a) => a.id !== item.id)
                            : [...prev, item],
                        )
                      }
                    >
                      <View style={[styles.staffAvatar, { backgroundColor: PRIMARY }]}>
                        <Text style={styles.staffInitials}>{initials}</Text>
                      </View>
                      <Text style={[styles.staffName, { color: colors.text }]}>
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

              {/* Done button */}
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: PRIMARY }]}
                onPress={() => { setPickerOpen(false); setPickerSearch(''); }}
              >
                <Text style={styles.doneBtnText}>Listo</Text>
              </TouchableOpacity>
            </View>
          </Modal>

          {/* Notification options — visible when assignees are selected */}
          {assignees.length > 0 && (
            <View style={styles.notifSection}>
              <Text style={[styles.label, { color: colors.text }]}>Notificaciones</Text>
              <TouchableOpacity
                onPress={() => setNotifyPush((v) => !v)}
                style={styles.notifRow}
                activeOpacity={0.7}
              >
                <View style={[styles.notifDot, { backgroundColor: notifyPush ? PRIMARY : colors.icon }]}>
                  {notifyPush && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Ionicons name="notifications-outline" size={15} color={notifyPush ? PRIMARY : colors.icon} style={{ marginLeft: 4, marginRight: 6 }} />
                <Text style={[{ fontSize: 14, color: notifyPush ? colors.text : colors.icon }]}>Push notification</Text>
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
                <Text style={[{ fontSize: 14, color: notifyEmail ? colors.text : colors.icon }]}>Email</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Priority selector */}
          <Text style={[styles.label, { color: colors.text }]}>Prioridad</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPriority(p)}
                style={[
                  styles.priorityBtn,
                  priority === p && { backgroundColor: PRIMARY, borderColor: PRIMARY },
                  { borderColor: scheme === 'dark' ? '#374151' : '#e2e8f0' },
                ]}
              >
                <Text style={[
                  styles.priorityText,
                  { color: priority === p ? '#fff' : colors.text },
                ]}>
                  {TICKET_PRIORITY_LABELS[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            label="Crear ticket"
            onPress={handleCreate}
            loading={loading}
            style={styles.btn}
          />
        </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },

  // Assignee picker button
  pickerBtn: {
    height: 48, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  pickerBtnText: { fontSize: 15, flex: 1 },

  // Picker modal
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

  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  priorityBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  priorityText: { fontSize: 13, fontWeight: '500' },
  btn: { marginTop: 4 },

  // Multi-select assignee chips
  chipsScrollView: { marginBottom: 12 },
  chipsContent: { gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  // Done button inside picker modal
  doneBtn: {
    margin: 16, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Notification options
  notifSection: { marginBottom: 16 },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 0, marginBottom: 10 },
  notifDot: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
});

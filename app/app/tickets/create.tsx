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
import { useAuthStore } from '@/store';
import { supabase } from '@/lib/supabase';
import type { TicketPriority } from '@/types';
import { TICKET_PRIORITY_LABELS } from '@/types';

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

type StaffProfile = { id: string; first_name: string; last_name: string };

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

  // Assignee state
  const [assignee, setAssignee] = useState<StaffProfile | null>(null);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Load assignable staff on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('profile:profiles!user_roles_profile_id_fkey(id, first_name, last_name), role:roles!user_roles_role_id_fkey(code)')
          .neq('role.code', 'athlete');
        const seen = new Set<string>();
        const staff: StaffProfile[] = [];
        // Supabase returns joined rows as arrays; extract first element.
        type RawRow = { profile: StaffProfile[]; role: { code: string }[] };
        (data as RawRow[] ?? []).forEach((row) => {
          const p = Array.isArray(row.profile) ? row.profile[0] : row.profile;
          const r = Array.isArray(row.role) ? row.role[0] : row.role;
          if (p && (r as { code: string } | null)?.code !== 'athlete' && !seen.has(p.id)) {
            seen.add(p.id);
            staff.push(p);
          }
        });
        staff.sort((a, b) => a.last_name.localeCompare(b.last_name));
        setStaffList(staff);
      } catch (e) {
        console.warn('[ticket] load staff error', e);
      }
    })();
  }, []);

  const filteredStaff = pickerSearch.trim()
    ? staffList.filter((s) =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(pickerSearch.toLowerCase())
      )
    : staffList;

  async function handleCreate() {
    const errs: typeof errors = {};
    if (!title.trim()) errs.title = 'El título es requerido';
    if (!description.trim()) errs.description = 'La descripción es requerida';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!profile) { Alert.alert('Error', 'No hay sesión activa'); return; }

    setErrors({});
    setLoading(true);
    try {
      await createTicket({
        title: title.trim(),
        description: description.trim(),
        priority,
        created_by: profile.id,
        requester_user_id: profile.id,
        assigned_to: assignee?.id,
      });
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

          {/* Assignee picker */}
          <Text style={[styles.label, { color: colors.text }]}>Asignado a</Text>
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
            <Text style={[
              styles.pickerBtnText,
              { color: assignee ? colors.text : colors.icon },
            ]}>
              {assignee ? `${assignee.first_name} ${assignee.last_name}` : 'Sin asignar (opcional)'}
            </Text>
            <Ionicons
              name={assignee ? 'close-circle' : 'chevron-down'}
              size={18}
              color={colors.icon}
              onPress={assignee ? () => setAssignee(null) : undefined}
            />
          </TouchableOpacity>

          {/* Staff picker modal */}
          <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet">
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
                onPress={() => { setAssignee(null); setPickerOpen(false); setPickerSearch(''); }}
              >
                <View style={styles.staffAvatar}>
                  <Ionicons name="person-outline" size={16} color={colors.icon} />
                </View>
                <Text style={[styles.staffName, { color: colors.icon }]}>Sin asignar</Text>
                {!assignee && <Ionicons name="checkmark" size={18} color={PRIMARY} />}
              </TouchableOpacity>

              <FlatList
                data={filteredStaff}
                keyExtractor={(s) => s.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const initials = `${item.first_name[0] ?? ''}${item.last_name[0] ?? ''}`.toUpperCase();
                  const selected = assignee?.id === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.staffRow, { borderBottomColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}
                      onPress={() => { setAssignee(item); setPickerOpen(false); setPickerSearch(''); }}
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
            </View>
          </Modal>

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
});

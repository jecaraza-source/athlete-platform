import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Colors, PRIMARY, TicketStatusColors, PriorityColors } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { getTicket, getTicketComments, addComment, changeTicketStatus } from '@/services/tickets';
import { notifyProfiles } from '@/services/notifications';
import { useAuthStore } from '@/store';
import type { TicketWithProfiles, CommentWithAuthor, TicketStatus } from '@/types';
import { TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS } from '@/types';

const NEXT_STATUS: Partial<Record<TicketStatus, TicketStatus>> = {
  open: 'in_progress',
  in_progress: 'resolved',
  resolved: 'closed',
};

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { profile } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<TicketWithProfiles | null>(null);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  async function load() {
    const [t, c] = await Promise.all([getTicket(id), getTicketComments(id)]);
    setTicket(t);
    setComments(c);
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  async function handleAddComment() {
    if (!comment.trim() || !profile || !ticket) return;
    setSending(true);
    const commentText = comment.trim(); // capture before clearing
    try {
      await addComment(id, profile.id, commentText);
      setComment('');
      const updated = await getTicketComments(id);
      setComments(updated);

      // Notify the ticket creator and assignee (excluding the commenter)
      const recipients = new Set<string>();
      if (ticket.created_by && ticket.created_by !== profile.id)
        recipients.add(ticket.created_by);
      if (ticket.assigned_to && ticket.assigned_to !== profile.id)
        recipients.add(ticket.assigned_to);

      if (recipients.size > 0) {
        const authorName = `${profile.first_name} ${profile.last_name}`.trim() || 'Alguien';
        const preview    = commentText.length > 80 ? `${commentText.slice(0, 80)}…` : commentText;
        notifyProfiles(Array.from(recipients), {
          notifyPush:     true,
          notifyEmail:    false,
          entityType:     'ticket',
          entityId:       id,
          pushTitle:      `Comentario en: ${ticket.title}`,
          pushMessage:    `${authorName}: “${preview}”`,
          emailSubject:   `Comentario en ticket: ${ticket.title}`,
          emailHtmlBody:  `<p><strong>${authorName}</strong> comentó: ${commentText}</p>`,
          emailPlainBody: `${authorName} comentó: ${commentText}`,
        }).catch((e) => console.warn('[ticket/comment] notify error:', e));
      }
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange() {
    if (!ticket) return;
    const next = NEXT_STATUS[ticket.status];
    if (!next) return;
    Alert.alert(
      'Cambiar estado',
      `¿Cambiar a "${TICKET_STATUS_LABELS[next]}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            await changeTicketStatus(id, next);
            const updated = await getTicket(id);
            setTicket(updated);
          },
        },
      ]
    );
  }

  if (loading) return <Loading fullScreen />;
  if (!ticket) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, textAlign: 'center', marginTop: 40 }}>
          Ticket no encontrado
        </Text>
      </SafeAreaView>
    );
  }

  const sc = TicketStatusColors[ticket.status];
  const pc = PriorityColors[ticket.priority];
  const nextStatus = NEXT_STATUS[ticket.status];

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.badges}>
          <Badge label={TICKET_STATUS_LABELS[ticket.status]} bg={sc.bg} color={sc.text} />
          <Badge label={TICKET_PRIORITY_LABELS[ticket.priority]} bg={pc.bg} color={pc.text} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{ticket.title}</Text>
        <Text style={[styles.date, { color: colors.icon }]}>
          Creado {new Date(ticket.created_at).toLocaleDateString('es-MX')}
        </Text>

        <Card style={styles.card}>
          <Text style={[styles.descLabel, { color: colors.icon }]}>Descripción</Text>
          <Text style={[styles.desc, { color: colors.text }]}>{ticket.description}</Text>
        </Card>

        {ticket.assigned_to_profile && (
          <Card style={styles.card}>
            <Text style={[styles.descLabel, { color: colors.icon }]}>Asignado a</Text>
            <Text style={[styles.desc, { color: colors.text }]}>
              {ticket.assigned_to_profile.first_name} {ticket.assigned_to_profile.last_name}
            </Text>
          </Card>
        )}

        {/* Change status */}
        {nextStatus && (
          <Button
            label={`Mover a: ${TICKET_STATUS_LABELS[nextStatus]}`}
            onPress={handleStatusChange}
            variant="secondary"
            style={styles.statusBtn}
          />
        )}

        {/* Comments */}
        <Text style={[styles.commentsTitle, { color: colors.text }]}>
          Comentarios ({comments.length})
        </Text>

        {comments.map((c) => (
          <View
            key={c.id}
            style={[styles.comment, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#f8fafc' }]}
          >
            <Text style={[styles.commentAuthor, { color: PRIMARY }]}>
              {c.author ? `${c.author.first_name} ${c.author.last_name}` : 'Usuario'}
            </Text>
            <Text style={[styles.commentText, { color: colors.text }]}>{c.message}</Text>
            <Text style={[styles.commentDate, { color: colors.icon }]}>
              {new Date(c.created_at).toLocaleDateString('es-MX')}
            </Text>
          </View>
        ))}

        {/* Add comment */}
        <View style={[styles.commentInput, { borderColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}>
          <TextInput
            style={[styles.commentField, { color: colors.text }]}
            placeholder="Escribe un comentario..."
            placeholderTextColor={colors.icon}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <Button
            label="Enviar"
            onPress={handleAddComment}
            loading={sending}
            disabled={!comment.trim()}
            style={styles.sendBtn}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },
  container: { padding: 16, paddingBottom: 40 },
  badges: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  date: { fontSize: 12, marginBottom: 16 },
  card: { marginBottom: 12 },
  descLabel: { fontSize: 12, marginBottom: 6 },
  desc: { fontSize: 14, lineHeight: 20 },
  statusBtn: { marginBottom: 20 },
  commentsTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  comment: { borderRadius: 10, padding: 12, marginBottom: 8 },
  commentAuthor: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  commentText: { fontSize: 13, lineHeight: 18 },
  commentDate: { fontSize: 11, marginTop: 4 },
  commentInput: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8 },
  commentField: { fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
  sendBtn: { height: 36, marginTop: 8 },
});

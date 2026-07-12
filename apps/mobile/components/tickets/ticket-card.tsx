import { TouchableOpacity, View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Colors, TicketStatusColors, PriorityColors } from '@/constants/theme';
import { TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS } from '@/types';
import type { TicketWithProfiles } from '@/types';

type TicketCardProps = {
  ticket: TicketWithProfiles;
  onPress: () => void;
};

export function TicketCard({ ticket, onPress }: TicketCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const sc = TicketStatusColors[ticket.status] ?? TicketStatusColors.open;
  const pc = PriorityColors[ticket.priority] ?? PriorityColors.low;

  const assignee = ticket.assigned_to_profile
    ? `${ticket.assigned_to_profile.first_name} ${ticket.assigned_to_profile.last_name}`
    : 'Sin asignar';

  const date = new Date(ticket.created_at).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short',
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff' }]}
    >
      <View style={styles.top}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {ticket.title}
        </Text>
        <Text style={[styles.date, { color: colors.icon }]}>{date}</Text>
      </View>

      <View style={styles.badges}>
        <View style={[styles.badge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.badgeText, { color: sc.text }]}>
            {TICKET_STATUS_LABELS[ticket.status]}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: pc.bg }]}>
          <Text style={[styles.badgeText, { color: pc.text }]}>
            {TICKET_PRIORITY_LABELS[ticket.priority]}
          </Text>
        </View>
      </View>

      <Text style={[styles.assignee, { color: colors.icon }]}>→ {assignee}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14, borderRadius: 12, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  date: { fontSize: 11 },
  badges: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  assignee: { fontSize: 12 },
});

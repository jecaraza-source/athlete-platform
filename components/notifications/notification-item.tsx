import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';
import type { PushJob } from '@/types';

type Props = { notification: PushJob };

const STATUS_DOT: Record<string, string> = {
  sent:       '#15803d',
  pending:    '#854d0e',
  failed:     '#dc2626',
  processing: '#1d4ed8',
};

export function NotificationItem({ notification: n }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const dot = STATUS_DOT[n.status] ?? '#94a3b8';

  const date = new Date(n.created_at).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <View style={[styles.item, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff' }]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {n.title}
        </Text>
        <Text style={[styles.message, { color: colors.icon }]} numberOfLines={2}>
          {n.message}
        </Text>
        <Text style={[styles.date, { color: colors.icon }]}>{date}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row', padding: 14, borderRadius: 12, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, marginRight: 12 },
  content: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  message: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  date: { fontSize: 11 },
});

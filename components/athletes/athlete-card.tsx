import { TouchableOpacity, View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';
import type { Athlete } from '@/types';

// Keys match the DB schema (English values from packages/shared/src/types.ts)
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:    { bg: '#dcfce7', text: '#15803d' },
  inactive:  { bg: '#f1f5f9', text: '#64748b' },
  injured:   { bg: '#fee2e2', text: '#dc2626' },
  suspended: { bg: '#fef9c3', text: '#854d0e' },
};

// Human-readable Spanish labels for display
const STATUS_DISPLAY: Record<string, string> = {
  active:    'Activo',
  inactive:  'Inactivo',
  injured:   'Lesionado',
  suspended: 'Suspendido',
};

type AthleteCardProps = {
  athlete: Athlete;
  onPress: () => void;
};

export function AthleteCard({ athlete, onPress }: AthleteCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const sc = STATUS_COLORS[athlete.status ?? ''] ?? STATUS_COLORS.inactivo;
  const initials = `${athlete.first_name[0] ?? ''}${athlete.last_name[0] ?? ''}`.toUpperCase();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff' }]}
    >
      <View style={styles.avatar}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]}>
          {athlete.first_name} {athlete.last_name}
        </Text>
        {athlete.discipline && (
          <Text style={[styles.discipline, { color: colors.icon }]}>{athlete.discipline}</Text>
        )}
        {athlete.athlete_code && (
          <Text style={[styles.code, { color: colors.icon }]}>#{athlete.athlete_code}</Text>
        )}
      </View>
      <View style={[styles.badge, { backgroundColor: sc.bg }]}>
        <Text style={[styles.badgeText, { color: sc.text }]}>
          {STATUS_DISPLAY[athlete.status ?? ''] ?? athlete.status ?? '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 12, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#0a7ea4', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  initials: { color: '#fff', fontWeight: '700', fontSize: 16 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  discipline: { fontSize: 12, marginBottom: 1 },
  code: { fontSize: 11 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },
});

import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import type { PsychPendingAssessment } from '@/services/psych';
import { daysLeftLabel, formatPsychDate } from '@/lib/psych-labels';

const AMBER = { bg: '#fffbeb', border: '#fde68a', text: '#92400e', strong: '#78350f' };

/**
 * Home-screen notice for scheduled tests: test name, generation date and the
 * completion window. Renders nothing when there is no pending test.
 */
export function PendingTestsCard({
  pending,
  completionWindowDays,
}: {
  pending: PsychPendingAssessment[];
  completionWindowDays: number;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  if (pending.length === 0) return null;

  return (
    <View style={[styles.box, { backgroundColor: scheme === 'dark' ? '#2a2414' : AMBER.bg }]}>
      <Text style={styles.eyebrow}>EXAMEN PROGRAMADO</Text>
      <Text style={[styles.title, { color: colors.text }]}>
        {pending.length === 1 ? 'Tienes un examen pendiente' : `Tienes ${pending.length} exámenes pendientes`}
      </Text>
      <Text style={styles.window}>Tienes {completionWindowDays} días para completarlo.</Text>

      {pending.map((assessment) => (
        <View key={assessment.id} style={[styles.item, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff' }]}>
          <Text style={[styles.name, { color: colors.text }]}>{assessment.instrumentName}</Text>
          <Text style={[styles.meta, { color: colors.icon }]}>Generado el {formatPsychDate(assessment.createdAt)}</Text>
          {assessment.isOverdue ? (
            <Text style={styles.overdue}>
              El plazo de {completionWindowDays} días venció el {formatPsychDate(assessment.dueAt)}. Complétalo lo antes posible.
            </Text>
          ) : (
            <Text style={[styles.due, { color: colors.text }]}>
              {assessment.isOpen
                ? `Tienes hasta el ${formatPsychDate(assessment.dueAt)}`
                : `Disponible a partir del ${formatPsychDate(assessment.opensAt)}`}
              {' · '}
              <Text style={styles.daysLeft}>{daysLeftLabel(assessment.daysLeft)}</Text>
            </Text>
          )}
          {assessment.isOpen && (
            <TouchableOpacity
              style={styles.button}
              activeOpacity={0.85}
              onPress={() => router.push(`/app/psych/${assessment.id}` as never)}
            >
              <Text style={styles.buttonText}>Responder ahora</Text>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: AMBER.border, borderRadius: 14, padding: 16, marginTop: 16, marginBottom: 8 },
  eyebrow: { color: AMBER.text, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  window: { color: AMBER.strong, fontSize: 13, marginTop: 4 },
  item: { borderWidth: 1, borderColor: AMBER.border, borderRadius: 12, padding: 12, marginTop: 12 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  due: { fontSize: 13, marginTop: 6 },
  daysLeft: { color: AMBER.text, fontWeight: '700' },
  overdue: { color: '#b91c1c', fontSize: 13, fontWeight: '600', marginTop: 6 },
  button: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#C0172C', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginTop: 10,
  },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

import { useEffect, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, useColorScheme, View,
} from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, PRIMARY } from '@/constants/theme';
import { EmptyView } from '@/components/ui/empty-view';
import { Loading } from '@/components/ui/loading';
import { useAuthStore, usePsychQuestionnaireStore } from '@/store';
import {
  getPsychQuestionnaire,
  submitPsychResponses,
  type MobileQuestionnaire,
} from '@/services/psych';

type ResponseOption = { value: string; label: string };

function normaliseOptions(value: unknown): ResponseOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option) => {
    if (typeof option === 'string' || typeof option === 'number') {
      const normalised = String(option);
      return [{ value: normalised, label: normalised }];
    }
    if (option && typeof option === 'object' && 'value' in option) {
      const raw = option as { value?: unknown; label?: unknown };
      if (typeof raw.value === 'string') {
        return [{ value: raw.value, label: typeof raw.label === 'string' ? raw.label : raw.value }];
      }
    }
    return [];
  });
}

export default function PsychQuestionnaireScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { assessmentId: rawAssessmentId } = useLocalSearchParams<{ assessmentId: string }>();
  const assessmentId = Array.isArray(rawAssessmentId) ? rawAssessmentId[0] : rawAssessmentId;
  const isAthlete = useAuthStore((state) => state.isAthlete);
  const responses = usePsychQuestionnaireStore((state) => state.responses);
  const begin = usePsychQuestionnaireStore((state) => state.begin);
  const setResponse = usePsychQuestionnaireStore((state) => state.setResponse);
  const clear = usePsychQuestionnaireStore((state) => state.clear);
  const [questionnaire, setQuestionnaire] = useState<MobileQuestionnaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!assessmentId) {
      setError('No se recibió una evaluación válida.');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    getPsychQuestionnaire(assessmentId)
      .then((result) => {
        if (!active) return;
        begin(result.assessmentId);
        setQuestionnaire(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'No hay un cuestionario disponible.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [assessmentId, begin]);

  if (!isAthlete()) {
    return <Redirect href="/app/(tabs)" />;
  }

  async function submit() {
    if (!questionnaire || submitting) return;
    const payload = questionnaire.items.map((item) => ({
      item_code: item.item_code,
      raw_value: responses[item.item_code] ?? '',
    }));
    if (payload.some((response) => !response.raw_value)) {
      Alert.alert('Faltan respuestas', 'Responde todos los reactivos antes de enviar el cuestionario.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitPsychResponses(questionnaire.assessmentId, payload);
      clear();
      Alert.alert(
        'Evaluación enviada a revisión',
        result.message ?? 'Tus respuestas fueron registradas y serán revisadas por el equipo de salud mental.',
      );
    } catch (reason) {
      Alert.alert(
        'No fue posible enviar',
        reason instanceof Error
          ? `${reason.message}\n\nTus respuestas siguen guardadas; puedes intentar enviar de nuevo.`
          : 'Tus respuestas siguen guardadas; puedes intentar enviar de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loading fullScreen />;
  if (error || !questionnaire) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <EmptyView
          title="No hay cuestionario disponible"
          subtitle={error ?? 'Cuando el equipo programe una evaluación autorizada, aparecerá aquí.'}
        />
      </SafeAreaView>
    );
  }

  const answeredCount = questionnaire.items.filter((item) => Boolean(responses[item.item_code])).length;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CUESTIONARIO DISPONIBLE</Text>
          <Text style={[styles.title, { color: colors.text }]}>{questionnaire.instrumentName}</Text>
          <Text style={[styles.subtitle, { color: colors.icon }]}>
            Tus respuestas son confidenciales y serán revisadas por personal autorizado.
          </Text>
          <Text style={[styles.progress, { color: colors.icon }]}>
            {answeredCount} de {questionnaire.items.length} respondidas
          </Text>
        </View>

        {questionnaire.items.map((item) => {
          const options = normaliseOptions(item.response_options);
          return (
            <View key={item.item_code} style={[styles.item, { borderColor: scheme === 'dark' ? '#303236' : '#e2e8f0' }]}>
              <Text style={[styles.question, { color: colors.text }]}>
                <Text style={styles.questionNumber}>{item.item_order}. </Text>{item.prompt_text}
              </Text>
              <View style={styles.options}>
                {options.map((option) => {
                  const selected = responses[item.item_code] === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setResponse(item.item_code, option.value)}
                      style={[styles.option, selected && styles.optionSelected]}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          disabled={submitting}
          onPress={submit}
          style={[styles.submit, submitting && styles.submitDisabled]}
        >
          <Text style={styles.submitText}>{submitting ? 'Enviando…' : 'Enviar respuestas'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20, paddingBottom: 36 },
  header: { marginBottom: 20 },
  eyebrow: { color: PRIMARY, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  progress: { fontSize: 13, fontWeight: '600', marginTop: 12 },
  item: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  question: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  questionNumber: { color: PRIMARY },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  option: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  optionSelected: { borderColor: PRIMARY, backgroundColor: '#e6f4fa' },
  optionText: { color: '#475569', fontSize: 14, fontWeight: '600' },
  optionTextSelected: { color: PRIMARY },
  submit: { alignItems: 'center', backgroundColor: PRIMARY, borderRadius: 12, marginTop: 12, paddingVertical: 14 },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

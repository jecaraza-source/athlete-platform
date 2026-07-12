import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, useColorScheme, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, PRIMARY } from '@/constants/theme';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        // Deep link: the app handles this URL in (auth)/reset-password.tsx.
        // The scheme 'aodeporte' is defined in app.json → expo.scheme.
        redirectTo: 'aodeporte://app/(auth)/reset-password',
      }
    );
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={[styles.backText, { color: PRIMARY }]}>← Regresar</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>Recuperar contraseña</Text>
        <Text style={[styles.body, { color: colors.icon }]}>
          Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
        </Text>

        {sent ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              ✓ Correo enviado. Revisa tu bandeja de entrada.
            </Text>
          </View>
        ) : (
          <>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            <Input
              label="Correo electrónico"
              placeholder="correo@ejemplo.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <Button
              label="Enviar enlace"
              onPress={handleReset}
              loading={loading}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, paddingTop: 60 },
  back: { marginBottom: 24 },
  backText: { fontSize: 15 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 10 },
  body: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 14 },
  errorText: { color: '#dc2626', fontSize: 13 },
  successBox: { backgroundColor: '#dcfce7', borderRadius: 8, padding: 16 },
  successText: { color: '#15803d', fontSize: 14, fontWeight: '600' },
});

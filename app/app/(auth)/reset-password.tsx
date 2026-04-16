/**
 * reset-password.tsx
 *
 * Handles the password-reset deep link sent by Supabase.
 *
 * Flow:
 *  1. User taps "¿Olvidaste tu contraseña?" → forgot-password.tsx calls
 *     supabase.auth.resetPasswordForEmail(email, { redirectTo: 'aodeporte://...' })
 *  2. Supabase emails a link like:
 *       https://<project>.supabase.co/auth/v1/verify?token=...&type=recovery
 *       &redirect_to=aodeporte://app/(auth)/reset-password
 *  3. When tapped on a device with the app installed, the OS opens the app
 *     and Expo Router navigates here.
 *  4. Supabase appends the session tokens as a URL fragment:
 *       aodeporte://app/(auth)/reset-password#access_token=T&refresh_token=R&type=recovery
 *  5. We parse the fragment, call supabase.auth.setSession(), then let the
 *     user set a new password via supabase.auth.updateUser().
 */

import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, useColorScheme,
} from 'react-native';
import { useURL } from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ResetPasswordScreen() {
  const url      = useURL();
  const router   = useRouter();
  const scheme   = useColorScheme() ?? 'light';
  const colors   = Colors[scheme];

  const [sessionReady, setSessionReady] = useState(false);
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  // ─── Parse the deep-link URL and establish the recovery session ───────────
  useEffect(() => {
    if (!url) return;

    // The token arrives in the URL fragment (#access_token=...&type=recovery)
    // or occasionally as query params (?access_token=...) depending on the
    // Supabase project's email template configuration.
    const sep      = url.includes('#') ? '#' : '?';
    const fragment = url.split(sep)[1] ?? '';
    const params   = new URLSearchParams(fragment);

    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type         = params.get('type');

    if (type === 'recovery' && accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error: sessionError }) => {
          if (sessionError) {
            setError('El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.');
          } else {
            setSessionReady(true);
          }
        });
    }
  }, [url]);

  // ─── Submit new password ──────────────────────────────────────────────────
  async function handleReset() {
    if (!password.trim() || !confirm.trim()) {
      setError('Ingresa y confirma tu nueva contraseña.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setError(null);
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      // Brief pause so the user sees the success message, then go to the app.
      setTimeout(() => router.replace('/app/(tabs)' as never), 2000);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Nueva contraseña
        </Text>

        {/* Session not yet established — waiting for URL or showing link error */}
        {!sessionReady && !error && (
          <View style={styles.infoBox}>
            <Text style={[styles.infoText, { color: colors.icon }]}>
              Procesando el enlace de recuperación…
            </Text>
          </View>
        )}

        {/* Error (invalid/expired link) */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Success */}
        {success && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              ✓ Contraseña actualizada. Redirigiendo…
            </Text>
          </View>
        )}

        {/* New-password form — only shown once the session is valid */}
        {sessionReady && !success && (
          <>
            <Text style={[styles.body, { color: colors.icon }]}>
              Elige una contraseña segura de al menos 8 caracteres.
            </Text>

            <Input
              label="Nueva contraseña"
              placeholder="••••••••"
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              secureTextEntry
              textContentType="newPassword"
            />

            <Input
              label="Confirmar contraseña"
              placeholder="••••••••"
              value={confirm}
              onChangeText={(v) => { setConfirm(v); setError(null); }}
              secureTextEntry
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={handleReset}
            />

            <Button
              label="Guardar nueva contraseña"
              onPress={handleReset}
              loading={loading}
              style={styles.btn}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1 },
  container: { flexGrow: 1, padding: 24, paddingTop: 48 },
  title:     { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  body:      { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  btn:       { marginTop: 8 },
  infoBox:   { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 14, marginBottom: 16 },
  infoText:  { fontSize: 14 },
  errorBox:  { backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 14 },
  errorText: { color: '#dc2626', fontSize: 13 },
  successBox:{ backgroundColor: '#dcfce7', borderRadius: 8, padding: 16, marginBottom: 16 },
  successText: { color: '#15803d', fontSize: 14, fontWeight: '600' },
});

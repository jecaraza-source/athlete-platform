import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, Platform, useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, PRIMARY } from '@/constants/theme';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Por favor ingresa tu correo y contraseña.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (authError) {
      setError(
        authError.message.includes('Invalid login credentials')
          ? 'Correo o contraseña incorrectos.'
          : authError.message
      );
    }
    // If successful the root layout's onAuthStateChange will redirect
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
        {/* Logo / brand */}
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.subtitle, { color: colors.icon }]}>
            Inicia sesión para continuar
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
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

          <Input
            label="Contraseña"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <Button
            label="Iniciar sesión"
            onPress={handleLogin}
            loading={loading}
            style={styles.btn}
          />

          <TouchableOpacity
            onPress={() => router.push('/app/(auth)/forgot-password' as never)}
            style={styles.forgotLink}
          >
            <Text style={[styles.forgotText, { color: PRIMARY }]}>
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 110, height: 110, marginBottom: 12 },
  subtitle: { fontSize: 14, marginBottom: 4 },
  form: {},
  errorBox: {
    backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 14,
  },
  errorText: { color: '#dc2626', fontSize: 13 },
  btn: { marginTop: 8 },
  forgotLink: { marginTop: 16, alignItems: 'center' },
  forgotText: { fontSize: 14 },
});

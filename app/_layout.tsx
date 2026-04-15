import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { PRIMARY } from '@/constants/theme';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  // Subscribe to session + isInitialized reactively so the redirect
  // effect re-runs whenever either value changes.
  const session     = useAuthStore((s) => s.session);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const { setSession, loadUserData, reset } = useAuthStore();
  usePushNotifications();

  useEffect(() => {
    // Safety net: force initialization after 6 s so the app never freezes
    // if Supabase or the network hangs indefinitely.
    const timeout = setTimeout(() => {
      if (!useAuthStore.getState().isInitialized) {
        console.warn('[auth] initialization timeout — forcing reset');
        useAuthStore.getState().reset();
      }
    }, 6000);

    // PRIMARY: getSession() gives us the persisted session synchronously-ish.
    // This is the most reliable path in Expo Go / React Native.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) {
          loadUserData(session.user.id);
        } else {
          reset();
        }
      })
      .catch(() => reset());

    // SECONDARY: onAuthStateChange handles future SIGNED_IN / SIGNED_OUT events
    // (e.g. after the user submits the login form or presses logout).
    // We intentionally skip INITIAL_SESSION here to avoid duplicate loadUserData
    // calls with the same userId — getSession() above already handles that case.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') {
          setSession(session);
          if (session?.user) loadUserData(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          reset();
        } else if (event === 'TOKEN_REFRESHED') {
          setSession(session);
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Redirect guard — runs whenever session, isInitialized, or the route changes.
  // session is a reactive selector above, so this effect fires immediately
  // after a successful login or logout.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[1] === '(auth)';

    if (!session && !inAuthGroup) {
      // No session and not on an auth screen → go to login
      router.replace('/app/(auth)/login' as never);
    } else if (session && inAuthGroup) {
      // Session exists but still on an auth screen → go to main app
      router.replace('/app/(tabs)' as never);
    }
  // router is stable in expo-router; omitting it avoids infinite loops.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, session, segments]);

  // Always render the Stack so expo-router's navigation tree is available
  // immediately. The spinner overlays on top while auth is being resolved,
  // preventing any flash of protected content.
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="app" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>

      {!isInitialized && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

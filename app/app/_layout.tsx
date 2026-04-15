import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { Colors, PRIMARY } from '@/constants/theme';

export default function AppLayout() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <Stack
      screenOptions={{
        // Default: show header with back button for all screens
        headerShown: true,
        headerBackTitle: 'Atrás',
        headerTintColor: PRIMARY,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontSize: 16, fontWeight: '600' },
      }}
    >
      {/* (auth) group is fully managed by (auth)/_layout.tsx */}

      {/* Tab screens – no header (tab layout handles its own header) */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Athletes stack – header managed by athletes/_layout.tsx */}
      <Stack.Screen name="athletes" options={{ headerShown: false }} />

      {/* Ticket detail */}
      <Stack.Screen
        name="tickets/[id]"
        options={{ title: 'Detalle del ticket', headerBackTitle: 'Tickets' }}
      />

      {/* Create ticket */}
      <Stack.Screen
        name="tickets/create"
        options={{ title: 'Nuevo ticket', headerBackTitle: 'Tickets' }}
      />

      {/* Protocols list */}
      <Stack.Screen
        name="protocols"
        options={{ title: 'Protocolos', headerBackTitle: 'Inicio' }}
      />
    </Stack>
  );
}

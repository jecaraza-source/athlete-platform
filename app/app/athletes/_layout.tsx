import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { Colors, PRIMARY } from '@/constants/theme';

export default function AthletesLayout() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <Stack
      screenOptions={{
        headerTintColor: PRIMARY,
        headerBackTitle: 'Atletas',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontSize: 16, fontWeight: '600' },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: 'Detalle del atleta' }} />
    </Stack>
  );
}

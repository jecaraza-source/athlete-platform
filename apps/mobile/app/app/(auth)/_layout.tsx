import { Stack } from 'expo-router';
import { PRIMARY } from '@/constants/theme';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Reset-password is reached via deep link — show a minimal back header */}
      <Stack.Screen
        name="reset-password"
        options={{ headerShown: true, title: 'Nueva contraseña', headerTintColor: PRIMARY }}
      />
    </Stack>
  );
}

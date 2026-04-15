import { Stack } from 'expo-router';

// No header on any auth screen — login is the entry point.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

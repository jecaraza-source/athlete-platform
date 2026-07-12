import { Redirect } from 'expo-router';

/**
 * Root index: redirect to the main app section.
 * The auth guard in app/_layout.tsx will redirect to the login screen
 * if there is no active session.
 */
export default function RootIndex() {
  return <Redirect href="/app/(tabs)" />;
}

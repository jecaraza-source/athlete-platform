import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { PRIMARY } from '@/constants/theme';

export function Loading({ fullScreen = false }: { fullScreen?: boolean }) {
  if (fullScreen) {
    return (
      <View style={styles.full}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }
  return <ActivityIndicator size="small" color={PRIMARY} style={styles.inline} />;
}

const styles = StyleSheet.create({
  full: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  inline: { padding: 16 },
});

import { View, Text, StyleSheet } from 'react-native';

type EmptyViewProps = {
  title: string;
  subtitle?: string;
};

export function EmptyView({ title, subtitle }: EmptyViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 16, fontWeight: '600', color: '#64748b', textAlign: 'center' },
  subtitle: { marginTop: 6, fontSize: 13, color: '#94a3b8', textAlign: 'center' },
});

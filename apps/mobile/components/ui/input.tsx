import { View, Text, TextInput, StyleSheet, TextInputProps, useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, style, ...props }: InputProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <View style={styles.wrapper}>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: scheme === 'dark' ? '#1e2022' : '#f8fafc',
            color: colors.text,
            borderColor: error ? '#dc2626' : scheme === 'dark' ? '#374151' : '#e2e8f0',
          },
          style,
        ]}
        placeholderTextColor={colors.icon}
        autoCapitalize="none"
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  error: { marginTop: 4, fontSize: 12, color: '#dc2626' },
});

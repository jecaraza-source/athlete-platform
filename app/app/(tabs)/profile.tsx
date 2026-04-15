import {
  View, Text, ScrollView, StyleSheet, useColorScheme, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, PRIMARY } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store';
import { deactivateDeviceTokens } from '@/services/push';

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { profile, roles, signOut, fullName } = useAuthStore();

  async function handleSignOut() {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            if (profile) await deactivateDeviceTokens(profile.id);
            await signOut();
          },
        },
      ]
    );
  }

  const initials = fullName()
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: PRIMARY }]}>
            <Text style={styles.initials}>{initials || '?'}</Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{fullName() || 'Usuario'}</Text>
          {profile?.email && (
            <Text style={[styles.email, { color: colors.icon }]}>{profile.email}</Text>
          )}
        </View>

        {/* Roles */}
        {roles.length > 0 && (
          <Card style={styles.card}>
            <Text style={[styles.cardTitle, { color: colors.icon }]}>Rol(es)</Text>
            {roles.map((r) => (
              <View key={r.id} style={styles.roleRow}>
                <View style={[styles.roleTag, { backgroundColor: PRIMARY + '18' }]}>
                  <Text style={[styles.roleText, { color: PRIMARY }]}>{r.name}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Info */}
        {profile && (
          <Card style={styles.card}>
            <Text style={[styles.cardTitle, { color: colors.icon }]}>Información</Text>
            {[
              { label: 'Nombre', value: fullName() },
              { label: 'Correo', value: profile.email },
            ].map((row) => row.value ? (
              <View key={row.label} style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.icon }]}>{row.label}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{row.value}</Text>
              </View>
            ) : null)}
          </Card>
        )}

        <Button
          label="Cerrar sesión"
          onPress={handleSignOut}
          variant="danger"
          style={styles.signOutBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  initials: { fontSize: 30, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  email: { fontSize: 13 },
  card: { marginBottom: 14 },
  cardTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  roleRow: { marginBottom: 4 },
  roleTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleText: { fontSize: 13, fontWeight: '600' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '500' },
  signOutBtn: { marginTop: 8 },
});

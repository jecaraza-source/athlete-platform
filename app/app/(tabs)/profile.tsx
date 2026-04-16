import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme,
  Alert, TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store';
import { deactivateDeviceTokens } from '@/services/push';
import {
  uploadMobileAvatar,
  deleteMobileAvatar,
  getCacheBustedUrl,
} from '@/services/avatar';

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { profile, roles, signOut, fullName, session } = useAuthStore();

  // Local avatar URL state so the UI updates immediately after upload
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile?.avatar_url ?? null
  );
  const [uploading, setUploading] = useState(false);

  // ── Avatar change handler ─────────────────────────────────────────────
  async function handleChangePhoto() {
    if (!profile || !session?.user?.id) return;

    // Lazy-load expo-image-picker so it's never evaluated in Expo Go builds
    // where camera/photo-library permissions aren't configured.
    let ImagePicker: typeof import('expo-image-picker');
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ImagePicker = require('expo-image-picker');
    } catch {
      Alert.alert('Error', 'expo-image-picker no está disponible en este entorno.');
      return;
    }

    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso necesario',
        'Necesitamos acceso a tu galería para cambiar la foto de perfil.',
      );
      return;
    }

    Alert.alert(
      'Foto de perfil',
      '¿Cómo quieres seleccionar la foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Galería',
          onPress: () => pickImage(ImagePicker, profile.id, session.user.id, false),
        },
        {
          text: 'Cámara',
          onPress: () => pickImage(ImagePicker, profile.id, session.user.id, true),
        },
        ...(avatarUrl
          ? [{
              text: 'Eliminar foto',
              style: 'destructive' as const,
              onPress: () => handleDeletePhoto(),
            }]
          : []),
      ],
    );
  }

  async function pickImage(
    ImagePicker: typeof import('expo-image-picker'),
    profileId: string,
    authUserId: string,
    useCamera: boolean,
  ) {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (perm.status !== 'granted') {
      Alert.alert('Permiso denegado', 'Habilita el permiso en Ajustes del dispositivo.');
      return;
    }

    const pickerResult = await (useCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync
    )({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],   // square crop
      quality: 0.7,     // compress to ~70% quality
      base64: true,     // include base64 data to avoid file URI access issues on Android
    });

    if (pickerResult.canceled || !pickerResult.assets?.[0]) return;

    const asset = pickerResult.assets[0];

    if (!asset.base64) {
      Alert.alert('Error', 'No se pudo obtener los datos de la imagen.');
      return;
    }

    // Optimistic UI: show the local preview immediately
    setAvatarUrl(asset.uri);
    setUploading(true);

    const uploadResult = await uploadMobileAvatar(asset.base64, authUserId, profileId);
    setUploading(false);

    if (uploadResult.url) {
      setAvatarUrl(getCacheBustedUrl(uploadResult.url));
    } else {
      Alert.alert(
        'Error al subir la foto',
        uploadResult.error || 'No se pudo subir la foto. Intenta de nuevo.',
      );
      setAvatarUrl(profile?.avatar_url ?? null); // revert to previous
    }
  }

  async function handleDeletePhoto() {
    if (!profile || !session?.user?.id) return;
    setUploading(true);
    const ok = await deleteMobileAvatar(session.user.id, profile.id);
    setUploading(false);
    if (ok) {
      setAvatarUrl(null);
    } else {
      Alert.alert('Error', 'No se pudo eliminar la foto.');
    }
  }

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
        {/* Avatar + upload button */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={handleChangePhoto}
            disabled={uploading}
            style={styles.avatarWrap}
            activeOpacity={0.8}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImg}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: PRIMARY }]}>
                <Text style={styles.initials}>{initials || '?'}</Text>
              </View>
            )}

            {/* Camera icon badge */}
            {!uploading && (
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            )}

            {/* Upload spinner */}
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </TouchableOpacity>

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
  // Wraps both the image/initials circle and the overlays
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImg: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#e2e8f0',
  },
  // Camera icon badge (bottom-right)
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: PRIMARY,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  // Semi-transparent spinner overlay while uploading
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 44,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
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

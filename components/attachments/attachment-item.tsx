import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking, useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY } from '@/constants/theme';
import { getAttachmentSignedUrl, formatFileSize, type AthleteAttachment } from '@/services/attachments';

// ---------------------------------------------------------------------------
// MIME → icon / colour mapping
// ---------------------------------------------------------------------------

type IconConfig = { name: keyof typeof Ionicons.glyphMap; color: string; bg: string };

function getIconConfig(mimeType: string): IconConfig {
  if (mimeType === 'application/pdf') {
    return { name: 'document-text-outline', color: '#dc2626', bg: '#fee2e2' };
  }
  if (mimeType.startsWith('image/')) {
    return { name: 'image-outline', color: '#7c3aed', bg: '#f3e8ff' };
  }
  if (mimeType.startsWith('video/')) {
    return { name: 'videocam-outline', color: '#0369a1', bg: '#e0f2fe' };
  }
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv')
  ) {
    return { name: 'grid-outline', color: '#15803d', bg: '#dcfce7' };
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return { name: 'document-outline', color: '#1d4ed8', bg: '#dbeafe' };
  }
  return { name: 'attach-outline', color: '#64748b', bg: '#f1f5f9' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  attachment: AthleteAttachment;
};

export function AttachmentItem({ attachment }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const icon   = getIconConfig(attachment.mime_type);

  const [opening, setOpening] = useState(false);

  async function handleOpen() {
    setOpening(true);
    try {
      const url = await getAttachmentSignedUrl(attachment.file_path);
      if (!url) {
        Alert.alert('Error', 'No se pudo obtener el enlace del archivo. Inténtalo de nuevo.');
        return;
      }
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'No se puede abrir este tipo de archivo en este dispositivo.');
      }
    } catch {
      Alert.alert('Error', 'Ocurrió un error al intentar abrir el archivo.');
    } finally {
      setOpening(false);
    }
  }

  const uploadedDate = new Date(attachment.uploaded_at).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const sizeMeta = formatFileSize(attachment.file_size);

  return (
    <TouchableOpacity
      onPress={handleOpen}
      disabled={opening}
      activeOpacity={0.75}
      style={[
        styles.container,
        { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff' },
      ]}
    >
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
        <Ionicons name={icon.name} size={20} color={icon.color} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text
          style={[styles.name, { color: colors.text }]}
          numberOfLines={1}
        >
          {attachment.file_name_original}
        </Text>
        <Text style={[styles.meta, { color: colors.icon }]}>
          {uploadedDate}
          {sizeMeta ? ` · ${sizeMeta}` : ''}
          {attachment.description ? ` · ${attachment.description}` : ''}
        </Text>
      </View>

      {/* Open indicator */}
      {opening ? (
        <ActivityIndicator size="small" color={PRIMARY} />
      ) : (
        <Ionicons name="open-outline" size={18} color={PRIMARY} />
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  meta: {
    fontSize: 11,
  },
});

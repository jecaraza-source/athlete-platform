import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  useColorScheme, RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY } from '@/constants/theme';
import { Loading } from '@/components/ui/loading';
import { listProtocols, getProtocolSignedUrl, type Protocol, type DisciplineKey } from '@/services/protocols';

// ---------------------------------------------------------------------------
// Discipline metadata
// ---------------------------------------------------------------------------

type DisciplineMeta = {
  label:   string;
  icon:    keyof typeof Ionicons.glyphMap;
  bg:      string;
  text:    string;
  border:  string;
};

const DISCIPLINE_META: Record<DisciplineKey, DisciplineMeta> = {
  coach:      { label: 'Entrenador',   icon: 'barbell-outline',     bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  physio:     { label: 'Fisioterapia', icon: 'body-outline',        bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  medic:      { label: 'Médico',       icon: 'medical-outline',     bg: '#fff1f2', text: '#be123c', border: '#fecdd3' },
  nutrition:  { label: 'Nutrición',    icon: 'nutrition-outline',   bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  psychology: { label: 'Psicología',   icon: 'happy-outline',       bg: '#faf5ff', text: '#7c3aed', border: '#e9d5ff' },
};

const ALL_DISCIPLINES: DisciplineKey[] = ['coach', 'physio', 'medic', 'nutrition', 'psychology'];

// ---------------------------------------------------------------------------
// Protocol card
// ---------------------------------------------------------------------------

function ProtocolCard({
  discipline,
  protocol,
}: {
  discipline: DisciplineKey;
  protocol:   Protocol | null;
}) {
  const scheme  = useColorScheme() ?? 'light';
  const colors  = Colors[scheme];
  const meta    = DISCIPLINE_META[discipline];
  const [opening, setOpening] = useState(false);

  async function handleOpen() {
    if (!protocol) return;
    setOpening(true);
    try {
      const url = await getProtocolSignedUrl(protocol.file_path);
      if (!url) {
        Alert.alert('Error', 'No se pudo obtener el enlace del archivo. Intenta de nuevo.');
        return;
      }
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } catch (e) {
      Alert.alert('Error', 'No se pudo abrir el protocolo.');
      console.warn('[protocols] open error:', e);
    } finally {
      setOpening(false);
    }
  }

  const updatedDate = protocol
    ? new Date(protocol.updated_at).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : null;

  return (
    <TouchableOpacity
      onPress={protocol ? handleOpen : undefined}
      activeOpacity={protocol ? 0.75 : 1}
      style={[
        styles.card,
        {
          backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff',
          borderLeftColor: meta.border,
        },
      ]}
    >
      {/* Icon + label */}
      <View style={styles.cardLeft}>
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={20} color={meta.text} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardLabel, { color: colors.text }]}>{meta.label}</Text>
          {protocol ? (
            <Text style={[styles.cardMeta, { color: colors.icon }]} numberOfLines={1}>
              {protocol.file_name}
              {protocol.version ? ` · v${protocol.version}` : ''}
              {updatedDate ? ` · ${updatedDate}` : ''}
            </Text>
          ) : (
            <Text style={[styles.cardEmpty, { color: colors.icon }]}>
              Sin protocolo disponible
            </Text>
          )}
        </View>
      </View>

      {/* Right side */}
      {protocol && (
        opening ? (
          <ActivityIndicator size="small" color={PRIMARY} />
        ) : (
          <View style={[styles.openBtn, { backgroundColor: meta.bg }]}>
            <Ionicons name="document-text-outline" size={14} color={meta.text} />
            <Text style={[styles.openBtnText, { color: meta.text }]}>Abrir</Text>
          </View>
        )
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ProtocolsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [protocols, setProtocols]   = useState<Protocol[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await listProtocols();
      setProtocols(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  // Build a map for quick lookup
  const protocolMap = Object.fromEntries(protocols.map((p) => [p.discipline, p]));

  if (loading) return <Loading fullScreen />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={[styles.header, { color: colors.text }]}>Protocolos del equipo</Text>
        <Text style={[styles.subheader, { color: colors.icon }]}>
          Toca una disciplina para ver o descargar su protocolo.
        </Text>

        <View style={styles.list}>
          {ALL_DISCIPLINES.map((disc) => (
            <ProtocolCard
              key={disc}
              discipline={disc}
              protocol={(protocolMap[disc] as Protocol | undefined) ?? null}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1 },
  container:  { padding: 20, paddingBottom: 40 },
  header:     { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subheader:  { fontSize: 13, marginBottom: 20 },
  list:       { gap: 12 },

  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 12, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  cardLeft:   { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  iconWrap:   { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardInfo:   { flex: 1 },
  cardLabel:  { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  cardMeta:   { fontSize: 11 },
  cardEmpty:  { fontSize: 11, fontStyle: 'italic' },

  openBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  openBtnText: { fontSize: 12, fontWeight: '600' },
});

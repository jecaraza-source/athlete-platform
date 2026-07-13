import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store';
import { useNewsletterStore } from '@/store/newsletterStore';
import { Loading } from '@/components/ui/loading';
import { Colors, PRIMARY } from '@/constants/theme';

export default function NewsletterScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();

  const { isAthlete } = useAuthStore();
  const { latestNewsletter, isLoading, fetchLatestIfStale } = useNewsletterStore();

  const audiencia = isAthlete() ? 'atleta' : 'coach';

  useEffect(() => {
    // Always check staleness when the newsletter screen is opened.
    fetchLatestIfStale(audiencia);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading && !latestNewsletter) {
    return <Loading fullScreen />;
  }

  if (!latestNewsletter) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Ionicons name="mail-outline" size={48} color={colors.icon} />
        <Text style={[styles.emptyText, { color: colors.icon }]}>
          No hay newsletters disponibles todavía.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Subject header */}
      <View style={[styles.subjectBar, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#f8fafc', borderBottomColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}>
        <Text style={[styles.subject, { color: colors.text }]} numberOfLines={2}>
          {latestNewsletter.asunto}
        </Text>
      </View>

      {/* Email HTML via WebView */}
      <WebView
        source={{ html: latestNewsletter.html_content }}
        style={styles.flex}
        originWhitelist={['*']}
        showsVerticalScrollIndicator
        scalesPageToFit={false}
        javaScriptEnabled={false}
      />

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#fff', borderTopColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}>
        <TouchableOpacity
          style={[styles.histBtn, { borderColor: PRIMARY }]}
          onPress={() => router.push('/app/newsletter/historial' as never)}
          activeOpacity={0.8}
        >
          <Ionicons name="time-outline" size={16} color={PRIMARY} />
          <Text style={[styles.histBtnText, { color: PRIMARY }]}>Ver historial</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex:    { flex: 1 },
  empty:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { fontSize: 15, textAlign: 'center' },

  subjectBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  subject: { fontSize: 15, fontWeight: '600', lineHeight: 20 },

  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  histBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  histBtnText: { fontSize: 14, fontWeight: '600' },
});

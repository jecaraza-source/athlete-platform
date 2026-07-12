import { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store';
import { useNewsletterStore } from '@/store/newsletterStore';
import { Colors, PRIMARY } from '@/constants/theme';

// Brand red for the newsletter accent
const NEWSLETTER_RED = '#C0172C';

const STAFF_ROLES = new Set([
  'super_admin', 'admin', 'coach', 'staff',
  'program_director', 'event_coordinator',
  'medic', 'physio', 'psychologist', 'nutritionist',
]);

export default function NewsletterCard() {
  const router  = useRouter();
  const scheme  = useColorScheme() ?? 'light';
  const colors  = Colors[scheme];

  const { roles, isAthlete, isAdmin } = useAuthStore();
  const {
    latestNewsletter,
    pendingCount,
    isLoading,
    fetchLatest,
    fetchPendingCount,
  } = useNewsletterStore();

  const isStaffRole = roles.some((r) => STAFF_ROLES.has(r.code));
  const isAdminRole = isAdmin();
  const audiencia   = isAthlete() ? 'atleta' : 'coach';

  useEffect(() => {
    fetchLatest(audiencia);
    if (isAdminRole) fetchPendingCount();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audiencia, isAdminRole]);

  // Don't render if loading without data (avoid flash) or no newsletter yet
  if (!latestNewsletter) return null;

  const tips = latestNewsletter.tips_json ?? [];

  const sentRelative = latestNewsletter.sent_at
    ? (() => {
        const diffH = Math.floor(
          (Date.now() - new Date(latestNewsletter.sent_at!).getTime()) / 3_600_000
        );
        if (diffH < 1)  return 'hace menos de 1h';
        if (diffH < 24) return `hace ${diffH}h`;
        const diffD = Math.floor(diffH / 24);
        return `hace ${diffD}d`;
      })()
    : null;

  const bg = scheme === 'dark' ? '#1e2022' : '#f0fdf4';

  return (
    <View style={[styles.wrapper, { backgroundColor: bg }]}>
      {/* Admin pending banner */}
      {isAdminRole && pendingCount > 0 && (
        <TouchableOpacity
          onPress={() => router.push('/app/newsletter' as never)}
          style={styles.pendingBanner}
          activeOpacity={0.8}
        >
          <Ionicons name="warning-outline" size={14} color="#92400e" />
          <Text style={styles.pendingText}>
            {pendingCount} newsletter{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de aprobación
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#92400e" />
        </TouchableOpacity>
      )}

      {/* Card header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel}>📰 Newsletter de hoy</Text>
        </View>
        {sentRelative && (
          <Text style={[styles.headerDate, { color: colors.icon }]}>{sentRelative}</Text>
        )}
      </View>

      {/* Subject */}
      <Text style={[styles.subject, { color: colors.text }]} numberOfLines={2}>
        {latestNewsletter.asunto}
      </Text>

      {/* Intro */}
      {latestNewsletter.intro && (
        <Text style={[styles.intro, { color: colors.icon }]} numberOfLines={2}>
          {latestNewsletter.intro}
        </Text>
      )}

      {/* Tips preview */}
      {tips.length > 0 && (
        <View style={styles.tips}>
          {tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={styles.tipEmoji}>{tip.emoji}</Text>
              <Text style={[styles.tipTitle, { color: colors.text }]} numberOfLines={1}>
                {tip.titulo}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity
        onPress={() => router.push('/app/newsletter' as never)}
        style={[styles.cta, { backgroundColor: PRIMARY }]}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaText}>Leer newsletter completo</Text>
        <Ionicons name="chevron-forward" size={16} color="#fff" />
      </TouchableOpacity>

      {/* Historial link */}
      <TouchableOpacity
        onPress={() => router.push('/app/newsletter/historial' as never)}
        style={styles.historialBtn}
        activeOpacity={0.7}
      >
        <Text style={[styles.historialText, { color: PRIMARY }]}>Ver historial →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(21,128,61,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Pending banner
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  pendingText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLabel: { fontSize: 11, fontWeight: '700', color: '#15803d', letterSpacing: 0.5 },
  headerDate:  { fontSize: 11 },

  // Content
  subject: { fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 6 },
  intro:   { fontSize: 13, lineHeight: 18, marginBottom: 10 },

  // Tips
  tips: { marginBottom: 14, gap: 5 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipEmoji: { fontSize: 15 },
  tipTitle: { fontSize: 13, fontWeight: '600', flex: 1 },

  // CTA
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 11,
    marginBottom: 8,
  },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Historial
  historialBtn: { alignItems: 'center', paddingVertical: 4 },
  historialText: { fontSize: 13, fontWeight: '600' },
});

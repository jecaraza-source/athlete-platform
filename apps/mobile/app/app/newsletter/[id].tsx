import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { supabase } from '@/lib/supabase';
import { Loading } from '@/components/ui/loading';
import { Colors } from '@/constants/theme';
import type { NewsletterItem } from '@/store/newsletterStore';

export default function NewsletterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme  = useColorScheme() ?? 'light';
  const colors  = Colors[scheme];

  const [newsletter, setNewsletter] = useState<NewsletterItem | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('newsletter_drafts')
          .select(
            'id, audiencia, asunto, preview_text, intro, tips_json, html_content, sent_at, recipient_count, created_at'
          )
          .eq('id', id)
          .eq('status', 'sent')
          .maybeSingle();

        setNewsletter((data as NewsletterItem) ?? null);
      } catch {
        setNewsletter(null);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  if (loading) return <Loading fullScreen />;

  if (!newsletter) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.icon }]}>
          Newsletter no encontrado.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Subject bar */}
      <View style={[styles.subjectBar, { backgroundColor: scheme === 'dark' ? '#1e2022' : '#f8fafc', borderBottomColor: scheme === 'dark' ? '#374151' : '#e2e8f0' }]}>
        <Text style={[styles.subject, { color: colors.text }]} numberOfLines={2}>
          {newsletter.asunto}
        </Text>
        {newsletter.sent_at && (
          <Text style={[styles.date, { color: colors.icon }]}>
            {new Date(newsletter.sent_at).toLocaleDateString('es-MX', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </Text>
        )}
      </View>

      <WebView
        source={{ html: newsletter.html_content }}
        style={styles.flex}
        originWhitelist={['*']}
        showsVerticalScrollIndicator
        scalesPageToFit={false}
        javaScriptEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex:       { flex: 1 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText:  { fontSize: 15, textAlign: 'center' },

  subjectBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  subject: { fontSize: 15, fontWeight: '600', lineHeight: 20, marginBottom: 2 },
  date:    { fontSize: 11 },
});

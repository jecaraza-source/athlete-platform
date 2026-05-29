// =============================================================================
// store/newsletterStore.ts
// Zustand store for the newsletter feature.
// Queries newsletter_drafts directly (subject to RLS — anon key + user session).
// =============================================================================

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NewsletterItem = {
  id:             string;
  audiencia:      'atleta' | 'coach' | 'all';
  asunto:         string;
  preview_text:   string | null;
  intro:          string | null;
  tips_json:      Array<{ emoji: string; categoria: string; titulo: string; contenido: string }>;
  html_content:   string;
  sent_at:        string | null;
  recipient_count: number;
  created_at:     string;
};

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type NewsletterState = {
  latestNewsletter:   NewsletterItem | null;
  history:            NewsletterItem[];
  pendingCount:       number;
  isLoading:          boolean;
  historyLoaded:      boolean;
  hasMore:            boolean;
  currentPage:        number;

  // Actions
  fetchLatest:        (audiencia: 'atleta' | 'coach' | 'all') => Promise<void>;
  fetchHistory:       (audiencia: 'atleta' | 'coach' | 'all', page?: number) => Promise<void>;
  fetchPendingCount:  () => Promise<void>;
  reset:              () => void;
};

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useNewsletterStore = create<NewsletterState>((set, get) => ({
  latestNewsletter:  null,
  history:           [],
  pendingCount:      0,
  isLoading:         false,
  historyLoaded:     false,
  hasMore:           false,
  currentPage:       1,

  fetchLatest: async (audiencia) => {
    set({ isLoading: true });
    try {
      const { data } = await supabase
        .from('newsletter_drafts')
        .select(
          'id, audiencia, asunto, preview_text, intro, tips_json, html_content, sent_at, recipient_count, created_at'
        )
        .eq('status', 'sent')
        .in('audiencia', [audiencia, 'all'])
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      set({ latestNewsletter: (data as NewsletterItem) ?? null });
    } catch {
      // Best-effort
    } finally {
      set({ isLoading: false });
    }
  },

  fetchHistory: async (audiencia, page = 1) => {
    const isFirstPage = page === 1;
    set({ isLoading: true });
    try {
      const offset = (page - 1) * PAGE_SIZE;

      const { data, error } = await supabase
        .from('newsletter_drafts')
        .select(
          'id, audiencia, asunto, preview_text, intro, tips_json, html_content, sent_at, recipient_count, created_at'
        )
        .eq('status', 'sent')
        .in('audiencia', [audiencia, 'all'])
        .order('sent_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error || !data) return;

      set((state) => ({
        history:       isFirstPage ? (data as NewsletterItem[]) : [...state.history, ...(data as NewsletterItem[])],
        historyLoaded: true,
        hasMore:       data.length === PAGE_SIZE,
        currentPage:   page,
      }));
    } catch {
      // Best-effort
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPendingCount: async () => {
    try {
      const { count } = await supabase
        .from('newsletter_drafts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      set({ pendingCount: count ?? 0 });
    } catch {
      // Best-effort
    }
  },

  reset: () =>
    set({
      latestNewsletter:  null,
      history:           [],
      pendingCount:      0,
      isLoading:         false,
      historyLoaded:     false,
      hasMore:           false,
      currentPage:       1,
    }),
}));

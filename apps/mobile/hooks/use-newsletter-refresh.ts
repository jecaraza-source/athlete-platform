/**
 * hooks/use-newsletter-refresh.ts
 *
 * Keeps the newsletter fresh by re-fetching whenever:
 *   1. The user opens the app cold (first mount after auth is ready).
 *   2. The app comes to the foreground from the background/inactive state.
 *
 * The actual staleness logic lives in `fetchLatestIfStale` (newsletterStore):
 *   - different calendar day   → always re-fetch
 *   - same day, >60 min old    → re-fetch (catches same-day newsletter updates)
 *   - same day, ≤60 min old   → use cached data, skip network call
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/store';
import { useNewsletterStore } from '@/store/newsletterStore';

export function useNewsletterRefresh() {
  const appState     = useRef<AppStateStatus>(AppState.currentState);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const session       = useAuthStore((s) => s.session);
  // Read isAthlete as a stable selector (not the function itself) to avoid
  // re-creating the AppState subscription on every render.
  const isAthleteRole = useAuthStore((s) => s.roles.some((r) => r.code === 'athlete'));

  const { fetchLatestIfStale } = useNewsletterStore();

  useEffect(() => {
    // Don't do anything until auth is resolved and a session exists.
    if (!isInitialized || !session) return;

    const audiencia = isAthleteRole ? 'atleta' : 'coach';

    // ── 1. Fetch on first mount (cold open or login) ──────────────────────
    fetchLatestIfStale(audiencia);

    // ── 2. Re-fetch when the app comes back to the foreground ─────────────
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const wasBackground =
          appState.current === 'background' ||
          appState.current === 'inactive';

        if (wasBackground && nextState === 'active') {
          fetchLatestIfStale(audiencia);
        }

        appState.current = nextState;
      }
    );

    return () => subscription.remove();
  // Re-subscribe when the user's role or session changes (e.g. after login).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, session?.user?.id, isAthleteRole]);
}

/**
 * Unit tests for store/auth-store.ts
 *
 * Strategy:
 * - The Supabase client is fully mocked.
 * - The Zustand store is reset to a known initial state between tests by
 *   calling useAuthStore.setState() directly — no UI or React rendering needed.
 * - Helper selectors (hasRole, hasPermission, isStaff, isAthlete, etc.) are
 *   tested by setting state directly and calling the getter functions.
 * - loadUserData is tested end-to-end against mocked DB responses.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeChain } from '../helpers';

// ---------------------------------------------------------------------------
// Mocks (hoisted before any imports)
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(),
  },
}));

import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COACH_ROLE = {
  id: 3,
  code: 'coach',
  name: 'Coach',
  description: 'Entrenador',
  is_system: true,
  created_at: '2024-01-01T00:00:00Z',
};

const ATHLETE_ROLE = {
  id: 8,
  code: 'athlete',
  name: 'Athlete',
  description: 'Atleta',
  is_system: true,
  created_at: '2024-01-01T00:00:00Z',
};

const ADMIN_ROLE = {
  id: 2,
  code: 'program_director',
  name: 'Program Director',
  description: null,
  is_system: true,
  created_at: '2024-01-01T00:00:00Z',
};

const COACH_PROFILE = {
  id: 'profile-coach-001',
  first_name: 'Luis',
  last_name: 'Rodríguez',
  email: 'luis@example.com',
  role: 'coach',
  auth_user_id: 'auth-coach-001',
  avatar_url: null,
};

const ATHLETE_PROFILE = {
  id: 'profile-athlete-001',
  first_name: 'Ana',
  last_name: 'García',
  email: 'ana@example.com',
  role: 'athlete',
  auth_user_id: 'auth-athlete-001',
  avatar_url: null,
};

/** DB row shape returned by the user_roles join */
const makeUserRoleRow = (role: typeof COACH_ROLE) => ({ role });

// ---------------------------------------------------------------------------
// Reset store + mocks before each test
// ---------------------------------------------------------------------------

const INITIAL_STATE = {
  session: null,
  profile: null,
  roles: [],
  permissions: new Set<string>(),
  athleteId: null,
  isLoading: false,
  isInitialized: false,
};

beforeEach(() => {
  useAuthStore.setState(INITIAL_STATE);
  vi.clearAllMocks();
});

// ===========================================================================
// Initial state
// ===========================================================================

describe('initial state', () => {
  it('starts with no session, profile, or roles', () => {
    const s = useAuthStore.getState();
    expect(s.session).toBeNull();
    expect(s.profile).toBeNull();
    expect(s.roles).toEqual([]);
    expect(s.permissions.size).toBe(0);
    expect(s.athleteId).toBeNull();
    expect(s.isLoading).toBe(false);
    expect(s.isInitialized).toBe(false);
  });
});

// ===========================================================================
// Helper selectors (pure reads from store state)
// ===========================================================================

describe('hasRole', () => {
  it('returns false when no roles are loaded', () => {
    expect(useAuthStore.getState().hasRole('coach')).toBe(false);
  });

  it('returns true when the role is present', () => {
    useAuthStore.setState({ roles: [COACH_ROLE] });
    expect(useAuthStore.getState().hasRole('coach')).toBe(true);
  });

  it('returns false for a role that is not in the list', () => {
    useAuthStore.setState({ roles: [COACH_ROLE] });
    expect(useAuthStore.getState().hasRole('athlete')).toBe(false);
  });
});

describe('hasPermission', () => {
  it('returns false when permissions set is empty', () => {
    expect(useAuthStore.getState().hasPermission('view_athletes')).toBe(false);
  });

  it('returns true when the permission is present', () => {
    useAuthStore.setState({ permissions: new Set(['view_athletes', 'edit_athletes']) });
    expect(useAuthStore.getState().hasPermission('view_athletes')).toBe(true);
    expect(useAuthStore.getState().hasPermission('edit_athletes')).toBe(true);
  });

  it('returns false for a permission not in the set', () => {
    useAuthStore.setState({ permissions: new Set(['view_athletes']) });
    expect(useAuthStore.getState().hasPermission('delete_athletes')).toBe(false);
  });
});

describe('isStaff / isAthlete / isAdmin', () => {
  it('isStaff returns true for coach role', () => {
    useAuthStore.setState({ roles: [COACH_ROLE] });
    expect(useAuthStore.getState().isStaff()).toBe(true);
  });

  it('isStaff returns false for athlete role', () => {
    useAuthStore.setState({ roles: [ATHLETE_ROLE] });
    expect(useAuthStore.getState().isStaff()).toBe(false);
  });

  it('isAthlete returns true for athlete role', () => {
    useAuthStore.setState({ roles: [ATHLETE_ROLE] });
    expect(useAuthStore.getState().isAthlete()).toBe(true);
  });

  it('isAthlete returns false for coach role', () => {
    useAuthStore.setState({ roles: [COACH_ROLE] });
    expect(useAuthStore.getState().isAthlete()).toBe(false);
  });

  it('isAdmin returns true for program_director', () => {
    useAuthStore.setState({ roles: [ADMIN_ROLE] });
    expect(useAuthStore.getState().isAdmin()).toBe(true);
  });

  it('isAdmin returns false for coach', () => {
    useAuthStore.setState({ roles: [COACH_ROLE] });
    expect(useAuthStore.getState().isAdmin()).toBe(false);
  });
});

describe('fullName', () => {
  it('returns empty string when no profile is loaded', () => {
    expect(useAuthStore.getState().fullName()).toBe('');
  });

  it('concatenates first and last name', () => {
    useAuthStore.setState({ profile: COACH_PROFILE });
    expect(useAuthStore.getState().fullName()).toBe('Luis Rodríguez');
  });

  it('trims when one name part is missing', () => {
    useAuthStore.setState({
      profile: { ...COACH_PROFILE, last_name: '' },
    });
    expect(useAuthStore.getState().fullName()).toBe('Luis');
  });
});

// ===========================================================================
// reset
// ===========================================================================

describe('reset', () => {
  it('clears session, profile, roles, and permissions', () => {
    useAuthStore.setState({
      session: { user: { id: 'u1' } } as never,
      profile: COACH_PROFILE,
      roles: [COACH_ROLE],
      permissions: new Set(['view_athletes']),
      athleteId: 'ath-001',
      isInitialized: true,
    });

    useAuthStore.getState().reset();

    const s = useAuthStore.getState();
    expect(s.session).toBeNull();
    expect(s.profile).toBeNull();
    expect(s.roles).toEqual([]);
    expect(s.permissions.size).toBe(0);
    expect(s.athleteId).toBeNull();
    // reset() intentionally sets isInitialized = true so the redirect guard fires
    expect(s.isInitialized).toBe(true);
  });
});

// ===========================================================================
// loadUserData
// ===========================================================================

describe('loadUserData', () => {
  it('populates profile, roles, and permissions for a coach user', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeChain({ data: COACH_PROFILE, error: null }) as never;
      }
      if (table === 'user_roles') {
        return makeChain({ data: [makeUserRoleRow(COACH_ROLE)], error: null }) as never;
      }
      if (table === 'role_permissions') {
        return makeChain({
          data: [
            { permission: { name: 'view_athletes' } },
            { permission: { name: 'manage_calendar' } },
          ],
          error: null,
        }) as never;
      }
      return makeChain({ data: [], error: null }) as never;
    });

    await useAuthStore.getState().loadUserData('auth-coach-001');

    const s = useAuthStore.getState();
    expect(s.profile).toMatchObject({ id: 'profile-coach-001', first_name: 'Luis' });
    expect(s.roles).toHaveLength(1);
    expect(s.roles[0].code).toBe('coach');
    expect(s.permissions.has('view_athletes')).toBe(true);
    expect(s.permissions.has('manage_calendar')).toBe(true);
    expect(s.isLoading).toBe(false);
    expect(s.isInitialized).toBe(true);
    expect(s.athleteId).toBeNull(); // coach, not athlete
  });

  it('resolves athleteId for athlete-role users (email lookup)', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeChain({ data: ATHLETE_PROFILE, error: null }) as never;
      }
      if (table === 'user_roles') {
        return makeChain({ data: [makeUserRoleRow(ATHLETE_ROLE)], error: null }) as never;
      }
      if (table === 'role_permissions') {
        return makeChain({ data: [], error: null }) as never;
      }
      if (table === 'athletes') {
        // Primary: email lookup succeeds
        return makeChain({ data: { id: 'ath-ana-001' }, error: null }) as never;
      }
      return makeChain({ data: [], error: null }) as never;
    });

    await useAuthStore.getState().loadUserData('auth-athlete-001');

    expect(useAuthStore.getState().athleteId).toBe('ath-ana-001');
  });

  it('sets isInitialized = true and isLoading = false even when profile is null', async () => {
    vi.mocked(supabase.from).mockImplementation(() =>
      makeChain({ data: null, error: null }) as never
    );

    await useAuthStore.getState().loadUserData('auth-unknown-001');

    const s = useAuthStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.isInitialized).toBe(true);
  });

  it('sets isInitialized = true on unexpected error (does not hang)', async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error('network failure');
    });

    await useAuthStore.getState().loadUserData('auth-any');

    const s = useAuthStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.isInitialized).toBe(true);
  });
});

// ===========================================================================
// signOut
// ===========================================================================

describe('signOut', () => {
  it('calls supabase.auth.signOut and resets state', async () => {
    useAuthStore.setState({
      session: { user: { id: 'u1' } } as never,
      profile: COACH_PROFILE,
      roles: [COACH_ROLE],
      isInitialized: true,
    });

    await useAuthStore.getState().signOut();

    expect(supabase.auth.signOut).toHaveBeenCalledOnce();
    const s = useAuthStore.getState();
    expect(s.session).toBeNull();
    expect(s.profile).toBeNull();
    expect(s.roles).toEqual([]);
  });
});

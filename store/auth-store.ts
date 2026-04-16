import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { ProfileSummary, Role, PermissionName } from '@/types';

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

type AuthState = {
  session: Session | null;
  profile: ProfileSummary | null;
  roles: Role[];
  permissions: Set<string>;
  /**
   * Resolved `athletes.id` for athlete-role users.
   * Populated by loadUserData(); null for staff or while loading.
   * Use this instead of running the email/profile-id lookup on every screen.
   */
  athleteId: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  setSession: (session: Session | null) => void;
  loadUserData: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  reset: () => void;

  // Helpers
  hasRole: (code: string) => boolean;
  hasPermission: (name: PermissionName | string) => boolean;
  isStaff: () => boolean;
  isAthlete: () => boolean;
  isAdmin: () => boolean;
  fullName: () => string;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  roles: [],
  permissions: new Set(),
  athleteId: null,
  isLoading: false,
  isInitialized: false,

  setSession: (session) => set({ session }),

  loadUserData: async (userId: string) => {
    // If data for this exact user is already loaded and fresh, skip.
    const state = get();
    if (state.isInitialized && state.session?.user?.id === userId && state.profile) {
      return;
    }
    // NOTE: we intentionally do NOT guard on state.isLoading here.
    // If a concurrent load is in progress for a *different* user (e.g. after a
    // token refresh), let it proceed and overwrite stale data.

    set({ isLoading: true });
    try {
      // 1. Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, auth_user_id, avatar_url')
        .eq('auth_user_id', userId)
        .maybeSingle();

      // 2. Fetch roles via user_roles join
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role:roles(id, code, name, description, is_system, created_at)')
        .eq('profile_id', profile?.id ?? '');

      const roles: Role[] = (userRoles ?? [])
        .map((r: { role: Role | Role[] }) => (Array.isArray(r.role) ? r.role[0] : r.role))
        .filter(Boolean) as Role[];

      // 3. Fetch permissions for those roles
      const roleIds = roles.map((r) => r.id);
      const permissions = new Set<string>();

      if (roleIds.length > 0) {
        const { data: rolePerms } = await supabase
          .from('role_permissions')
          .select('permission:permissions(name)')
          .in('role_id', roleIds);

        (rolePerms ?? []).forEach((rp: { permission: { name: string } | { name: string }[] }) => {
          const perm = Array.isArray(rp.permission) ? rp.permission[0] : rp.permission;
          if (perm?.name) permissions.add(perm.name);
        });
      }

      // 4. For athlete-role users: resolve their athletes.id once so every
      //    screen can read it from the store instead of re-querying each time.
      let athleteId: string | null = null;
      const hasAthleteRole = roles.some((r) => r.code === 'athlete');
      if (hasAthleteRole && profile) {
        // Primary: match by login email (set in admin → Atletas → Email de acceso móvil)
        if (profile.email) {
          const { data: byEmail } = await supabase
            .from('athletes')
            .select('id')
            .eq('email', profile.email)
            .maybeSingle();
          athleteId = byEmail?.id ?? null;
        }
        // Fallback: match by explicit profile_id link
        if (!athleteId) {
          const { data: byProfileId } = await supabase
            .from('athletes')
            .select('id')
            .eq('profile_id', profile.id)
            .maybeSingle();
          athleteId = byProfileId?.id ?? null;
        }
      }

      set({ profile: profile ?? null, roles, permissions, athleteId, isLoading: false, isInitialized: true });
    } catch {
      set({ isLoading: false, isInitialized: true });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    get().reset();
  },

  reset: () =>
    set({
      session: null,
      profile: null,
      roles: [],
      permissions: new Set(),
      athleteId: null,
      isLoading: false,
      isInitialized: true, // must be true so the auth redirect guard can fire
    }),

  hasRole: (code) => get().roles.some((r) => r.code === code),
  hasPermission: (name) => get().permissions.has(name),
  isStaff: () => {
    const { roles } = get();
    return roles.some((r) =>
      ['super_admin', 'admin', 'coach', 'staff', 'program_director'].includes(r.code)
    );
  },
  isAthlete: () => get().roles.some((r) => r.code === 'athlete'),
  isAdmin: () =>
    get().roles.some((r) =>
      ['super_admin', 'admin', 'program_director'].includes(r.code)
    ),
  fullName: () => {
    const p = get().profile;
    if (!p) return '';
    return `${p.first_name} ${p.last_name}`.trim();
  },
}));

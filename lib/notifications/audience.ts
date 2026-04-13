// =============================================================================
// lib/notifications/audience.ts
// Resolves the final list of recipients (profile_id + email) for a campaign
// based on selection_mode (individual / collective) and audience_type
// (athlete / staff / mixed), with optional filters.
//
// Server-only — uses supabaseAdmin (service role).
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { ResolvedRecipient, SelectionMode, AudienceType, AudienceConfig } from './types';

// ---------------------------------------------------------------------------
// Athlete status / filter constants
// ---------------------------------------------------------------------------

type AthleteFilters = {
  status?: string;
  sport?:  string;
};

type StaffFilters = {
  role?: string;
};

// ---------------------------------------------------------------------------
// Individual resolution
// ---------------------------------------------------------------------------

/**
 * Resolve an explicit list of profile IDs into ResolvedRecipient rows.
 * Skips profiles without an email or with email notifications disabled.
 */
export async function resolveIndividualRecipients(
  profileIds: string[]
): Promise<ResolvedRecipient[]> {
  if (profileIds.length === 0) return [];

  // Fetch profiles
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .in('id', profileIds);

  if (error || !profiles) return [];

  return profiles
    .filter((p) => p.email)
    .map((p) => ({
      profile_id:    p.id,
      email:         p.email!,
      first_name:    p.first_name ?? '',
      last_name:     p.last_name ?? '',
      audience_type: mapProfileRoleToAudienceType(p.role),
    }));
}

// ---------------------------------------------------------------------------
// Collective resolution
// ---------------------------------------------------------------------------

/**
 * Resolve all athletes (with optional filters) as recipients.
 */
export async function resolveAthleteRecipients(
  filters: AthleteFilters = {}
): Promise<ResolvedRecipient[]> {
  let query = supabaseAdmin
    .from('athletes')
    .select('id, first_name, last_name, email, status, sport');

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.sport) {
    query = query.eq('sport', filters.sport);
  }

  const { data: athletes, error } = await query;
  if (error || !athletes) return [];

  return athletes
    .filter((a) => a.email)
    .map((a) => ({
      profile_id:    a.id,
      email:         a.email!,
      first_name:    a.first_name ?? '',
      last_name:     a.last_name ?? '',
      audience_type: 'athlete' as const,
    }));
}

/**
 * Resolve all staff profiles (with optional role filter) as recipients.
 */
export async function resolveStaffRecipients(
  filters: StaffFilters = {}
): Promise<ResolvedRecipient[]> {
  // Staff are profiles that have a non-athlete role via user_roles.
  // We query profiles whose legacy role column or current RBAC role is not 'athlete'.
  let query = supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .neq('role', 'athlete');

  if (filters.role) {
    query = query.eq('role', filters.role);
  }

  const { data: profiles, error } = await query;
  if (error || !profiles) return [];

  return profiles
    .filter((p) => p.email)
    .map((p) => ({
      profile_id:    p.id,
      email:         p.email!,
      first_name:    p.first_name ?? '',
      last_name:     p.last_name ?? '',
      audience_type: 'staff' as const,
    }));
}

// ---------------------------------------------------------------------------
// Unified resolver
// ---------------------------------------------------------------------------

/**
 * Main audience resolver. Dispatches to individual or collective
 * resolution based on the campaign's selection_mode and audience_type.
 *
 * Also applies the channel-level notification preference filter:
 * profiles that have explicitly disabled email are excluded.
 * (Preferences default to enabled when no row exists.)
 */
export async function resolveAudience(params: {
  selection_mode:  SelectionMode;
  audience_type:   AudienceType;
  recipient_ids:   string[];
  audience_config: AudienceConfig;
  channel:         'email' | 'push';
}): Promise<ResolvedRecipient[]> {
  const { selection_mode, audience_type, recipient_ids, audience_config, channel } = params;

  let recipients: ResolvedRecipient[] = [];

  if (selection_mode === 'individual') {
    recipients = await resolveIndividualRecipients(recipient_ids);
  } else {
    // Collective
    const filters = (audience_config.filters ?? {}) as Record<string, string>;

    if (audience_type === 'athlete') {
      recipients = await resolveAthleteRecipients({ status: filters.status, sport: filters.sport });
    } else if (audience_type === 'staff') {
      recipients = await resolveStaffRecipients({ role: filters.role });
    } else {
      // mixed: combine both
      const [athletes, staff] = await Promise.all([
        resolveAthleteRecipients({ status: filters.status }),
        resolveStaffRecipients({ role: filters.role }),
      ]);
      recipients = [...athletes, ...staff];
    }
  }

  // Apply notification preference opt-out filter
  return filterByPreferences(recipients, channel);
}

// ---------------------------------------------------------------------------
// Preference filter
// ---------------------------------------------------------------------------

async function filterByPreferences(
  recipients: ResolvedRecipient[],
  channel:    'email' | 'push'
): Promise<ResolvedRecipient[]> {
  if (recipients.length === 0) return [];

  const profileIds = recipients.map((r) => r.profile_id);

  // Fetch preferences for those profiles on this channel
  const { data: prefs } = await supabaseAdmin
    .from('notification_preferences')
    .select('profile_id, enabled, is_mandatory')
    .in('profile_id', profileIds)
    .eq('channel', channel);

  // Build a lookup: profile_id → {enabled, is_mandatory}
  const prefMap = new Map<string, { enabled: boolean; is_mandatory: boolean }>(
    (prefs ?? []).map((p) => [
      p.profile_id,
      { enabled: p.enabled, is_mandatory: p.is_mandatory },
    ])
  );

  return recipients.filter((r) => {
    const pref = prefMap.get(r.profile_id);
    // No preference row = default enabled
    if (!pref) return true;
    // Mandatory channels cannot be disabled
    if (pref.is_mandatory) return true;
    return pref.enabled;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapProfileRoleToAudienceType(role: string | null): 'athlete' | 'staff' {
  return role === 'athlete' ? 'athlete' : 'staff';
}

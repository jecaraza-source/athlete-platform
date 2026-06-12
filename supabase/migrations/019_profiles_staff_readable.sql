-- =============================================================================
-- 019_profiles_staff_readable.sql
-- Allows authenticated mobile clients to read profiles of staff members.
--
-- Context:
--   The existing "Users can read own profile" policy allows each user to read
--   only their own profile row.  Mobile apps need to populate ticket assignee
--   dropdowns with staff names, which requires reading other users' profiles.
--
-- Strategy:
--   Add a second SELECT policy that exposes profiles of users holding a
--   non-athlete role.  Supabase RLS policies are OR'd together, so a user can
--   read a profile row if ANY applicable policy grants access.
--
--   Athlete profiles remain private (only visible to the athlete themselves
--   and staff/admin, who already have access via this new policy if they also
--   hold a staff role).
-- =============================================================================

-- Allow any authenticated user to read profiles linked to staff-level roles
CREATE POLICY "Staff profiles readable by authenticated users"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT ur.profile_id
      FROM public.user_roles ur
      JOIN public.roles       r ON r.id = ur.role_id
      WHERE r.code IN (
        'super_admin', 'admin', 'coach', 'staff',
        'physio', 'nutritionist', 'psychologist', 'medic',
        'event_coordinator', 'program_director'
      )
    )
  );

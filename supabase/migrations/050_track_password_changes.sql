-- =============================================================================
-- 050_track_password_changes.sql
--
-- Adds per-user password change tracking to support admin bulk-reset of the
-- default password (12345678) while preserving custom passwords set by users.
--
-- Changes:
--   1. profiles.password_changed_at (timestamptz, nullable)
--      NULL  → user still has the default password (never changed it)
--      value → timestamp of the last user-initiated password change
--
--   2. Trigger function public.handle_auth_user_password_change()
--      Fires AFTER UPDATE on auth.users when encrypted_password changes.
--      Critically, it checks auth.uid() = NEW.id to distinguish:
--        - User changing their own password via mobile/web → marks the profile
--        - Admin API (service role) resetting to default  → no-op
--
--   3. Trigger on_auth_user_password_changed on auth.users
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add the tracking column to profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- 2. Trigger function
--    SECURITY DEFINER so it can UPDATE public.profiles even from the auth schema.
--    auth.uid() returns the authenticated user's UUID when called from a regular
--    user session, and NULL when called from the service role (admin API).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_auth_user_password_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  -- Only run when the password hash actually changed
  IF OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password THEN

    -- Safely resolve auth.uid() — may raise an exception in some Supabase
    -- versions when called from the service-role context where request.jwt.claims
    -- is not populated with a user sub.
    BEGIN
      v_uid := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      v_uid := NULL;
    END;

    -- Only mark password_changed_at when the user changed their OWN password.
    -- Service-role admin calls have v_uid = NULL, so this branch is skipped,
    -- which is exactly what we want for bulk default-password resets.
    IF v_uid IS NOT NULL AND v_uid = NEW.id THEN
      UPDATE public.profiles
         SET password_changed_at = NOW()
       WHERE auth_user_id = NEW.id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Attach the trigger to auth.users
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_password_changed ON auth.users;

CREATE TRIGGER on_auth_user_password_changed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_password_change();

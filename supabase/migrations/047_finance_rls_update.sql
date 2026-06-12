-- ─────────────────────────────────────────────────────────────────────────────
-- AO Deportes · Finance RLS — UPDATE / INSERT policies
-- Migration 047
--
-- The finance tables had SELECT-only RLS policies. The mobile approval screen
-- uses the anon client (subject to RLS) to update expense statuses, but there
-- were no UPDATE policies — so all updates from the mobile were silently
-- rejected (0 rows affected, no error).
--
-- Adds:
--   • UPDATE on finance_expenses — for approval-flow users
--   • INSERT on finance_approvals — to record approval actions
--   • INSERT on finance_activity_log — to record activity
-- ─────────────────────────────────────────────────────────────────────────────

-- Shared role check used by all policies in this migration
-- Roles that can perform finance approval actions (matching SELECT policy)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── finance_expenses: UPDATE ──────────────────────────────────────────────────
-- Allows the same roles that can read expenses to also update them.
-- This is required for the mobile approval workflow:
--   submitted → approved | rejected
--   approved  → paid     | rejected

DROP POLICY IF EXISTS "Finance roles can update finance_expenses" ON public.finance_expenses;

CREATE POLICY "Finance roles can update finance_expenses"
  ON public.finance_expenses FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

-- ── finance_approvals: INSERT ─────────────────────────────────────────────────
-- Allows finance roles to record approval actions.

DROP POLICY IF EXISTS "Finance roles can insert finance_approvals" ON public.finance_approvals;

CREATE POLICY "Finance roles can insert finance_approvals"
  ON public.finance_approvals FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

-- ── finance_activity_log: INSERT (if table exists) ────────────────────────────
-- Guard with DO block in case the table doesn't exist in some environments.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_activity_log') THEN
    EXECUTE $policy$
      DROP POLICY IF EXISTS "Finance roles can insert finance_activity_log"
        ON public.finance_activity_log;

      CREATE POLICY "Finance roles can insert finance_activity_log"
        ON public.finance_activity_log FOR INSERT TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM   public.user_roles  ur
            JOIN   public.roles        r ON r.id = ur.role_id
            JOIN   public.profiles     p ON p.id = ur.profile_id
            WHERE  p.auth_user_id = auth.uid()
              AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
          )
        );
    $policy$;
  END IF;
END;
$$;

-- =============================================================================
-- 049_payroll_profile_nullable.sql
--
-- Makes finance_payroll.profile_id nullable and changes the FK action to
-- SET NULL so that deleting a staff profile preserves historical payroll
-- records (profile_id becomes NULL instead of the row being deleted).
-- =============================================================================

-- Drop the existing NOT NULL constraint and RESTRICT FK, then re-add as nullable SET NULL
ALTER TABLE public.finance_payroll
  ALTER COLUMN profile_id DROP NOT NULL;

ALTER TABLE public.finance_payroll
  DROP CONSTRAINT IF EXISTS finance_payroll_profile_id_fkey;

ALTER TABLE public.finance_payroll
  ADD CONSTRAINT finance_payroll_profile_id_fkey
    FOREIGN KEY (profile_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

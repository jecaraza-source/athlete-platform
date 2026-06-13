-- =============================================================================
-- 054_rls_tickets_hardening.sql
--
-- SECURITY FIX: Replace USING(true) SELECT policies on tickets, ticket_comments,
-- and ticket_activity_log.
--
-- Problem: migration 005 granted SELECT to all authenticated users on all three
-- tables. Any athlete could read support tickets created by or assigned to
-- other staff members, including confidential ticket descriptions and comments.
--
-- Fix: A user may read a ticket (and its comments/log) only if they are:
--   (a) The ticket creator (created_by)
--   (b) The ticket assignee (assigned_to)
--   (c) A staff member with an appropriate role
--
-- The existing INSERT policy (migration 013) is intentionally preserved:
-- any authenticated user can still create tickets with their own profile as
-- the creator — this is required for the mobile support flow.
-- =============================================================================

-- ── tickets ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read tickets" ON public.tickets;

CREATE POLICY "Ticket stakeholders and staff can read tickets"
  ON public.tickets FOR SELECT TO authenticated
  USING (
    -- (a) User created the ticket
    created_by IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
    OR
    -- (b) Ticket is assigned to this user
    assigned_to IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
    OR
    -- (c) Staff member with a role that has ticket visibility
    EXISTS (
      SELECT 1
      FROM   public.user_roles ur
      JOIN   public.roles       r ON r.id = ur.role_id
      JOIN   public.profiles    p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN (
          'super_admin', 'admin', 'program_director',
          'coach', 'medic', 'physio', 'nutritionist', 'psychologist',
          'event_coordinator', 'staff'
        )
    )
  );

-- ── ticket_comments ─────────────────────────────────────────────────────────
-- A user can read comments on tickets they have access to.
-- We replicate the ticket access check here to keep the policy self-contained
-- and avoid a join that could hurt performance on large comment sets.
DROP POLICY IF EXISTS "Authenticated users can read ticket_comments" ON public.ticket_comments;

CREATE POLICY "Ticket stakeholders and staff can read ticket_comments"
  ON public.ticket_comments FOR SELECT TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM public.tickets
      WHERE
        -- Creator or assignee
        created_by IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
        OR assigned_to IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1
          FROM   public.user_roles ur
          JOIN   public.roles       r ON r.id = ur.role_id
          JOIN   public.profiles    p ON p.id = ur.profile_id
          WHERE  p.auth_user_id = auth.uid()
            AND  r.code IN (
              'super_admin', 'admin', 'program_director',
              'coach', 'medic', 'physio', 'nutritionist', 'psychologist',
              'event_coordinator', 'staff'
            )
        )
    )
  );

-- ── ticket_activity_log ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read ticket_activity_log" ON public.ticket_activity_log;

CREATE POLICY "Ticket stakeholders and staff can read ticket_activity_log"
  ON public.ticket_activity_log FOR SELECT TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM public.tickets
      WHERE
        created_by IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
        OR assigned_to IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1
          FROM   public.user_roles ur
          JOIN   public.roles       r ON r.id = ur.role_id
          JOIN   public.profiles    p ON p.id = ur.profile_id
          WHERE  p.auth_user_id = auth.uid()
            AND  r.code IN (
              'super_admin', 'admin', 'program_director',
              'coach', 'medic', 'physio', 'nutritionist', 'psychologist',
              'event_coordinator', 'staff'
            )
        )
    )
  );

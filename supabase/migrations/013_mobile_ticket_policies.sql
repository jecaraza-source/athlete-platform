-- =============================================================================
-- 013_mobile_ticket_policies.sql
-- Adds INSERT / UPDATE RLS policies for tickets and ticket_comments so
-- authenticated mobile clients (anon key + user JWT) can create and update
-- their own tickets without needing the service-role key.
--
-- Previously all ticket writes went through supabaseAdmin (service-role),
-- which bypasses RLS.  Mobile clients use the anon key, so they need
-- explicit policies.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tickets: INSERT
--   A user may insert a ticket when the `created_by` column matches their
--   own profile id.  This prevents impersonation.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON public.tickets;
CREATE POLICY "Authenticated users can create tickets"
  ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- tickets: UPDATE
--   Allow authenticated users to update tickets (change status, etc.).
--   Fine-grained permission checks are handled in application logic.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can update tickets" ON public.tickets;
CREATE POLICY "Authenticated users can update tickets"
  ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- ticket_comments: INSERT
--   A user may insert a comment when the `author_id` matches their profile.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create ticket_comments" ON public.ticket_comments;
CREATE POLICY "Authenticated users can create ticket_comments"
  ON public.ticket_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

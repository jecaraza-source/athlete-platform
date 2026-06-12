-- =============================================================================
-- tickets_seed.sql
-- Sample tickets, comments, and activity log for development.
-- Safe to run multiple times (idempotent via title uniqueness guard).
-- Requires at least one profile row to exist.
-- =============================================================================

DO $$
DECLARE
  p1       UUID;
  p2       UUID;
  ticket1  UUID;
  ticket2  UUID;
  ticket3  UUID;
BEGIN
  -- Resolve two profiles to act as ticket creator / assignee
  SELECT id INTO p1 FROM public.profiles ORDER BY created_at LIMIT 1;
  SELECT id INTO p2 FROM public.profiles ORDER BY created_at OFFSET 1 LIMIT 1;

  IF p1 IS NULL THEN
    RAISE NOTICE 'tickets_seed: no profiles found, skipping.';
    RETURN;
  END IF;

  -- Fall back to the same profile if only one exists
  IF p2 IS NULL THEN
    p2 := p1;
  END IF;

  -- ── Ticket 1 ──────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.tickets WHERE title = '[SEED] Login page broken on mobile') THEN
    INSERT INTO public.tickets (title, description, status, priority, created_by, assigned_to)
    VALUES (
      '[SEED] Login page broken on mobile',
      'Users on iOS Safari (v17+) report the login button does not respond after entering credentials. ' ||
      'The button visually depresses but no network request is fired. ' ||
      'Reproduced on iPhone 14 and iPad Pro. Not reproducible on Chrome mobile.',
      'open',
      'high',
      p1,
      p2
    )
    RETURNING id INTO ticket1;

    -- Comments
    INSERT INTO public.ticket_comments (ticket_id, author_id, message)
    VALUES
      (ticket1, p2, 'Confirmed. I can reproduce this consistently on iPhone 14 running iOS 17.3.'),
      (ticket1, p1, 'Investigating — might be a focus/blur event conflict with the password field autofill overlay.');

    -- Activity
    INSERT INTO public.ticket_activity_log (ticket_id, action, performed_by, metadata)
    VALUES
      (ticket1, 'created',  p1, jsonb_build_object('title', '[SEED] Login page broken on mobile', 'priority', 'high')),
      (ticket1, 'assigned', p1, jsonb_build_object('assigned_to', p2::text));
  END IF;

  -- ── Ticket 2 ──────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.tickets WHERE title = '[SEED] Export athletes to CSV') THEN
    INSERT INTO public.tickets (title, description, status, priority, created_by, assigned_to)
    VALUES (
      '[SEED] Export athletes to CSV',
      'The coaching staff needs to export athlete profiles (name, position, school/club, status) ' ||
      'to a CSV for reporting. Currently there is no export button in the Athletes admin page.',
      'in_progress',
      'medium',
      p2,
      p1
    )
    RETURNING id INTO ticket2;

    INSERT INTO public.ticket_comments (ticket_id, author_id, message)
    VALUES
      (ticket2, p1, 'Working on this. I''ll add an export button that triggers a CSV download server action.');

    INSERT INTO public.ticket_activity_log (ticket_id, action, performed_by, metadata)
    VALUES
      (ticket2, 'created',        p2, jsonb_build_object('title', '[SEED] Export athletes to CSV', 'priority', 'medium')),
      (ticket2, 'status_changed', p1, jsonb_build_object('from', 'open', 'to', 'in_progress')),
      (ticket2, 'assigned',       p2, jsonb_build_object('assigned_to', p1::text));
  END IF;

  -- ── Ticket 3 ──────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.tickets WHERE title = '[SEED] Calendar month view is slow') THEN
    INSERT INTO public.tickets (title, description, status, priority, created_by)
    VALUES (
      '[SEED] Calendar month view is slow',
      'When more than ~50 events exist in a month, the calendar view takes 3-4 seconds to render. ' ||
      'This is especially noticeable at the start of a competition season. ' ||
      'Likely needs pagination or a virtualized event list.',
      'open',
      'low',
      p1
    )
    RETURNING id INTO ticket3;

    INSERT INTO public.ticket_activity_log (ticket_id, action, performed_by, metadata)
    VALUES
      (ticket3, 'created', p1, jsonb_build_object('title', '[SEED] Calendar month view is slow', 'priority', 'low'));
  END IF;

EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'tickets_seed: skipped due to error: %', SQLERRM;
END $$;

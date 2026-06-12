-- =============================================================================
-- 005_tickets.sql
-- Internal ticket (case management) system
-- Run after 004_medic_role.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tickets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority    TEXT        NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_by  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_to UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID        NOT NULL REFERENCES public.tickets(id)  ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_activity_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID        NOT NULL REFERENCES public.tickets(id)  ON DELETE CASCADE,
  action       TEXT        NOT NULL,
  performed_by UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tickets_status           ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to      ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by       ON public.tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket   ON public.ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket   ON public.ticket_activity_log(ticket_id);

-- ---------------------------------------------------------------------------
-- 3. Auto-update updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tickets_updated_at ON public.tickets;
CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 4. Row-Level Security
--    All writes go through supabaseAdmin (service-role, bypasses RLS).
--    These policies protect direct client reads.
-- ---------------------------------------------------------------------------

ALTER TABLE public.tickets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tickets"
  ON public.tickets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read ticket_comments"
  ON public.ticket_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read ticket_activity_log"
  ON public.ticket_activity_log FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 5. Ticket permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (name, description) VALUES
  ('view_tickets',    'Read tickets and comments'),
  ('create_tickets',  'Open new tickets'),
  ('edit_tickets',    'Update ticket fields and status'),
  ('assign_tickets',  'Assign tickets to other users'),
  ('comment_tickets', 'Add comments to tickets'),
  ('close_tickets',   'Close and resolve tickets')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Default role → ticket permission assignments
--    Uses roles.code to look up the INTEGER roles.id used by role_permissions.
-- ---------------------------------------------------------------------------

-- super_admin: full access (also bypasses permission checks in code)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
CROSS JOIN public.permissions p
WHERE  r.code = 'super_admin'
  AND  p.name IN (
    'view_tickets', 'create_tickets', 'edit_tickets',
    'assign_tickets', 'comment_tickets', 'close_tickets'
  )
ON CONFLICT DO NOTHING;

-- program_director / admin: full ticket access
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name IN (
  'view_tickets', 'create_tickets', 'edit_tickets',
  'assign_tickets', 'comment_tickets', 'close_tickets'
)
WHERE  r.code IN ('program_director', 'admin')
ON CONFLICT DO NOTHING;

-- coach: view, create, edit, comment, close (no assign)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name IN (
  'view_tickets', 'create_tickets', 'edit_tickets',
  'comment_tickets', 'close_tickets'
)
WHERE  r.code = 'coach'
ON CONFLICT DO NOTHING;

-- specialist roles: view, create, comment
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name IN (
  'view_tickets', 'create_tickets', 'comment_tickets'
)
WHERE  r.code IN ('physio', 'nutritionist', 'psychologist', 'medic', 'staff')
ON CONFLICT DO NOTHING;

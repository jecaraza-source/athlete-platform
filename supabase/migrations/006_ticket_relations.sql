-- =============================================================================
-- 006_ticket_relations.sql
-- Multi-staff assignees and athlete follow-up links for tickets.
-- Run after 005_tickets.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ticket_assignees — many-to-many: ticket ↔ staff profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_assignees (
  ticket_id   UUID        NOT NULL REFERENCES public.tickets(id)  ON DELETE CASCADE,
  profile_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_assignees_ticket  ON public.ticket_assignees(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignees_profile ON public.ticket_assignees(profile_id);

ALTER TABLE public.ticket_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ticket_assignees"
  ON public.ticket_assignees FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 2. ticket_athletes — many-to-many: ticket ↔ athletes (performance follow-up)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_athletes (
  ticket_id  UUID        NOT NULL REFERENCES public.tickets(id)  ON DELETE CASCADE,
  athlete_id UUID        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  note       TEXT,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_athletes_ticket  ON public.ticket_athletes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_athletes_athlete ON public.ticket_athletes(athlete_id);

ALTER TABLE public.ticket_athletes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ticket_athletes"
  ON public.ticket_athletes FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 3. Backfill: migrate existing single assigned_to → ticket_assignees
-- ---------------------------------------------------------------------------

INSERT INTO public.ticket_assignees (ticket_id, profile_id)
SELECT id, assigned_to
FROM   public.tickets
WHERE  assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Migration: extend_events_for_appointment_followup
-- Extends the existing `events` table with appointment follow-up columns and
-- adds the `specialist_availability` table.
-- Run once against your Supabase PostgreSQL instance.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend events with appointment-specific columns
--    The existing events table already has:
--      id, title, event_type, sport_id, start_at, end_at, status, description,
--      created_by_profile_id
--    Athlete is linked via event_participants (participant_id → athletes.id).
-- ---------------------------------------------------------------------------

ALTER TABLE events ADD COLUMN IF NOT EXISTS specialist_id        UUID        REFERENCES profiles(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS no_show_reason       TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reschedule_reason    TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS original_event_id    UUID        REFERENCES events(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS confirmed_by         UUID        REFERENCES profiles(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS confirmed_at         TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Index for fetching a specialist's appointments efficiently
CREATE INDEX IF NOT EXISTS idx_events_specialist_id ON events(specialist_id);

-- ---------------------------------------------------------------------------
-- 2. Extend event_participants.attendance_status to support follow-up values
--    Existing valid values: planned
--    New values: show, no_show, rescheduled
-- ---------------------------------------------------------------------------
ALTER TABLE event_participants
  DROP CONSTRAINT IF EXISTS event_participants_attendance_status_check;

ALTER TABLE event_participants
  ADD CONSTRAINT event_participants_attendance_status_check
  CHECK (attendance_status IN ('planned', 'show', 'no_show', 'rescheduled'));

-- ---------------------------------------------------------------------------
-- 3. specialist_availability
--    Defines recurring weekly availability windows for each specialist.
--    day_of_week: 0 = Sunday … 6 = Saturday
--    slot_minutes: duration of each bookable slot (default 30 min)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS specialist_availability (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week    INTEGER     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time     TIME        NOT NULL,
  end_time       TIME        NOT NULL,
  slot_minutes   INTEGER     NOT NULL DEFAULT 30,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_specialist_availability_specialist ON specialist_availability(specialist_id);

-- ---------------------------------------------------------------------------
-- 4. Seed default weekday availability (Mon–Fri 09:00–17:00, 30-min slots)
--    for existing medical staff profiles. Idempotent — safe to re-run.
--    Uncomment to apply.
-- ---------------------------------------------------------------------------
-- INSERT INTO specialist_availability (specialist_id, day_of_week, start_time, end_time)
-- SELECT p.id, d.dow, '09:00', '17:00'
-- FROM profiles p
-- CROSS JOIN (VALUES (1),(2),(3),(4),(5)) AS d(dow)
-- WHERE p.role IN ('medico','medic','nutricionista','nutritionist','fisioterapeuta','physio','psicologo','psychologist')
-- ON CONFLICT DO NOTHING;

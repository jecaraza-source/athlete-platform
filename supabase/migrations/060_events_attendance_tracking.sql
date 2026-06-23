-- ============================================================================
-- Migration 060: Attendance tracking for events
--
-- Adds the columns needed by the /medical/appointments module so that
-- all medical staff (medic, physio, nutritionist, psychologist) can record
-- show / no-show / no-show-remote / reschedule for their appointments.
-- Also creates specialist_service_assignments to map calendar service names
-- (e.g. "FISIOTERAPIA 1") to their responsible specialist profile.
-- ============================================================================

-- ── 1. Add missing columns to events ─────────────────────────────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS specialist_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS no_show_reason      TEXT,
  ADD COLUMN IF NOT EXISTS reschedule_reason   TEXT,
  ADD COLUMN IF NOT EXISTS original_event_id   UUID REFERENCES events(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();

-- Index for quick lookup of a specialist's appointments
CREATE INDEX IF NOT EXISTS idx_events_specialist_id ON events(specialist_id);

-- Index for reschedule chains
CREATE INDEX IF NOT EXISTS idx_events_original_event_id ON events(original_event_id);

-- ── 2. Extend attendance_status in event_participants ────────────────────────

-- The attendance_status column already exists with values like 'planned', 'show', 'no_show', 'rescheduled'.
-- We add 'no_show_remote' to record cases where the athlete did not attend in person
-- but was contacted by phone or message.
-- (PostgreSQL TEXT columns accept any value, no ENUM change needed.)

-- ── 3. Create specialist_service_assignments ──────────────────────────────────

CREATE TABLE IF NOT EXISTS specialist_service_assignments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name         TEXT NOT NULL UNIQUE,   -- e.g. 'FISIOTERAPIA 1'
  specialist_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssa_service_name ON specialist_service_assignments(service_name);

-- ── 4. RLS policies ───────────────────────────────────────────────────────────

ALTER TABLE specialist_service_assignments ENABLE ROW LEVEL SECURITY;

-- Admins/super_admins can manage assignments
CREATE POLICY "admin_manage_ssa"
  ON specialist_service_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'program_director')
    )
  );

-- Any authenticated user can read assignments (needed so the app can filter)
CREATE POLICY "read_ssa"
  ON specialist_service_assignments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ── 5. Seed initial specialist assignments ────────────────────────────────────
-- Populated based on confirmed staff assignments Jun 2026.
-- Update or add rows as staff changes.

INSERT INTO specialist_service_assignments (service_name, specialist_profile_id) VALUES
  -- MÉDICO
  ('MÉDICO 1',      'be9b08a5-0000-0000-0000-000000000000'),   -- placeholder: replace with real UUID
  ('MÉDICO 2',      'b143dd6e-0000-0000-0000-000000000000'),
  ('MÉDICO 3',      'ab44d1c6-0000-0000-0000-000000000000'),
  -- NUTRICIÓN
  ('NUTRICIÓN 1',   'bc313661-0000-0000-0000-000000000000'),
  ('NUTRICIÓN 2',   'b9cc0ff8-0000-0000-0000-000000000000'),
  ('NUTRICIÓN 3',   '51985715-0000-0000-0000-000000000000'),
  -- FISIOTERAPIA (same specialist for all three slots)
  ('FISIOTERAPIA 1','4f3b246e-0000-0000-0000-000000000000'),
  ('FISIOTERAPIA 2','4f3b246e-0000-0000-0000-000000000000'),
  ('FISIOTERAPIA 3','4f3b246e-0000-0000-0000-000000000000'),
  -- PSICOLOGÍA
  ('PSICOLOGÍA 1',  '90d847e6-0000-0000-0000-000000000000'),
  ('PSICOLOGÍA 2',  '522001de-0000-0000-0000-000000000000'),
  ('PSICOLOGÍA 3',  '7c8cd296-0000-0000-0000-000000000000')
ON CONFLICT (service_name) DO NOTHING;

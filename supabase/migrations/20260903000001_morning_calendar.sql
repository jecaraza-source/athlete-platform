-- 20260903000001_morning_calendar.sql
-- Already applied in production (events.shift, profile_permissions exist) outside
-- the migration history; recorded here so the repo matches the database.
-- Idempotent: safe to re-run.
-- Adds parallel morning-shift calendar support.
--
-- Changes:
--   1. Add `shift` column to `events` (morning | afternoon).
--   2. Existing events default to 'afternoon' through the column default.
--   3. Create `profile_permissions` table for per-user permission overrides.
--   4. Seed new permissions: view_morning_calendar, manage_morning_calendar.
--   5. Grant both to Super Admin and Coordinador roles.

-- ── 1. Shift column on events ────────────────────────────────────────────────
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS shift TEXT NOT NULL DEFAULT 'afternoon'
  CHECK (shift IN ('morning', 'afternoon'));

-- ── 2. Backfill ──────────────────────────────────────────────────────────────
-- ADD COLUMN ... DEFAULT 'afternoon' already fills existing rows. The original
-- UPDATE that forced every event to 'afternoon' was removed: re-running it
-- would wipe the morning shift of real events.

-- ── 3. profile_permissions — individual permission overrides per profile ─────
CREATE TABLE IF NOT EXISTS profile_permissions (
  profile_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission_id UUID        NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (profile_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_permissions_profile
  ON profile_permissions (profile_id);

-- ── 4. New permissions ────────────────────────────────────────────────────────
INSERT INTO permissions (name, description) VALUES
  ('view_morning_calendar',   'View morning-shift calendar events'),
  ('manage_morning_calendar', 'Create, edit and delete morning-shift calendar events')
ON CONFLICT (name) DO NOTHING;

-- ── 5. Grant to Super Admin and Coordinador roles ────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('super_admin', 'coordinador')
  AND p.name IN ('view_morning_calendar', 'manage_morning_calendar')
ON CONFLICT DO NOTHING;

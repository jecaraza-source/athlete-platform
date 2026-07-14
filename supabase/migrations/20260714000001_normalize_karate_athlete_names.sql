-- 20260714000001_normalize_karate_athlete_names.sql
-- Converts first_name and last_name from ALL CAPS to Title Case
-- (INITCAP after LOWER) for athletes registered in the karate discipline.
-- Both tables are updated atomically:
--   • athletes   — primary athlete record
--   • profiles   — display name used across the UI (linked via profile_id)

BEGIN;

-- ── 1. Normalize the athletes table ─────────────────────────────────────────

UPDATE athletes
SET
  first_name = INITCAP(LOWER(first_name)),
  last_name  = INITCAP(LOWER(last_name))
WHERE
  LOWER(discipline) = 'karate'
  -- Only touch rows that still have at least one ALL-CAPS name to avoid
  -- re-processing rows that were already normalized.
  AND (
    first_name = UPPER(first_name)
    OR last_name = UPPER(last_name)
  );

-- ── 2. Normalize the profiles table (display name) ──────────────────────────

UPDATE profiles p
SET
  first_name = INITCAP(LOWER(p.first_name)),
  last_name  = INITCAP(LOWER(p.last_name))
FROM athletes a
WHERE
  a.profile_id = p.id
  AND LOWER(a.discipline) = 'karate'
  AND (
    p.first_name = UPPER(p.first_name)
    OR p.last_name = UPPER(p.last_name)
  );

COMMIT;

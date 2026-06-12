-- ─────────────────────────────────────────────────────────────────────────────
-- AO Deportes · Newsletter Recipients
-- Migration 045 — Expand audiencia + add recipient_ids
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop existing audiencia constraint (was: atleta | coach | all)
ALTER TABLE newsletter_drafts
  DROP CONSTRAINT IF EXISTS newsletter_drafts_audiencia_check;

-- 2. Re-add with expanded values
ALTER TABLE newsletter_drafts
  ADD CONSTRAINT newsletter_drafts_audiencia_check
  CHECK (audiencia IN ('atleta', 'coach', 'all', 'staff', 'individual'));

-- 3. Add recipient_ids for individual selection (array of profile UUIDs)
ALTER TABLE newsletter_drafts
  ADD COLUMN IF NOT EXISTS recipient_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 4. Add index on recipient_ids for individual lookup
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_recipient_ids
  ON newsletter_drafts USING GIN (recipient_ids);

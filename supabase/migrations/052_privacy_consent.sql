-- Migration 052: Add privacy consent tracking to profiles
-- Records when a user explicitly accepted the privacy notice for the first time.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS privacy_consent_accepted_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.profiles.privacy_consent_accepted_at IS
  'Timestamp when the user first accepted the privacy notice. NULL = not yet accepted.';

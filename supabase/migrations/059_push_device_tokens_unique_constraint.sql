-- =============================================================================
-- 059_push_device_tokens_unique_constraint.sql
--
-- The mobile app upserts device tokens with:
--   onConflict: 'profile_id,device_token'
--
-- PostgreSQL requires a matching UNIQUE constraint or index for that
-- ON CONFLICT clause to work. Without it every upsert fails silently
-- (PostgREST returns an error) and no tokens are ever registered.
--
-- Steps:
--   1. Remove duplicate (profile_id, device_token) pairs that may have
--      accumulated via plain INSERTs (keep the most recently seen row).
--   2. Add the UNIQUE constraint so future upserts succeed.
-- =============================================================================

-- 1. Deduplicate: keep the row with the latest last_seen_at (or latest id
--    as a tiebreaker) for each (profile_id, device_token) pair.
DELETE FROM public.push_device_tokens
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY profile_id, device_token
        ORDER BY COALESCE(last_seen_at, registered_at) DESC, id DESC
      ) AS rn
    FROM public.push_device_tokens
    WHERE device_token IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- 2. Add the unique constraint required by the mobile upsert.
ALTER TABLE public.push_device_tokens
  ADD CONSTRAINT uq_push_device_tokens_profile_token
  UNIQUE (profile_id, device_token);

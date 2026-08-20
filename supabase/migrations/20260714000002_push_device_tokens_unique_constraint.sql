-- =============================================================================
-- 20260714000002_push_device_tokens_unique_constraint.sql
--
-- registerDeviceToken() (apps/mobile/services/push.ts) upserts with
-- onConflict: 'profile_id,device_token', but push_device_tokens never had a
-- matching unique constraint — only onesignal_player_id was unique. Every
-- upsert has been failing with 42P10 (no unique/exclusion constraint matching
-- ON CONFLICT) since the table was created in 007_notification_schema.sql,
-- silently swallowed by a console.warn in the caller. Net effect: no mobile
-- device has ever successfully registered a push token.
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE public.push_device_tokens
    ADD CONSTRAINT push_device_tokens_profile_device_key UNIQUE (profile_id, device_token);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

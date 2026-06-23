-- =============================================================================
-- 058_push_token_onesignal_prefix.sql
-- One-time data migration: prefix existing OneSignal player IDs stored in
-- device_token with 'onesignal:' to match the new registration convention
-- introduced in the mobile app (Fix 1 of the push notification bug fixes).
--
-- Affected rows: those where onesignal_player_id is set and device_token
-- currently holds the raw UUID (i.e. device_token = onesignal_player_id).
-- After this migration both columns are consistent:
--   onesignal_player_id = <raw UUID>   (unchanged — used for API calls)
--   device_token        = 'onesignal:' + <raw UUID>  (conflict-key column)
-- =============================================================================

UPDATE public.push_device_tokens
SET    device_token = 'onesignal:' || onesignal_player_id
WHERE  onesignal_player_id IS NOT NULL
  AND  device_token = onesignal_player_id;

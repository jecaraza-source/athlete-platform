-- =============================================================================
-- cleanup_for_production.sql
-- AO Deportes — Production launch database cleanup
--
-- PURPOSE
-- -------
-- Removes all trial/development data while preserving system configuration
-- (roles, permissions, catalogs, and default automation rules/templates).
--
-- HOW TO RUN
-- ----------
-- Open Supabase Dashboard → SQL Editor, paste this entire file, click Run.
-- The SQL Editor runs as the `postgres` role, which bypasses RLS.
--
-- WHAT IS PRESERVED ✓
-- --------------------
--   roles, permissions, role_permissions
--   cat_disciplines, cat_risk_levels, sports
--   ticket_email_templates  (4 default templates from migration 007)
--   ticket_automation_rules (4 default rules from migration 009)
--   email_templates, push_templates  (any rows NOT added by the seeds)
--
-- WHAT IS REMOVED ✗
-- -----------------
--   All athletes and their linked records
--     (evaluations, diagnostics, attachments, sessions, injuries, notes, plans)
--   All events and training sessions
--   All tickets, comments, activity logs, and email jobs
--   All notification / email / push history and device tokens
--   All plans and protocols
--   Demo seed rows: 2 email templates, 2 push templates, 1 automation rule
--   All files in storage buckets: plans, athlete-files
--   (avatars are optional — see Section 4)
--
-- USER ACCOUNTS
-- -------------
-- All profiles are deleted EXCEPT the super_admin account(s).
-- Super_admin profiles and their role assignments are preserved.
-- ⚠️  Non-super_admin Auth users must still be deleted manually:
--     Dashboard → Authentication → Users → select all non-admins → Delete
-- =============================================================================

BEGIN;

-- ============================================================
-- SECTION 1 — Operational trial data (full wipe)
-- ============================================================

-- 1a. Tickets and all child tables
TRUNCATE TABLE
  public.ticket_email_deliveries,
  public.ticket_email_jobs,
  public.ticket_activity_log,
  public.ticket_followers,
  public.ticket_athletes,
  public.ticket_assignees,
  public.ticket_comments,
  public.tickets
CASCADE;

-- 1b. Notification / email / push history
TRUNCATE TABLE
  public.email_deliveries,
  public.email_jobs,
  public.email_campaigns,
  public.push_deliveries,
  public.push_jobs,
  public.push_campaigns,
  public.push_device_tokens,
  public.notification_audit_log,
  public.notification_preferences
CASCADE;

-- 1c. Plans and protocols
TRUNCATE TABLE
  public.athlete_plans,
  public.plans,
  public.protocols
CASCADE;

-- 1d. Athlete sub-tables: evaluations, diagnostics, clinical, attachments
--     (listing explicitly avoids FK ordering issues; CASCADE handles the rest)
TRUNCATE TABLE
  public.athlete_diagnostic_sections,
  public.athlete_initial_diagnostic,
  public.athlete_integrated_results,
  public.athlete_individual_plans,
  public.athlete_medical_evaluation,
  public.athlete_nutrition_evaluation,
  public.athlete_physiotherapy_evaluation,
  public.athlete_psychology_evaluation,
  public.athlete_coach_evaluation,
  public.athlete_follow_up_log,
  public.athlete_attachments,
  public.athlete_notes,
  public.physio_sessions,
  public.physio_cases,
  public.psychology_sessions,
  public.psychology_cases,
  public.medical_sessions,
  public.medical_cases,
  public.nutrition_checkins,
  public.nutrition_plans,
  public.injuries
CASCADE;

-- 1e. Events and training
TRUNCATE TABLE
  public.training_sessions,
  public.event_participants,
  public.events
CASCADE;

-- 1f. Athletes — parent record; CASCADE cleans up any remaining child rows
TRUNCATE TABLE public.athletes CASCADE;

-- ============================================================
-- SECTION 2 — Dev-only seed rows in config/template tables
-- Only removes rows added by supabase/seeds/notifications_seed.sql.
-- Migration-seeded rows (007, 009) are kept.
-- ============================================================

-- Demo email templates (notifications_seed.sql)
DELETE FROM public.email_templates
WHERE name IN (
  'Recordatorio de Entrenamiento',
  'Recordatorio de Evaluación Médica'
);

-- Demo push templates (notifications_seed.sql)
DELETE FROM public.push_templates
WHERE name IN (
  'Recordatorio Push — Entrenamiento',
  'Aviso Push — Ticket pendiente'
);

-- Extra automation rule from seed
-- (the 4 default rules from migration 009 are preserved)
DELETE FROM public.ticket_automation_rules
WHERE name = 'Seguimiento urgente (2h)';

-- ============================================================
-- SECTION 3 — Wipe all user accounts EXCEPT super_admin
-- Deletes every profile and role assignment that does NOT
-- belong to a super_admin. The super_admin profile(s) and
-- their role rows are fully preserved.
-- ⚠️  Also delete non-super_admin Auth users manually:
--     Dashboard → Authentication → Users
-- ============================================================

-- Remove role assignments for non-super_admin users (except ct@ct.com)
DELETE FROM public.user_roles
WHERE profile_id NOT IN (
  SELECT ur.profile_id
  FROM   public.user_roles ur
  JOIN   public.roles      r  ON r.id = ur.role_id
  WHERE  r.code = 'super_admin'
)
  AND profile_id NOT IN (
  SELECT id FROM public.profiles WHERE email = 'ct@ct.com'
);

-- Remove profiles that are not super_admin and not ct@ct.com
DELETE FROM public.profiles
WHERE id NOT IN (
  SELECT ur.profile_id
  FROM   public.user_roles ur
  JOIN   public.roles      r  ON r.id = ur.role_id
  WHERE  r.code = 'super_admin'
)
  AND email != 'ct@ct.com';

-- ============================================================
-- SECTION 4 — Storage: delete trial files
-- Supabase does not allow direct SQL deletes on storage.objects.
-- Run the companion script instead:
--   node supabase/clear_storage.mjs
-- That script empties the plans and athlete-files buckets and
-- removes avatars for everyone except super_admin and ct@ct.com.
-- ============================================================

COMMIT;

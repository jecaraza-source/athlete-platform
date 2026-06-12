-- ─────────────────────────────────────────────────────────────────────────────
-- AO Deportes · Newsletter Custom Message
-- Migration 046 — Adds optional free-text notice/announcement to newsletters.
-- Admins can include event reminders, platform notices, or any communication
-- independent of the AI-generated tips.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE newsletter_drafts
  ADD COLUMN IF NOT EXISTS custom_message_title TEXT,
  ADD COLUMN IF NOT EXISTS custom_message        TEXT;

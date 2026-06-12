-- ─────────────────────────────────────────────────────────────────────────────
-- AO Deportes · Newsletter System
-- Migration 044 — newsletter_drafts + newsletter_logs + RBAC permissions
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. newsletter_enabled flag on profiles ───────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS newsletter_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 2. Main drafts table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_drafts (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audiencia       TEXT        NOT NULL CHECK (audiencia IN ('atleta', 'coach', 'all')),
  asunto          TEXT        NOT NULL,
  preview_text    TEXT,
  intro           TEXT,
  tips_json       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  html_content    TEXT        NOT NULL DEFAULT '',
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected','sent','cancelled')),
  scheduled_for   TIMESTAMPTZ,
  approved_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  approval_note   TEXT,
  rejected_reason TEXT,
  onesignal_id    TEXT,
  recipient_count INTEGER     NOT NULL DEFAULT 0,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Audit log table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_logs (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id    UUID        REFERENCES newsletter_drafts(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL
              CHECK (action IN ('generated','approved','rejected','sent','error','cancelled','viewed')),
  actor_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role  TEXT,
  note        TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_status_created
  ON newsletter_drafts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_audiencia_status
  ON newsletter_drafts (audiencia, status);

CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_sent
  ON newsletter_drafts (sent_at DESC)
  WHERE sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_newsletter_logs_draft
  ON newsletter_logs (draft_id, created_at DESC);

-- ── 5. updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_newsletter_draft_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_newsletter_drafts_updated ON newsletter_drafts;
CREATE TRIGGER trg_newsletter_drafts_updated
  BEFORE UPDATE ON newsletter_drafts
  FOR EACH ROW EXECUTE FUNCTION update_newsletter_draft_timestamp();

-- ── 6. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE newsletter_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_logs   ENABLE ROW LEVEL SECURITY;

-- Staff roles: full access to all drafts
-- NOTE: uses profiles.role (legacy column — still active per RBAC design)
--       and profiles.auth_user_id to map auth.uid() → profile row.
CREATE POLICY "newsletter_drafts_staff_all" ON newsletter_drafts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.role IN (
          'super_admin','program_director','event_coordinator',
          'coach','medic','physio','psychologist','nutritionist'
        )
    )
  );

-- Any authenticated user can read sent newsletters (athletes, guardians, etc.)
CREATE POLICY "newsletter_drafts_read_sent" ON newsletter_drafts
  FOR SELECT
  USING (
    status = 'sent'
    AND auth.uid() IS NOT NULL
  );

-- Staff: full access to logs
CREATE POLICY "newsletter_logs_staff_all" ON newsletter_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.role IN (
          'super_admin','program_director','event_coordinator',
          'coach','medic','physio','psychologist','nutritionist'
        )
    )
  );

-- ── 7. Public view for home card & mobile (sent newsletters only) ─────────────
CREATE OR REPLACE VIEW newsletter_sent_public AS
  SELECT
    id,
    audiencia,
    asunto,
    preview_text,
    intro,
    tips_json,
    html_content,
    sent_at,
    recipient_count,
    created_at
  FROM newsletter_drafts
  WHERE status = 'sent'
  ORDER BY sent_at DESC;

-- ── 8. RBAC permissions ───────────────────────────────────────────────────────
INSERT INTO permissions (name, description) VALUES
  ('newsletter.view',    'Ver newsletters enviados'),
  ('newsletter.manage',  'Crear, editar y aprobar newsletters'),
  ('newsletter.approve', 'Aprobar o rechazar newsletters pendientes'),
  ('newsletter.send',    'Enviar newsletters aprobados')
ON CONFLICT (name) DO NOTHING;

-- super_admin + program_director → full access
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r
  CROSS JOIN permissions p
  WHERE r.code IN ('super_admin', 'program_director')
    AND p.name IN (
      'newsletter.view',
      'newsletter.manage',
      'newsletter.approve',
      'newsletter.send'
    )
ON CONFLICT DO NOTHING;

-- event_coordinator, coach, medic, physio, psychologist, nutritionist → view + approve
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r
  CROSS JOIN permissions p
  WHERE r.code IN (
    'event_coordinator','coach','medic','physio','psychologist','nutritionist'
  )
    AND p.name IN ('newsletter.view', 'newsletter.approve')
ON CONFLICT DO NOTHING;

-- athlete + guardian → view only
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r
  CROSS JOIN permissions p
  WHERE r.code IN ('athlete', 'guardian')
    AND p.name = 'newsletter.view'
ON CONFLICT DO NOTHING;

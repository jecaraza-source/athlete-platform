-- =============================================================================
-- 055_deployments.sql
--
-- Tracks every Vercel production deployment with a consecutive auto-increment
-- version number (id). The build script scripts/register-deployment.mjs
-- inserts one row per deployment before `next build` runs.
--
-- Fields:
--   id           SERIAL PRIMARY KEY — the consecutive version number (1, 2, 3…)
--   deployed_at  — timestamp when the deployment build started
--   environment  — 'production' | 'preview' | 'development'
--   git_sha      — short 7-char commit hash
--   git_branch   — branch name (e.g. 'main')
--   git_message  — first line of the commit message (max 200 chars)
--   vercel_url   — the canonical URL of this deployment
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_deployments (
  id           serial        PRIMARY KEY,
  deployed_at  timestamptz   NOT NULL DEFAULT now(),
  environment  text          NOT NULL DEFAULT 'development'
                             CHECK (environment IN ('production', 'preview', 'development')),
  git_sha      text,
  git_branch   text,
  git_message  text,
  vercel_url   text
);

CREATE INDEX IF NOT EXISTS idx_app_deployments_env_date
  ON public.app_deployments (environment, deployed_at DESC);

COMMENT ON TABLE public.app_deployments IS
  'One row per Vercel deployment. The serial id is the visible "version number" shown in the UI.';

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Any authenticated user can read deployments (useful for support / about page).
-- Only the service role (build script) can insert.
ALTER TABLE public.app_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read app_deployments"
  ON public.app_deployments FOR SELECT TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies: the build script uses the service-role
-- client (supabaseAdmin) which bypasses RLS entirely.

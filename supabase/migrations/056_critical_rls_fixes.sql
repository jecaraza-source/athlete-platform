-- =============================================================================
-- 056_critical_rls_fixes.sql
--
-- Cierra las vulnerabilidades críticas identificadas en la segunda auditoría
-- técnica (Junio 2026):
--
-- 1. athletes: elimina "Allow public read access" (roles={anon}, USING(true))
--    → cualquier persona sin cuenta podía leer nombres, tutores y notas médicas
--      de todos los atletas vía la REST API de Supabase.
--
-- 2. events + training_sessions: reemplaza USING(true) para rol {public}
--    por USING(true) para {authenticated} — elimina acceso anónimo.
--
-- 3. assessment_types, athlete_sports, teams_groups, venues:
--    activa RLS (estaba deshabilitado) y agrega política básica de lectura
--    para usuarios autenticados.
--
-- Aplicada a producción vía `supabase db query --linked` el 2026-06-14.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. athletes — eliminar política anónima
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access" ON public.athletes;

-- ---------------------------------------------------------------------------
-- 2. events — reemplazar política pública por autenticada
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for all users" ON public.events;

CREATE POLICY "Authenticated users can read events"
  ON public.events FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 3. training_sessions — reemplazar política pública por autenticada
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for all users" ON public.training_sessions;

CREATE POLICY "Authenticated users can read training_sessions"
  ON public.training_sessions FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 4. Tablas de catálogo sin RLS — activar y agregar política básica
-- ---------------------------------------------------------------------------

ALTER TABLE public.assessment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_sports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams_groups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assessment_types"
  ON public.assessment_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read athlete_sports"
  ON public.athlete_sports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read teams_groups"
  ON public.teams_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read venues"
  ON public.venues FOR SELECT TO authenticated USING (true);

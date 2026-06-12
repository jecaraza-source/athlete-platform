-- =============================================================================
-- 003_medical_services.sql
-- Medical Services follow-up module
-- Combines physio-style case management with nutrition-style metric tracking.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. medical_cases — one case per athlete + medical condition
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.medical_cases (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id        UUID        REFERENCES public.athletes(id)  ON DELETE CASCADE,
  doctor_profile_id UUID        REFERENCES public.profiles(id)  ON DELETE SET NULL,
  condition         TEXT,                        -- diagnosis / medical condition
  status            TEXT        NOT NULL DEFAULT 'open',  -- open | in_progress | closed
  opened_at         DATE        NOT NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_cases_athlete_id ON public.medical_cases(athlete_id);
CREATE INDEX IF NOT EXISTS idx_medical_cases_status     ON public.medical_cases(status);

ALTER TABLE public.medical_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read medical_cases"
  ON public.medical_cases FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 2. medical_sessions — individual appointments within a case
--    Metrics mirror physio (pain, treatment) + nutrition (weight, adherence)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.medical_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_case_id   UUID        NOT NULL REFERENCES public.medical_cases(id) ON DELETE CASCADE,
  session_date      DATE        NOT NULL,
  treatment_summary TEXT,
  pain_score        INTEGER     CHECK (pain_score     BETWEEN 1 AND 10),
  health_score      INTEGER     CHECK (health_score   BETWEEN 1 AND 10),   -- general wellbeing
  weight_kg         NUMERIC(5,2),
  blood_pressure    TEXT,                        -- e.g. "120/80 mmHg"
  adherence_score   INTEGER     CHECK (adherence_score BETWEEN 1 AND 10),  -- treatment adherence
  notes             TEXT,
  next_session_date DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_sessions_case_id ON public.medical_sessions(medical_case_id);

ALTER TABLE public.medical_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read medical_sessions"
  ON public.medical_sessions FOR SELECT TO authenticated USING (true);

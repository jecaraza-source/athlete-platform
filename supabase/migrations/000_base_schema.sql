-- =============================================================================
-- 000_base_schema.sql
-- Pre-existing base schema — tables that existed BEFORE the numbered migrations.
--
-- ⚠️  DO NOT run this file on the production database — those tables already
-- exist.  This file exists for documentation and to allow fresh environments
-- to be reproduced from scratch.
--
-- Run order for a fresh install:
--   000_base_schema.sql  ← this file
--   002_rbac_adapt.sql   ← skipping 001 (see note below)
--   003 … 014            ← in numerical order
--
-- Why skip 001?
--   001_rbac.sql creates a `roles` table with a UUID primary key, but the
--   pre-existing schema (reflected here) uses a SERIAL INTEGER primary key.
--   Applying 001 on top of this schema would cause a FK type conflict.
--   See supabase/README.md for the full explanation.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles
--    One row per Supabase Auth user. Auto-created by a DB trigger when a new
--    Auth account is registered.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid        UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name    text        NOT NULL DEFAULT '',
  last_name     text        NOT NULL DEFAULT '',
  email         text,
  role          text,       -- legacy plain-text role; superseded by user_roles (RBAC)
  phone         text,
  specialty     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role         ON public.profiles(role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. roles
--    SERIAL INTEGER primary key (not UUID). Referenced by user_roles and
--    role_permissions (migrations 002+).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.roles (
  id          serial      PRIMARY KEY,
  code        text        UNIQUE NOT NULL,
  name        text        UNIQUE NOT NULL,
  description text,
  is_system   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed default roles
INSERT INTO public.roles (code, name, description, is_system) VALUES
  ('super_admin',       'Super Admin',        'Full platform access',                     true),
  ('program_director',  'Program Director',   'Administrative access',                    true),
  ('coach',             'Coach',              'Manage athletes, sessions, and calendar',  false),
  ('nutritionist',      'Nutritionist',       'Nutrition follow-up',                      false),
  ('physio',            'Physio',             'Physiotherapy follow-up',                  false),
  ('psychologist',      'Psychologist',       'Psychology follow-up',                     false),
  ('event_coordinator', 'Event Coordinator',  'Calendar and event management',            false),
  ('guardian',          'Guardian',           'Read-only guardian access',                false),
  ('athlete',           'Athlete',            'Athlete personal data and calendar',       false)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. user_roles
--    Many-to-many: profile ↔ role. role_id is INTEGER (references roles.id).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_roles (
  profile_id           uuid    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id              integer NOT NULL REFERENCES public.roles(id)    ON DELETE CASCADE,
  assigned_at          timestamptz NOT NULL DEFAULT now(),
  assigned_by_profile_id uuid  REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (profile_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_profile_id ON public.user_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id    ON public.user_roles(role_id);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read user_roles"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 4. athletes
--    Core athlete record. One row per athlete, optionally linked to a profile.
--    Columns discipline and disability_status added by migration 011.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athletes (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id              uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  athlete_code            text,
  first_name              text        NOT NULL,
  last_name               text        NOT NULL,
  date_of_birth           date,
  sex                     text,
  height_cm               numeric(5,1),
  weight_kg               numeric(5,2),
  dominant_side           text,
  school_or_club          text,
  guardian_name           text,
  guardian_phone          text,
  guardian_email          text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  medical_notes_summary   text,
  status                  text        NOT NULL DEFAULT 'active',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
  -- discipline and disability_status added by 011_initial_diagnostic.sql
);

CREATE INDEX IF NOT EXISTS idx_athletes_profile_id ON public.athletes(profile_id);
CREATE INDEX IF NOT EXISTS idx_athletes_status     ON public.athletes(status);

-- RLS added by migration 014_athletes_mobile_policy.sql

-- ---------------------------------------------------------------------------
-- 5. injuries
--    Injury catalogue / reference table.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.injuries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id   uuid REFERENCES public.athletes(id) ON DELETE CASCADE,
  injury_type  text NOT NULL,
  description  text,
  occurred_at  date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_injuries_athlete_id ON public.injuries(athlete_id);

ALTER TABLE public.injuries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read injuries"
  ON public.injuries FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 6. athlete_notes
--    Free-form notes on an athlete, authored by staff.
--    Referenced in deleteProfile / deleteUser cleanup logic.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_notes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id        uuid        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  author_profile_id uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  content           text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_athlete_notes_athlete_id ON public.athlete_notes(athlete_id);

ALTER TABLE public.athlete_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read athlete_notes"
  ON public.athlete_notes FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 7. events
--    Calendar events (trainings, competitions, medical appointments, etc.)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.events (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 text        NOT NULL,
  event_type            text        NOT NULL DEFAULT 'training',
  sport_id              uuid,
  start_at              timestamptz NOT NULL,
  end_at                timestamptz,
  status                text        NOT NULL DEFAULT 'scheduled',
  description           text,
  created_by_profile_id uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_start_at             ON public.events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_status               ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_by_profile_id ON public.events(created_by_profile_id);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read events"
  ON public.events FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 8. event_participants
--    Many-to-many: event ↔ participant (athletes or staff).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_participants (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id    uuid        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  participant_type  text        NOT NULL DEFAULT 'athlete',
  attendance_status text        NOT NULL DEFAULT 'planned',
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_participants_event       ON public.event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_participant ON public.event_participants(participant_id);

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read event_participants"
  ON public.event_participants FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 9. training_sessions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.training_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       uuid        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  coach_profile_id uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  title            text        NOT NULL,
  session_date     date        NOT NULL,
  start_time       time,
  end_time         time,
  location         text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_athlete_id ON public.training_sessions(athlete_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_date       ON public.training_sessions(session_date);

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read training_sessions"
  ON public.training_sessions FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 10. nutrition_plans
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.nutrition_plans (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id               uuid        REFERENCES public.athletes(id) ON DELETE CASCADE,
  nutritionist_profile_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  title                    text        NOT NULL,
  start_date               date        NOT NULL,
  end_date                 date,
  status                   text        NOT NULL DEFAULT 'active',
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_athlete_id ON public.nutrition_plans(athlete_id);

ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read nutrition_plans"
  ON public.nutrition_plans FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 11. nutrition_checkins
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.nutrition_checkins (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id               uuid        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  nutritionist_profile_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  checkin_date             date        NOT NULL,
  weight_kg                numeric(5,2),
  body_fat_percent         numeric(4,1),
  adherence_score          integer     CHECK (adherence_score BETWEEN 1 AND 10),
  notes                    text,
  next_actions             text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_checkins_athlete_id ON public.nutrition_checkins(athlete_id);

ALTER TABLE public.nutrition_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read nutrition_checkins"
  ON public.nutrition_checkins FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 12. physio_cases
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.physio_cases (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       uuid        REFERENCES public.athletes(id) ON DELETE CASCADE,
  physio_profile_id uuid       REFERENCES public.profiles(id) ON DELETE SET NULL,
  injury_id        uuid        REFERENCES public.injuries(id) ON DELETE SET NULL,
  status           text        NOT NULL DEFAULT 'open',
  opened_at        date        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physio_cases_athlete_id ON public.physio_cases(athlete_id);
CREATE INDEX IF NOT EXISTS idx_physio_cases_status     ON public.physio_cases(status);

ALTER TABLE public.physio_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read physio_cases"
  ON public.physio_cases FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 13. physio_sessions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.physio_sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  physio_case_id    uuid        NOT NULL REFERENCES public.physio_cases(id) ON DELETE CASCADE,
  session_date      date        NOT NULL,
  treatment_summary text,
  pain_score        integer     CHECK (pain_score BETWEEN 1 AND 10),
  mobility_score    integer     CHECK (mobility_score BETWEEN 1 AND 10),
  notes             text,
  next_session_date date,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physio_sessions_case_id ON public.physio_sessions(physio_case_id);

ALTER TABLE public.physio_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read physio_sessions"
  ON public.physio_sessions FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 14. psychology_cases
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.psychology_cases (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id             uuid        REFERENCES public.athletes(id) ON DELETE CASCADE,
  psychologist_profile_id uuid       REFERENCES public.profiles(id) ON DELETE SET NULL,
  status                 text        NOT NULL DEFAULT 'open',
  opened_at              date        NOT NULL,
  summary                text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psychology_cases_athlete_id ON public.psychology_cases(athlete_id);

ALTER TABLE public.psychology_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read psychology_cases"
  ON public.psychology_cases FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 15. psychology_sessions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.psychology_sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  psychology_case_id uuid       NOT NULL REFERENCES public.psychology_cases(id) ON DELETE CASCADE,
  session_date      date        NOT NULL,
  mood_score        integer     CHECK (mood_score BETWEEN 1 AND 10),
  stress_score      integer     CHECK (stress_score BETWEEN 1 AND 10),
  topic_summary     text,
  recommendations   text,
  next_session_date date,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psychology_sessions_case_id ON public.psychology_sessions(psychology_case_id);

ALTER TABLE public.psychology_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read psychology_sessions"
  ON public.psychology_sessions FOR SELECT TO authenticated USING (true);

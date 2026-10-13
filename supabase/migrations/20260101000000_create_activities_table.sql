-- =============================================================================
-- 20260101000000_create_activities_table.sql
-- Recreates public.activities for fresh branch replays. This table was
-- created manually in production outside the migration system, before any
-- migration in this repo referenced it. Reconstructed from the live schema
-- (information_schema, pg_indexes, pg_constraint, pg_enum) on 2026-09-05.
-- Positioned with a pre-2026 timestamp so it sorts before every consumer
-- (20260709000001, 20260720000001) without renumbering existing migrations.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.activity_status AS ENUM ('borrador', 'publicado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.activity_type AS ENUM ('evento_deportivo', 'consulta');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.activities (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                    public.activity_type NOT NULL,
  title                   text NOT NULL,
  slug                    text NOT NULL UNIQUE,
  description             text,
  event_date              date,
  location                text,
  tags                    text[] NOT NULL DEFAULT '{}',
  status                  public.activity_status NOT NULL DEFAULT 'borrador',
  editorial_eligible      boolean NOT NULL DEFAULT true,
  created_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notified_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  disciplina              text,
  especialidad            text,
  actividad_tipo          text,
  sede                    text,
  horario                 time,
  requerimiento           text,
  numero_participantes    integer,
  personal_requerido      text,
  equipo_requerido        text,
  objetivo                text,
  atencion_actividad      text,
  atencion_fecha          date,
  atencion_entregado_a    text,
  atencion_entregado_rol  text
);

CREATE INDEX IF NOT EXISTS idx_activities_status ON public.activities USING btree (status);
CREATE INDEX IF NOT EXISTS idx_activities_type ON public.activities USING btree (type);
CREATE INDEX IF NOT EXISTS idx_activities_event_date ON public.activities USING btree (event_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_tags ON public.activities USING gin (tags);

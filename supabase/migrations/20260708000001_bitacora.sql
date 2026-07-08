-- =============================================================================
-- 20260708000001_bitacora.sql
-- Módulo Bitácora: actividades, fotos, comentarios, narrativas AI, ediciones.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

CREATE TYPE activity_type     AS ENUM ('evento_deportivo', 'consulta');
CREATE TYPE activity_status   AS ENUM ('borrador', 'publicado');
CREATE TYPE narrative_status  AS ENUM ('borrador', 'aprobado', 'rechazado');
CREATE TYPE magazine_status   AS ENUM ('borrador', 'publicado');

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------

CREATE TABLE activities (
  id                 uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  type               activity_type NOT NULL,
  title              text          NOT NULL,
  slug               text          NOT NULL UNIQUE,
  description        text,                            -- ~300 chars sugerido, sin restrict
  event_date         date,
  location           text,
  tags               text[]        NOT NULL DEFAULT '{}',
  status             activity_status NOT NULL DEFAULT 'borrador',
  -- Controla si la actividad puede entrar al flujo de narrativa AI y Revista.
  -- Por defecto: true para evento_deportivo, false para consulta.
  -- Solo el staff puede cambiarlo explícitamente a true en una consulta.
  editorial_eligible boolean       NOT NULL DEFAULT true,
  created_by         uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  notified_at        timestamptz,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now()
);

-- Trigger: fijar editorial_eligible según type en INSERT si no se provee
CREATE OR REPLACE FUNCTION activities_set_editorial_eligible()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo aplicar si el caller no lo estableció explícitamente
  -- (el DEFAULT de la columna ya es true, así que solo corregimos consultas)
  IF NEW.type = 'consulta' THEN
    NEW.editorial_eligible := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_activities_editorial_eligible
  BEFORE INSERT ON activities
  FOR EACH ROW EXECUTE FUNCTION activities_set_editorial_eligible();

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Índices
CREATE INDEX idx_activities_status     ON activities(status);
CREATE INDEX idx_activities_type       ON activities(type);
CREATE INDEX idx_activities_event_date ON activities(event_date DESC);
CREATE INDEX idx_activities_tags       ON activities USING GIN(tags);
CREATE INDEX idx_activities_created_by ON activities(created_by);

-- ---------------------------------------------------------------------------
-- activity_photos
-- ---------------------------------------------------------------------------

CREATE TABLE activity_photos (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id   uuid        NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  storage_path  text        NOT NULL,  -- ruta dentro del bucket 'activity-photos'
  caption       text,
  display_order int         NOT NULL DEFAULT 0,
  alt_text      text        NOT NULL DEFAULT '',
  featured      boolean     NOT NULL DEFAULT false,  -- foto de portada/hero para Revista
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_photos_activity ON activity_photos(activity_id);
CREATE INDEX idx_activity_photos_featured ON activity_photos(activity_id, featured);

-- ---------------------------------------------------------------------------
-- activity_comments
-- ---------------------------------------------------------------------------

CREATE TABLE activity_comments (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id  uuid        NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  author_name  text        NOT NULL,
  author_email text,         -- no público, solo admin lo ve
  comment      text        NOT NULL,
  approved     boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_comments_activity ON activity_comments(activity_id);
CREATE INDEX idx_activity_comments_approved ON activity_comments(activity_id, approved);

-- ---------------------------------------------------------------------------
-- activity_narratives
-- ---------------------------------------------------------------------------

CREATE TABLE activity_narratives (
  id             uuid             DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id    uuid             NOT NULL UNIQUE REFERENCES activities(id) ON DELETE CASCADE,
  narrative_text text             NOT NULL,
  model_used     text             NOT NULL,  -- ej. 'claude-opus-4-7'
  status         narrative_status NOT NULL DEFAULT 'borrador',
  generated_at   timestamptz      NOT NULL DEFAULT now(),
  approved_by    uuid             REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at    timestamptz
);

CREATE INDEX idx_narratives_activity ON activity_narratives(activity_id);
CREATE INDEX idx_narratives_status   ON activity_narratives(status);

-- ---------------------------------------------------------------------------
-- magazine_issues
-- ---------------------------------------------------------------------------

CREATE TABLE magazine_issues (
  id            uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  title         text            NOT NULL,  -- ej. "Revista AO Deporte - Julio 2026"
  period_start  date,
  period_end    date,
  activity_ids  uuid[]          NOT NULL DEFAULT '{}',  -- actividades incluidas
  status        magazine_status NOT NULL DEFAULT 'borrador',
  published_at  timestamptz,
  notified_at   timestamptz,
  created_by    uuid            REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz     NOT NULL DEFAULT now(),
  updated_at    timestamptz     NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_magazine_issues_updated_at
  BEFORE UPDATE ON magazine_issues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_magazine_issues_status ON magazine_issues(status);

-- ---------------------------------------------------------------------------
-- Storage bucket: activity-photos
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'activity-photos',
  'activity-photos',
  true,           -- acceso público de lectura a URLs firmadas
  5242880,        -- 5 MB máximo por archivo (más compresión client-side → 300-800 KB real)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public read activity photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'activity-photos');

CREATE POLICY "Authenticated upload activity photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'activity-photos');

CREATE POLICY "Authenticated update activity photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'activity-photos');

CREATE POLICY "Authenticated delete activity photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'activity-photos');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE activities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_photos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_comments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_narratives ENABLE ROW LEVEL SECURITY;
ALTER TABLE magazine_issues     ENABLE ROW LEVEL SECURITY;

-- ── activities ──────────────────────────────────────────────────────────────

-- Lectura pública: solo actividades publicadas
CREATE POLICY "anon_read_published_activities"
  ON activities FOR SELECT
  TO anon
  USING (status = 'publicado');

-- Usuarios autenticados: acceso completo
CREATE POLICY "auth_full_access_activities"
  ON activities FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── activity_photos ─────────────────────────────────────────────────────────

-- Lectura pública: fotos de actividades publicadas
CREATE POLICY "anon_read_photos_of_published"
  ON activity_photos FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      WHERE a.id = activity_id AND a.status = 'publicado'
    )
  );

CREATE POLICY "auth_full_access_photos"
  ON activity_photos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── activity_comments ────────────────────────────────────────────────────────

-- Lectura pública: solo comentarios aprobados de actividades publicadas
CREATE POLICY "anon_read_approved_comments"
  ON activity_comments FOR SELECT
  TO anon
  USING (
    approved = true AND
    EXISTS (
      SELECT 1 FROM activities a
      WHERE a.id = activity_id AND a.status = 'publicado'
    )
  );

-- Inserción pública: cualquiera puede comentar (approved=false por defecto)
CREATE POLICY "anon_insert_comments"
  ON activity_comments FOR INSERT
  TO anon
  WITH CHECK (approved = false);

CREATE POLICY "auth_full_access_comments"
  ON activity_comments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── activity_narratives ──────────────────────────────────────────────────────

-- Lectura pública: solo narrativas aprobadas de actividades publicadas
CREATE POLICY "anon_read_approved_narratives"
  ON activity_narratives FOR SELECT
  TO anon
  USING (
    status = 'aprobado' AND
    EXISTS (
      SELECT 1 FROM activities a
      WHERE a.id = activity_id AND a.status = 'publicado'
    )
  );

CREATE POLICY "auth_full_access_narratives"
  ON activity_narratives FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── magazine_issues ──────────────────────────────────────────────────────────

CREATE POLICY "anon_read_published_issues"
  ON magazine_issues FOR SELECT
  TO anon
  USING (status = 'publicado');

CREATE POLICY "auth_full_access_issues"
  ON magazine_issues FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

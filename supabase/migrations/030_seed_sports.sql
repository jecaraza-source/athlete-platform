-- 030_seed_sports.sql
-- Seeds the sports table with the disciplines used by AO Deportes.
-- All sports are individual-category. Existing rows with the same name are skipped.
-- The production sports table was created manually outside the migration system
-- before this seed ran. Define it here for fresh branch replays; migration 043
-- retains the same idempotent DDL plus the RLS hardening that belongs there.
CREATE TABLE IF NOT EXISTS public.sports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        UNIQUE NOT NULL,
  category_type text        NOT NULL DEFAULT 'individual',
  status        text        NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sports_status ON public.sports(status);

INSERT INTO sports (name, category_type, status)
VALUES
  ('Judo',                           'individual', 'active'),
  ('Karate',                         'individual', 'active'),
  ('Taekwondo',                      'individual', 'active'),
  ('Athletics',                      'individual', 'active'),
  ('Swimming',                       'individual', 'active'),
  ('Canoeing',                       'individual', 'active'),
  ('Para Badminton',                 'individual', 'active'),
  ('Archery',                        'individual', 'active'),
  ('Sport Shooting',                 'individual', 'active'),
  ('Artistic Gymnastics (Women)',     'individual', 'active'),
  ('Breaking',                       'individual', 'active')
ON CONFLICT (name) DO NOTHING;

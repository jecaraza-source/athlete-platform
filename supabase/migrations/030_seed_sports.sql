-- 030_seed_sports.sql
-- Seeds the sports table with the disciplines used by AO Deportes.
-- All sports are individual-category. Existing rows with the same name are skipped.

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

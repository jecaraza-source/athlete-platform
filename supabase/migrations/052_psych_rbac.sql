-- =============================================================================
-- 052_psych_rbac.sql
-- Perfil Psicológico: rol y permisos RBAC.
-- =============================================================================

-- A clinical-access role that can be assigned to any qualified staff profile.
INSERT INTO public.roles (code, name, description, is_system)
VALUES (
  'mental_health_admin',
  'Administrador de Salud Mental',
  'Full clinical access to psychological assessments, scores, alerts, and instruments.',
  false
)
ON CONFLICT (code) DO NOTHING;

-- Granular permissions used by server-side route/action guards.
INSERT INTO public.permissions (name, description)
VALUES
  ('psych.read_raw', 'Read raw psychological assessment responses.'),
  ('psych.read_interpreted', 'Read interpreted psychological scores and bands.'),
  ('psych.write_interpretation', 'Write psychological scores and clinical interpretations.'),
  ('psych.manage_alerts', 'Review, acknowledge, and resolve psychological alerts.'),
  ('psych.manage_instruments', 'Create and maintain the psychological instrument catalogue.'),
  ('psych.publish_to_athlete', 'Publish an interpreted psychological assessment to its athlete.')
ON CONFLICT (name) DO NOTHING;

-- mental_health_admin receives the full psychological permission set.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.name IN (
  'psych.read_raw',
  'psych.read_interpreted',
  'psych.write_interpretation',
  'psych.manage_alerts',
  'psych.manage_instruments',
  'psych.publish_to_athlete'
)
WHERE r.code = 'mental_health_admin'
ON CONFLICT DO NOTHING;

-- Direction receives interpreted, alert-level access without raw clinical data.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.name IN (
  'psych.read_interpreted',
  'psych.manage_alerts'
)
WHERE r.code IN ('program_director', 'super_admin')
ON CONFLICT DO NOTHING;

-- Coaches receive interpreted access; RLS additionally limits it to their roster.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.name = 'psych.read_interpreted'
WHERE r.code = 'coach'
ON CONFLICT DO NOTHING;

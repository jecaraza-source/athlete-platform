-- =============================================================================
-- 004_medic_role.sql
-- Ensures the medic role exists and has the correct permissions assigned.
-- Safe to run multiple times (all statements are idempotent).
-- =============================================================================

-- 1. Insert the medic role if it doesn't already exist
INSERT INTO public.roles (code, name, description, is_system)
SELECT 'medic', 'Medic', 'Medical services and health monitoring', false
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'medic');

-- 2. Assign permissions: medic can view and edit athletes + view calendar
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name IN (
  'view_athletes',
  'edit_athletes',
  'view_calendar'
)
WHERE  r.code = 'medic'
ON CONFLICT DO NOTHING;

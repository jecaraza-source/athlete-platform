-- =============================================================================
-- 20260720000002_coordinator_edit_magazine.sql
--
-- Otorga el permiso edit_magazine al rol event_coordinator.
-- El permiso cubre tanto edición como creación de contenido de la Revista.
--
-- Permisos resultantes del event_coordinator:
--   - view_calendar
--   - newsletter.approve
--   - newsletter.view
--   - edit_magazine  ← nuevo
--
-- Idempotente: ON CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name = 'edit_magazine'
WHERE  r.code = 'event_coordinator'
ON CONFLICT DO NOTHING;

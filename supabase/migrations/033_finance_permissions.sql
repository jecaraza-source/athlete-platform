-- =============================================================================
-- 033_finance_permissions.sql
--
-- Permisos RBAC del módulo de Finanzas.
-- Idempotente: usa ON CONFLICT DO NOTHING.
--
-- Nuevos permisos
-- ---------------
--   view_finances        – Ver presupuestos, gastos, pagos, proveedores
--   manage_finances      – Crear/editar presupuestos, gastos, proveedores, pagos
--   approve_finances     – Aprobar o rechazar gastos
--   view_finance_reports – Acceder a reportes y métricas financieras
--
-- Nuevo rol
-- ---------
--   finance_admin        – Administrador financiero dedicado
--
-- Matriz de asignación
-- --------------------
--   Role              | view_finances | manage_finances | approve_finances | view_finance_reports
--   ------------------|---------------|-----------------|------------------|---------------------
--   super_admin       |      ✓        |       ✓         |        ✓         |         ✓
--   program_director  |      ✓        |       ✓         |        ✓         |         ✓
--   finance_admin     |      ✓        |       ✓         |        ✓         |         ✓
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Registrar nuevos permisos
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (name, description)
VALUES
  ('view_finances',
   'Ver presupuestos, partidas, gastos, pagos y proveedores del módulo financiero'),
  ('manage_finances',
   'Crear y editar presupuestos, partidas, gastos, pagos, proveedores y comprobantes'),
  ('approve_finances',
   'Aprobar, rechazar o marcar como pagados los gastos del módulo financiero'),
  ('view_finance_reports',
   'Acceder a reportes, métricas y resúmenes financieros')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Crear rol finance_admin
-- ---------------------------------------------------------------------------

INSERT INTO public.roles (code, name, description, is_system)
VALUES (
  'finance_admin',
  'Finance Admin',
  'Administrador financiero con acceso completo al módulo de finanzas',
  false
)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Asignar los cuatro permisos financieros a super_admin, program_director
--    y finance_admin
-- ---------------------------------------------------------------------------

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
CROSS JOIN public.permissions p
WHERE  r.code IN ('super_admin', 'program_director', 'finance_admin')
  AND  p.name IN (
    'view_finances',
    'manage_finances',
    'approve_finances',
    'view_finance_reports'
  )
ON CONFLICT DO NOTHING;

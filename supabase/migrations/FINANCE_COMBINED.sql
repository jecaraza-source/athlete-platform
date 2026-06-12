-- ============================================================
-- 032_finance_tables.sql
-- ============================================================
-- =============================================================================
-- 032_finance_tables.sql
--
-- Módulo de Finanzas / Gestión Económica
-- Crea todas las tablas financieras independientes del módulo de planes PDF.
-- Idempotente: usa IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Proveedores / Suppliers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_suppliers (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  rfc          TEXT,                       -- RFC / tax ID (México)
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  notes        TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_suppliers_active
  ON public.finance_suppliers(is_active, name);

-- ---------------------------------------------------------------------------
-- 2. Categorías de gasto
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_expense_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  color       TEXT,       -- hex color for UI badges, e.g. '#6366f1'
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed de categorías base
INSERT INTO public.finance_expense_categories (name, description, color)
VALUES
  ('Viáticos',          'Gastos de transporte, alojamiento y alimentación en desplazamientos', '#f59e0b'),
  ('Equipamiento',      'Compra de material deportivo, uniformes y accesorios',                '#10b981'),
  ('Servicios médicos', 'Honorarios médicos, fisioterapia, psicología y nutrición',            '#3b82f6'),
  ('Instalaciones',     'Renta de instalaciones deportivas, gimnasios y pistas',               '#8b5cf6'),
  ('Capacitación',      'Cursos, seminarios y certificaciones para staff',                    '#ec4899'),
  ('Competencias',      'Inscripciones, arbitrajes y costos de torneos y eventos',             '#ef4444'),
  ('Becas y apoyos',    'Apoyos económicos directos a atletas',                               '#14b8a6'),
  ('Administrativo',    'Papelería, software, servicios generales',                           '#6b7280'),
  ('Otro',              'Gastos varios no clasificados',                                       '#9ca3af')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Presupuestos (budgets)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_budgets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  description  TEXT,
  fiscal_year  INTEGER     NOT NULL,           -- e.g. 2025
  start_date   DATE        NOT NULL,
  end_date     DATE        NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('draft', 'active', 'closed', 'cancelled')),
  notes        TEXT,
  created_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_budgets_year
  ON public.finance_budgets(fiscal_year, status);

-- ---------------------------------------------------------------------------
-- 4. Partidas presupuestales (budget items)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_budget_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id   UUID        NOT NULL REFERENCES public.finance_budgets(id) ON DELETE CASCADE,
  category_id UUID        REFERENCES public.finance_expense_categories(id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_budget_items_budget
  ON public.finance_budget_items(budget_id);

-- ---------------------------------------------------------------------------
-- 5. Gastos (expenses)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_expenses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_item_id  UUID        REFERENCES public.finance_budget_items(id) ON DELETE SET NULL,
  category_id     UUID        NOT NULL REFERENCES public.finance_expense_categories(id) ON DELETE RESTRICT,
  supplier_id     UUID        REFERENCES public.finance_suppliers(id) ON DELETE SET NULL,
  -- Relación opcional con atleta (viáticos, becas, apoyos individuales)
  athlete_id      UUID        REFERENCES public.athletes(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  amount          NUMERIC(14,2) NOT NULL,
  expense_date    DATE        NOT NULL,
  invoice_number  TEXT,       -- número de factura / folio
  status          TEXT        NOT NULL DEFAULT 'draft'
                              CHECK (status IN (
                                'draft', 'submitted', 'approved',
                                'rejected', 'paid', 'cancelled'
                              )),
  notes           TEXT,
  created_by      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_expenses_status
  ON public.finance_expenses(status);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_category
  ON public.finance_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_athlete
  ON public.finance_expenses(athlete_id)
  WHERE athlete_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_expenses_date
  ON public.finance_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_budget_item
  ON public.finance_expenses(budget_item_id)
  WHERE budget_item_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. Pagos (payments)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_payments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id     UUID        NOT NULL REFERENCES public.finance_expenses(id) ON DELETE CASCADE,
  amount         NUMERIC(14,2) NOT NULL,
  payment_date   DATE        NOT NULL,
  payment_method TEXT        NOT NULL DEFAULT 'transfer'
                             CHECK (payment_method IN (
                               'transfer', 'check', 'cash', 'card', 'other'
                             )),
  reference      TEXT,       -- número de transferencia, cheque, etc.
  notes          TEXT,
  created_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_payments_expense
  ON public.finance_payments(expense_id);
CREATE INDEX IF NOT EXISTS idx_finance_payments_date
  ON public.finance_payments(payment_date DESC);

-- ---------------------------------------------------------------------------
-- 7. Comprobantes / Adjuntos financieros
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_attachments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id          UUID        NOT NULL REFERENCES public.finance_expenses(id) ON DELETE CASCADE,
  file_name_original  TEXT        NOT NULL,
  file_name_storage   TEXT        NOT NULL,
  file_path           TEXT        NOT NULL,
  mime_type           TEXT        NOT NULL,
  file_extension      TEXT        NOT NULL,
  file_size           BIGINT      NOT NULL,
  description         TEXT,
  uploaded_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  deleted_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_finance_attachments_expense
  ON public.finance_attachments(expense_id, is_active);

-- ---------------------------------------------------------------------------
-- 8. Aprobaciones
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_approvals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id   UUID        NOT NULL REFERENCES public.finance_expenses(id) ON DELETE CASCADE,
  action       TEXT        NOT NULL
               CHECK (action IN ('submitted', 'approved', 'rejected', 'paid', 'cancelled')),
  performed_by UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_approvals_expense
  ON public.finance_approvals(expense_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 9. Registro de actividad
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_activity_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT        NOT NULL,  -- 'expense' | 'budget' | 'supplier' | 'payment'
  entity_id    UUID        NOT NULL,
  action       TEXT        NOT NULL,
  performed_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_activity_entity
  ON public.finance_activity_log(entity_type, entity_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 10. Trigger updated_at — reutiliza la función creada en 005_tickets.sql
--     Si aún no existe la función, la creamos aquí también.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_suppliers_updated_at       ON public.finance_suppliers;
DROP TRIGGER IF EXISTS finance_budgets_updated_at         ON public.finance_budgets;
DROP TRIGGER IF EXISTS finance_budget_items_updated_at    ON public.finance_budget_items;
DROP TRIGGER IF EXISTS finance_expenses_updated_at        ON public.finance_expenses;

CREATE TRIGGER finance_suppliers_updated_at
  BEFORE UPDATE ON public.finance_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER finance_budgets_updated_at
  BEFORE UPDATE ON public.finance_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER finance_budget_items_updated_at
  BEFORE UPDATE ON public.finance_budget_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER finance_expenses_updated_at
  BEFORE UPDATE ON public.finance_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 11. Row Level Security
--     Todas las mutaciones pasan por supabaseAdmin (service role, bypass RLS).
--     Las policies de SELECT protegen lecturas directas del cliente.
-- ---------------------------------------------------------------------------

ALTER TABLE public.finance_suppliers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_budgets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_budget_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_attachments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_approvals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_activity_log      ENABLE ROW LEVEL SECURITY;

-- Solo usuarios con rol financiero o admin pueden leer datos financieros
CREATE POLICY "Finance roles can read finance_suppliers"
  ON public.finance_suppliers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

CREATE POLICY "Finance roles can read finance_expense_categories"
  ON public.finance_expense_categories FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

CREATE POLICY "Finance roles can read finance_budgets"
  ON public.finance_budgets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

CREATE POLICY "Finance roles can read finance_budget_items"
  ON public.finance_budget_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

CREATE POLICY "Finance roles can read finance_expenses"
  ON public.finance_expenses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

CREATE POLICY "Finance roles can read finance_payments"
  ON public.finance_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

CREATE POLICY "Finance roles can read finance_attachments"
  ON public.finance_attachments FOR SELECT TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

CREATE POLICY "Finance roles can read finance_approvals"
  ON public.finance_approvals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

CREATE POLICY "Finance roles can read finance_activity_log"
  ON public.finance_activity_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );


-- ============================================================
-- 033_finance_permissions.sql
-- ============================================================
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


-- ============================================================
-- 034_finance_storage.sql
-- ============================================================
-- =============================================================================
-- 034_finance_storage.sql
--
-- Bucket privado `finance-files` para comprobantes y adjuntos financieros.
-- Path convention:
--   finance-files/{expense_id}/{file_name_storage}
--
-- Políticas de storage.objects:
--   INSERT — usuarios con rol financiero pueden subir archivos
--   SELECT — usuarios con rol financiero pueden leer / crear signed URLs
--   DELETE — usuarios con rol financiero pueden eliminar
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Crear bucket (idempotente: INSERT ... ON CONFLICT DO NOTHING)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'finance-files',
  'finance-files',
  false,
  52428800,    -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/csv',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. INSERT policy — usuarios con rol financiero pueden subir comprobantes
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Finance roles can upload to finance-files" ON storage.objects;

CREATE POLICY "Finance roles can upload to finance-files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'finance-files'
    AND EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. SELECT policy — usuarios con rol financiero pueden leer / signed URLs
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Finance roles can read finance-files" ON storage.objects;

CREATE POLICY "Finance roles can read finance-files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'finance-files'
    AND EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 4. DELETE policy — usuarios con rol financiero pueden eliminar archivos
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Finance roles can delete finance-files" ON storage.objects;

CREATE POLICY "Finance roles can delete finance-files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'finance-files'
    AND EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );


-- ============================================================
-- 035_seed_obregonense_2026.sql
-- ============================================================
-- =============================================================================
-- 035_seed_obregonense_2026.sql
--
-- Seed: Presupuesto General Equipo Obregonense 2026
--
-- Fuente: "Equipo Obregonense 2026.xlsx" — Hoja GENERAL
-- Estructura:
--   1 presupuesto general → 15 partidas (1 por disciplina / rubro)
--
-- Totales por partida (extraídos de la columna "TOTAL X DISCIPLINA"):
--   Equipamiento deportivo
--     TIRO            1,439,588
--     CANOTAJE          769,745
--     TKD               946,709
--     JUDO              735,546
--     KARATE            300,251
--     ATLETISMO         170,167
--     GIMNASIA          169,614
--     NATACIÓN          137,472
--     BOX               104,536
--     BÁDMINTON          97,696
--     BREAKING           47,678
--   Otros rubros
--     Nutrición / Suplementos   187,800
--     Transporte (aéreo + terrestre dedicado + ADO)  578,500
--     Hospedaje                  10,700
--     Viáticos en destino         3,800
--   ─────────────────────────────────
--   TOTAL GENERAL           5,699,802
--
-- Idempotente: usa INSERT … ON CONFLICT DO NOTHING para el budget.
-- Las partidas se insertan condicionalmente solo si el budget existe y
-- no tiene partidas aún.
-- =============================================================================

DO $$
DECLARE
  v_budget_id      UUID;
  v_cat_equipo     UUID;
  v_cat_viaticos   UUID;
  v_cat_otro       UUID;
BEGIN

  -- ------------------------------------------------------------------
  -- 1. Resolver IDs de categorías existentes (sembradas en 032)
  -- ------------------------------------------------------------------
  SELECT id INTO v_cat_equipo
    FROM public.finance_expense_categories WHERE name = 'Equipamiento' LIMIT 1;

  SELECT id INTO v_cat_viaticos
    FROM public.finance_expense_categories WHERE name = 'Viáticos' LIMIT 1;

  SELECT id INTO v_cat_otro
    FROM public.finance_expense_categories WHERE name = 'Otro' LIMIT 1;

  -- Fallback: si las categorías no existen aún (migración 032 no aplicada)
  -- no insertamos nada para no romper FK.
  IF v_cat_equipo IS NULL OR v_cat_viaticos IS NULL OR v_cat_otro IS NULL THEN
    RAISE NOTICE '035_seed: categorías financieras no encontradas. Asegúrate de aplicar 032_finance_tables.sql primero.';
    RETURN;
  END IF;

  -- ------------------------------------------------------------------
  -- 2. Crear el presupuesto (idempotente por nombre + año fiscal)
  -- ------------------------------------------------------------------
  INSERT INTO public.finance_budgets (
    name, description, fiscal_year,
    start_date, end_date, total_amount, status, notes
  )
  VALUES (
    'Presupuesto General Equipo Obregonense 2026',
    'Presupuesto integral para la temporada 2026 del Equipo Obregonense: equipamiento deportivo por disciplina, nutrición y suplementos, transporte, hospedaje y viáticos.',
    2026,
    '2026-01-01',
    '2026-12-31',
    5699802.00,
    'active',
    'Fuente: "Equipo Obregonense 2026.xlsx". Aprobado para gestión en plataforma AO Deportes.'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_budget_id;

  -- Si ya existía, obtenerlo por nombre
  IF v_budget_id IS NULL THEN
    SELECT id INTO v_budget_id
      FROM public.finance_budgets
     WHERE name = 'Presupuesto General Equipo Obregonense 2026'
       AND fiscal_year = 2026
     LIMIT 1;
  END IF;

  IF v_budget_id IS NULL THEN
    RAISE NOTICE '035_seed: no se pudo crear ni encontrar el presupuesto.';
    RETURN;
  END IF;

  -- Si ya hay partidas, no duplicar
  IF EXISTS (SELECT 1 FROM public.finance_budget_items WHERE budget_id = v_budget_id) THEN
    RAISE NOTICE '035_seed: el presupuesto ya tiene partidas. Seed omitido.';
    RETURN;
  END IF;

  -- ------------------------------------------------------------------
  -- 3. Insertar partidas presupuestales
  -- ------------------------------------------------------------------

  -- ── Disciplinas de equipamiento ──────────────────────────────────
  INSERT INTO public.finance_budget_items (budget_id, category_id, name, description, amount)
  VALUES
    (v_budget_id, v_cat_equipo, 'Tiro',
     'Equipo especializado, uniformes e insumos para la disciplina de Tiro Deportivo',
     1439588.00),

    (v_budget_id, v_cat_equipo, 'Canotaje',
     'Equipo especializado, simuladores, uniformes e indumentaria AO para Canotaje',
     769745.00),

    (v_budget_id, v_cat_equipo, 'Taekwondo (TKD)',
     'Doboks, equipo electrónico KPNP / Daedo, protecciones y uniformes AO para TKD',
     946709.00),

    (v_budget_id, v_cat_equipo, 'Judo',
     'Tatamis Fuji Mats, judogis Mizuno/Fuji aprobados IJF y uniformes AO para Judo',
     735546.00),

    (v_budget_id, v_cat_equipo, 'Karate',
     'Combinaciones Arawaza, protecciones WKF y uniformes AO para Karate',
     300251.00),

    (v_budget_id, v_cat_equipo, 'Atletismo',
     'Tenis de competencia, ropa de licra y uniformes AO para Atletismo',
     170167.00),

    (v_budget_id, v_cat_equipo, 'Gimnasia',
     'Leotardos, calleras, trajes de gala y uniformes AO para Gimnasia',
     169614.00),

    (v_budget_id, v_cat_equipo, 'Natación',
     'Trajes, gorras, licras y uniformes AO para Natación',
     137472.00),

    (v_budget_id, v_cat_equipo, 'Box',
     'Shorts de boxeo, protectores, vendajes, calzado y uniformes AO para Box',
     104536.00),

    (v_budget_id, v_cat_equipo, 'Bádminton',
     'Raquetas Yonex, encordados, lanzaderas y uniformes AO para Bádminton',
     97696.00),

    (v_budget_id, v_cat_equipo, 'Breaking',
     'Pantalones, tenis de danza y uniformes AO para Breaking',
     47678.00),

  -- ── Nutrición y suplementos ───────────────────────────────────────
    (v_budget_id, v_cat_otro, 'Nutrición y suplementos',
     'Proteína Isopure 3LB (120 unidades) + Gatorade en polvo galón (120 unidades) para todos los atletas',
     187800.00),

  -- ── Transporte ────────────────────────────────────────────────────
    (v_budget_id, v_cat_viaticos, 'Transporte',
     'Transporte aéreo (boletos ida/vuelta a GDL, MTY, TIJ, MER, VER) + transporte terrestre dedicado y ADO a sedes de competencia nacionales: León, Puebla, CDMX, Progreso Yucatán, Acapulco, Guadalajara, Tlaxcala',
     578500.00),

  -- ── Hospedaje ─────────────────────────────────────────────────────
    (v_budget_id, v_cat_viaticos, 'Hospedaje',
     'Hotel ONE / City Express — habitación sencilla por noche en sedes: León, Monterrey, Puebla, Progreso Yucatán, Acapulco, Guadalajara, Tlaxcala',
     10700.00),

  -- ── Viáticos en destino ───────────────────────────────────────────
    (v_budget_id, v_cat_viaticos, 'Viáticos en destino',
     'Gastos de alimentación y movilidad local por destino: León, Monterrey, Puebla, Progreso Yucatán, Acapulco, Guadalajara, Tlaxcala',
     3800.00);

  RAISE NOTICE '035_seed: presupuesto "Equipo Obregonense 2026" creado con 15 partidas. Total: $5,699,802 MXN';

END $$;


-- ============================================================
-- 036_budget_line_items.sql
-- ============================================================
-- =============================================================================
-- 036_budget_line_items.sql
--
-- Tabla de artículos detallados por presupuesto.
-- Almacena cada renglón del Excel: tipo de equipo, disciplina/ciudad,
-- artículo, unidades, precio unitario y total.
-- Idempotente: usa IF NOT EXISTS.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.finance_budget_line_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id       UUID          NOT NULL REFERENCES public.finance_budgets(id) ON DELETE CASCADE,

  -- Columnas del Excel
  tipo_equipo     TEXT          NOT NULL,   -- ej. "Equipo especializado", "Viáticos", "Hospedaje"
  disciplina      TEXT          NOT NULL,   -- disciplina deportiva o ciudad para viáticos/transporte
  articulo        TEXT          NOT NULL,   -- descripción del artículo
  unidades        NUMERIC(10,2) NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(unidades * precio_unitario, 2)) STORED,

  notas           TEXT,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Índices para filtros y ordenamiento
CREATE INDEX IF NOT EXISTS idx_fbli_budget        ON public.finance_budget_line_items(budget_id);
CREATE INDEX IF NOT EXISTS idx_fbli_tipo          ON public.finance_budget_line_items(budget_id, tipo_equipo);
CREATE INDEX IF NOT EXISTS idx_fbli_disciplina    ON public.finance_budget_line_items(budget_id, disciplina);
CREATE INDEX IF NOT EXISTS idx_fbli_tipo_disc     ON public.finance_budget_line_items(tipo_equipo, disciplina);

-- Trigger updated_at
DROP TRIGGER IF EXISTS finance_budget_line_items_updated_at ON public.finance_budget_line_items;
CREATE TRIGGER finance_budget_line_items_updated_at
  BEFORE UPDATE ON public.finance_budget_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.finance_budget_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles can read finance_budget_line_items"
  ON public.finance_budget_line_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );


-- ============================================================
-- 037_seed_line_items.sql
-- ============================================================
-- =============================================================================
-- 037_seed_line_items.sql
--
-- Seed: todos los artículos del "Presupuesto 2026.xlsx" — Hoja GENERAL
-- Fuente: Equipo Obregonense 2026 (187 renglones)
--
-- Idempotente: solo inserta si no existen renglones para ese presupuesto.
-- =============================================================================

DO $$
DECLARE
  v_budget_id UUID;
BEGIN
  -- Obtener el ID del presupuesto Obregonense 2026
  SELECT id INTO v_budget_id
    FROM public.finance_budgets
   WHERE name = 'Presupuesto General Equipo Obregonense 2026'
     AND fiscal_year = 2026
   LIMIT 1;

  IF v_budget_id IS NULL THEN
    RAISE NOTICE '037_seed: presupuesto Obregonense 2026 no encontrado. Aplica 035 primero.';
    RETURN;
  END IF;

  -- Verificar si ya existen renglones
  IF EXISTS (SELECT 1 FROM public.finance_budget_line_items WHERE budget_id = v_budget_id LIMIT 1) THEN
    RAISE NOTICE '037_seed: ya existen artículos para este presupuesto. Seed omitido.';
    RETURN;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- TIRO (22 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'TIRO', 'BLANCO ELECTRÓNICO SIUS Mod HS10 CON UNIDAD DE CONTROL Y MONITOR CU951', 2, 163900),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'RIFLE DE AIRE FEINWERKBAU Mod 800x', 2, 107030),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'RIFLE DE AIRE WALTHER Mod LG400 COMPETICIÓN', 2, 85360),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'PISTOLA DE AIRE STEYR Mod EVO10', 3, 77000),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'PISTOLA DE AIRE FEINWERKBAU Mod P8x', 3, 77000),
    (v_budget_id, 'Uniforme especializado','TIRO', 'TRAJE PARA TIRO (CHAMARRA PANTALÓN CORREA HANDSTOP)', 2, 18700),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'TRIPIE PARA TIRO AHG', 2, 7150),
    (v_budget_id, 'Uniforme especializado','TIRO', 'ZAPATOS PARA TIRO CON PISTOLA AHG', 3, 6600),
    (v_budget_id, 'Uniforme especializado','TIRO', 'BOTAS PARA TIRO CON RIFLE AHG', 2, 6600),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'GUANTE PARA TIRO', 2, 1500),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'RODILLO PARA TIRO AHG', 2, 1425),
    (v_budget_id, 'Insumos',              'TIRO', 'DIÁBOLOS RWS Mod R10 PISTOLA PARA TIRO DEPORTIVO', 100, 462),
    (v_budget_id, 'Insumos',              'TIRO', 'DIÁBOLOS RWS Mod R10 RIFLE PARA TIRO DEPORTIVO', 100, 462),
    (v_budget_id, 'Insumos',              'TIRO', 'BLANCOS PARA TIRO CON PISTOLA DE AIRE KRUGER', 30, 300),
    (v_budget_id, 'Insumos',              'TIRO', 'DIÁBOLOS RWS Mod BASIC PARA TIRO DEPORTIVO', 100, 231),
    (v_budget_id, 'Insumos',              'TIRO', 'BLANCOS PARA TIRO CON RIFLE DE AIRE KRUGER', 30, 150),
    (v_budget_id, 'Equipo / Uniforme AO', 'TIRO', 'Conjunto AO', 7, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'TIRO', 'Polo AO', 7, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'TIRO', 'Chamarra licra AO', 7, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'TIRO', 'Short AO', 7, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'TIRO', 'Chamarra nilón hombre AO', 7, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'TIRO', 'Chamarra nilón mujer AO', 7, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- CANOTAJE (18 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'CANOTAJE', 'BOTE K-1, NELO', 1, 110475),
    (v_budget_id, 'Equipo especializado',  'CANOTAJE', 'BOTE C-1, NELO', 1, 102720),
    (v_budget_id, 'Equipo especializado',  'CANOTAJE', 'PALAS CANOA, BRACA EXTRA WIDE', 4, 15000),
    (v_budget_id, 'Equipo especializado',  'CANOTAJE', 'PALAS KAYAK, BRACA IV MÁXIMA', 4, 15000),
    (v_budget_id, 'Equipo especializado',  'CANOTAJE', 'CORCHOS, BRACA', 14, 1300),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'RELOJ, GARMIN', 2, 9450),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'LENTES, OAKLEY PARA SOL', 14, 4549),
    (v_budget_id, 'Equipo especializado',  'CANOTAJE', 'SIMULADORES PARA CANOTAJE, DANCPRINT. PRO', 2, 120000),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'TENIS / RUN', 14, 1999),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'PLAYERA LICRA HOMBRES', 7, 649),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'PLAYERA LICRA MUJER', 7, 599),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'Conjunto AO', 15, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'Polo AO', 15, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'Chamarra licra AO', 7, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'Short AO', 7, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'Chamarra nilón hombre AO', 7, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'Chamarra nilón mujer AO', 7, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- BÁDMINTON (11 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'BÁDMINTON', 'ASTROX 99 GAME (WHITE TIGER), YONEX RAQUETA MENÚ', 6, 3649),
    (v_budget_id, 'Equipo especializado',  'BÁDMINTON', 'ASTROX 99 GAME (WHITE TIGER), YONEX RAQUETA WOMAN', 6, 2799),
    (v_budget_id, 'Equipo especializado',  'BÁDMINTON', 'CASCADA DRIVE BÁDMINTON (GRAY PALE GREEN), YONEX TENIS', 6, 2210),
    (v_budget_id, 'Equipo especializado',  'BÁDMINTON', 'ROLLO BG65 TITANIUM', 6, 2300),
    (v_budget_id, 'Equipo especializado',  'BÁDMINTON', 'Lanzadera de Bádminton de plumas de pato, 12 piezas, para competición', 6, 680),
    (v_budget_id, 'Equipo / Uniforme AO', 'BÁDMINTON', 'Conjunto AO', 6, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'BÁDMINTON', 'Polo AO', 7, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'BÁDMINTON', 'Chamarra licra AO', 7, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'BÁDMINTON', 'Short AO', 6, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'BÁDMINTON', 'Chamarra nilón hombre AO', 4, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'BÁDMINTON', 'Chamarra nilón mujer AO', 2, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- JUDO (12 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'JUDO', 'Tatami Fuji Mats 2m x 1m x 4cm rojos', 40, 7100),
    (v_budget_id, 'Equipo especializado',  'JUDO', 'Tatami Fuji Mats 2m x 1m x 4cm amarillos', 32, 7100),
    (v_budget_id, 'Uniforme especializado','JUDO', 'Judogis mizuno aprobado IJF blanco', 10, 5500),
    (v_budget_id, 'Uniforme especializado','JUDO', 'Judogis mizuno aprobado IJF azul', 10, 5500),
    (v_budget_id, 'Uniforme especializado','JUDO', 'Judogis fuji de competencia blancos', 10, 3200),
    (v_budget_id, 'Uniforme especializado','JUDO', 'Judogis fuji de competencia azul', 10, 3200),
    (v_budget_id, 'Equipo / Uniforme AO', 'JUDO', 'Conjunto AO', 12, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'JUDO', 'Polo AO', 12, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'JUDO', 'Chamarra licra AO', 10, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'JUDO', 'Short AO', 10, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'JUDO', 'Chamarra nilón hombre AO', 5, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'JUDO', 'Chamarra nilón mujer AO', 5, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- KARATE (22 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Uniforme especializado','KARATE', 'Combo Black Diamond Premiere League', 11, 8040),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Onyx REV-X', 11, 5450),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Espinilleras Con Empeineras WKF (azules)', 11, 1300),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Espinilleras Con Empeineras WKF (rojas)', 11, 1300),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Nudilleras WKF / Azul', 11, 780),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Nudilleras WKF / Rojo', 11, 780),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Cinta Estilo Japonés de Algodón (azul)', 11, 280),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Cinta Estilo Japonés de Algodón (rojo)', 11, 280),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Cinta Kata Estilo Japonés (azul)', 11, 640),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Cinta Kata Estilo Japonés (rojo)', 11, 640),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Protector Corporal WKF', 5, 2140),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Protector Corporal Femenil WKF 2 en 1', 5, 2350),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Protector de Plástico para Pecho con tirantes', 5, 440),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Protector Corporal U14 WKF', 1, 1890),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Casco Arawaza WKF', 1, 2375),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Mochila Arawaza', 11, 600),
    (v_budget_id, 'Equipo / Uniforme AO', 'KARATE', 'Conjunto AO', 12, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'KARATE', 'Polo AO', 12, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'KARATE', 'Chamarra licra AO', 10, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'KARATE', 'Short AO', 10, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'KARATE', 'Chamarra nilón hombre AO', 5, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'KARATE', 'Chamarra nilón mujer AO', 5, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- TKD / TAEKWONDO (24 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'TKD', 'Dobok olímpico', 15, 4900),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Cinta negra', 15, 450),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Espinilleras', 15, 999),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Antebraceras', 15, 910),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Suspensorio', 7, 799),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Guantes', 15, 1099),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Bucal', 15, 35),
    (v_budget_id, 'Equipo especializado',  'TKD', 'ASIANA DOMI', 15, 3000),
    (v_budget_id, 'Equipo especializado',  'TKD', 'ASIANA PAO', 15, 1750),
    (v_budget_id, 'Equipo especializado',  'TKD', 'ASIANA PALCHAGUI DOBLE ADULTO', 15, 850),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Ligas de resistencia', 10, 900),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Bandas de resistencia', 10, 900),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Petos kpnp k2 talla 3', 3, 90000),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Empeineras electrónicas kpnp k2', 15, 3000),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Caretas electrónicas kpnp k2 talla M', 3, 65000),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Petos electrónicos daedo generación 3 talla 3', 3, 15000),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Empeineras electrónicas daedo G3', 10, 2700),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Caretas electrónicas daedo talla M', 4, 14999),
    (v_budget_id, 'Equipo / Uniforme AO', 'TKD', 'Conjunto AO', 15, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'TKD', 'Polo AO', 15, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'TKD', 'Chamarra licra AO', 15, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'TKD', 'Short AO', 15, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'TKD', 'Chamarra nilón hombre AO', 7, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'TKD', 'Chamarra nilón mujer AO', 8, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- GIMNASIA (11 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Uniforme especializado','GIMNASIA', 'Leotardo', 10, 1800),
    (v_budget_id, 'Equipo especializado',  'GIMNASIA', 'Traje gala', 10, 4599),
    (v_budget_id, 'Equipo especializado',  'GIMNASIA', 'Calleras para barras', 10, 1255),
    (v_budget_id, 'Uniforme especializado','GIMNASIA', 'Calleras para gimnasia', 10, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Licras', 10, 899),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Ligas / Estiramiento', 10, 855),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Conjunto AO', 12, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Polo AO', 12, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Chamarra licra AO', 10, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Short AO', 10, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Chamarra nilón mujer AO', 12, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- BREAKING (6 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo / Uniforme AO', 'BREAKING', 'Pantalón', 4, 1800),
    (v_budget_id, 'Equipo / Uniforme AO', 'BREAKING', 'TENIS / RUN', 4, 4599),
    (v_budget_id, 'Equipo / Uniforme AO', 'BREAKING', 'Conjunto AO', 5, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'BREAKING', 'Polo AO', 5, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'BREAKING', 'Chamarra licra AO', 4, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'BREAKING', 'Chamarra nilón mujer AO', 4, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- ATLETISMO (9 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Uniforme especializado','ATLETISMO', 'TENIS / RUN', 14, 3499),
    (v_budget_id, 'Uniforme especializado','ATLETISMO', 'PLAYERA LICRA HOMBRES', 7, 899),
    (v_budget_id, 'Uniforme especializado','ATLETISMO', 'PLAYERA LICRA MUJER', 7, 899),
    (v_budget_id, 'Uniforme especializado','ATLETISMO', 'SHORT LICRA', 7, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'ATLETISMO', 'Conjunto AO', 25, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'ATLETISMO', 'Polo AO', 25, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'ATLETISMO', 'Chamarra licra AO', 25, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'ATLETISMO', 'Chamarra nilón hombre AO', 12, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'ATLETISMO', 'Chamarra nilón mujer AO', 11, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- NATACIÓN (8 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'NATACIÓN', 'Traje de natación', 19, 1299),
    (v_budget_id, 'Equipo especializado',  'NATACIÓN', 'Gorra de natación', 19, 799),
    (v_budget_id, 'Equipo especializado',  'NATACIÓN', 'Licras', 19, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'NATACIÓN', 'Conjunto AO', 21, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'NATACIÓN', 'Polo AO', 21, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'NATACIÓN', 'Chamarra licra AO', 10, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'NATACIÓN', 'Chamarra nilón hombre AO', 9, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'NATACIÓN', 'Chamarra nilón mujer AO', 10, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- BOX (9 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'BOX', 'SHORT BOXEO', 8, 2499),
    (v_budget_id, 'Equipo especializado',  'BOX', 'PROTECTOR', 8, 1299),
    (v_budget_id, 'Equipo especializado',  'BOX', 'VENDAJES', 8, 1499),
    (v_budget_id, 'Equipo especializado',  'BOX', 'Calzado BOX', 8, 3200),
    (v_budget_id, 'Equipo / Uniforme AO', 'BOX', 'Conjunto AO', 10, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'BOX', 'Polo AO', 10, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'BOX', 'Chamarra licra AO', 10, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'BOX', 'Chamarra nilón hombre AO', 9, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'BOX', 'Chamarra nilón mujer AO', 1, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- NUTRICIÓN (2 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Insumos', 'NUTRICIÓN', 'ISOPURE 3LB', 120, 1450),
    (v_budget_id, 'Insumos', 'NUTRICIÓN', 'Gatorade® en Polvo - 1 Galón, Ponche de Frutas', 120, 115);

  -- ─────────────────────────────────────────────────────────────────────────
  -- TRANSPORTE AÉREO (5 destinos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Transporte Aéreo', 'Guadalajara, Jal. (GDL)', 'Avión (Boleto Ida y Vuelta)', 1, 3500),
    (v_budget_id, 'Transporte Aéreo', 'Monterrey, N.L. (MTY)',   'Avión (Boleto Ida y Vuelta)', 1, 3500),
    (v_budget_id, 'Transporte Aéreo', 'Tijuana, B.C. (TIJ)',     'Avión (Boleto Ida y Vuelta)', 1, 5500),
    (v_budget_id, 'Transporte Aéreo', 'Mérida, Yuc. (MER)',      'Avión (Boleto Ida y Vuelta)', 1, 5500),
    (v_budget_id, 'Transporte Aéreo', 'Veracruz, Ver. (VER)',    'Avión (Boleto Ida y Vuelta)', 1, 4000);

  -- ─────────────────────────────────────────────────────────────────────────
  -- TRANSPORTE TERRESTRE DEDICADO (8 ciudades)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Transporte terrestre (Ded)', 'León, Gto.',          'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 3190),
    (v_budget_id, 'Transporte terrestre (Ded)', 'Puebla, Pue.',        'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 1210),
    (v_budget_id, 'Transporte terrestre (Ded)', 'CDMX (COM)',          'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 770),
    (v_budget_id, 'Transporte terrestre (Ded)', 'Progreso, Yuc.',      'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 10802),
    (v_budget_id, 'Transporte terrestre (Ded)', 'Acapulco, Gro.',      'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 3795),
    (v_budget_id, 'Transporte terrestre (Ded)', 'CDMX',                'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 1540),
    (v_budget_id, 'Transporte terrestre (Ded)', 'Guadalajara, Jal.',   'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 4686),
    (v_budget_id, 'Transporte terrestre (Ded)', 'Tlaxcala, Tlax.',     'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 1155);

  -- ─────────────────────────────────────────────────────────────────────────
  -- TRANSPORTE TERRESTRE ADO (6 ciudades)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Transporte terrestre (ADO)', 'León, Gto.',        'Camión (Boleto Ida y Vuelta)', 1, 2150),
    (v_budget_id, 'Transporte terrestre (ADO)', 'Puebla, Pue.',      'Camión (Boleto Ida y Vuelta)', 1, 850),
    (v_budget_id, 'Transporte terrestre (ADO)', 'Progreso, Yuc.',    'Camión (Boleto Ida y Vuelta)', 1, 4650),
    (v_budget_id, 'Transporte terrestre (ADO)', 'Acapulco, Gro.',    'Camión (Boleto Ida y Vuelta)', 1, 1065),
    (v_budget_id, 'Transporte terrestre (ADO)', 'Guadalajara, Jal.', 'Camión (Boleto Ida y Vuelta)', 1, 2850),
    (v_budget_id, 'Transporte terrestre (ADO)', 'Tlaxcala, Tlax.',   'Camión (Boleto Ida y Vuelta)', 1, 1975);

  -- ─────────────────────────────────────────────────────────────────────────
  -- HOSPEDAJE (7 ciudades)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Hospedaje', 'León, Gto.',         'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1500),
    (v_budget_id, 'Hospedaje', 'Monterrey, N.L.',    'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1700),
    (v_budget_id, 'Hospedaje', 'Puebla, Pue.',       'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1500),
    (v_budget_id, 'Hospedaje', 'Progreso, Yuc.',     'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1500),
    (v_budget_id, 'Hospedaje', 'Acapulco, Gro.',     'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1500),
    (v_budget_id, 'Hospedaje', 'Guadalajara, Jal.',  'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1500),
    (v_budget_id, 'Hospedaje', 'Tlaxcala, Tlax.',    'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1500);

  -- ─────────────────────────────────────────────────────────────────────────
  -- VIÁTICOS (7 ciudades)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Viáticos', 'León, Gto.',         'Viático diario (alimentación y movilidad)', 1, 500),
    (v_budget_id, 'Viáticos', 'Monterrey, N.L.',    'Viático diario (alimentación y movilidad)', 1, 700),
    (v_budget_id, 'Viáticos', 'Puebla, Pue.',       'Viático diario (alimentación y movilidad)', 1, 500),
    (v_budget_id, 'Viáticos', 'Progreso, Yuc.',     'Viático diario (alimentación y movilidad)', 1, 500),
    (v_budget_id, 'Viáticos', 'Acapulco, Gro.',     'Viático diario (alimentación y movilidad)', 1, 600),
    (v_budget_id, 'Viáticos', 'Guadalajara, Jal.',  'Viático diario (alimentación y movilidad)', 1, 500),
    (v_budget_id, 'Viáticos', 'Tlaxcala, Tlax.',    'Viático diario (alimentación y movilidad)', 1, 500);

  RAISE NOTICE '037_seed: % artículos sembrados para el presupuesto Obregonense 2026.',
    (SELECT COUNT(*) FROM public.finance_budget_line_items WHERE budget_id = v_budget_id);

END $$;


-- ============================================================
-- 038_expense_disciplina.sql
-- ============================================================
-- =============================================================================
-- 038_expense_disciplina.sql
--
-- Agrega el campo disciplina a finance_expenses para vincular cada gasto
-- a una disciplina deportiva, ciudad de viáticos o rubro específico.
-- Idempotente: usa IF NOT EXISTS.
-- =============================================================================

ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS disciplina TEXT;

CREATE INDEX IF NOT EXISTS idx_finance_expenses_disciplina
  ON public.finance_expenses(disciplina)
  WHERE disciplina IS NOT NULL;

COMMENT ON COLUMN public.finance_expenses.disciplina IS
  'Disciplina deportiva o rubro al que pertenece el gasto (ej. TIRO, CANOTAJE, Viáticos - León, etc.)';


-- ============================================================
-- 039_supplier_disciplina.sql
-- ============================================================
-- =============================================================================
-- 039_supplier_disciplina.sql
--
-- Agrega el campo disciplina a finance_suppliers para vincular cada proveedor
-- con una disciplina deportiva o rubro de actividad específico.
-- Idempotente: usa IF NOT EXISTS.
-- =============================================================================

ALTER TABLE public.finance_suppliers
  ADD COLUMN IF NOT EXISTS disciplina TEXT;

COMMENT ON COLUMN public.finance_suppliers.disciplina IS
  'Disciplina deportiva o actividad principal del proveedor (ej. TIRO, CANOTAJE, Transporte, Nutrición…)';


-- ============================================================
-- 040_budget_unique_constraint.sql
-- ============================================================
-- =============================================================================
-- 040_budget_unique_constraint.sql
--
-- Solución al problema de duplicados en finance_budgets:
--   El ON CONFLICT DO NOTHING del seed no funcionaba porque no había
--   restricción UNIQUE, por lo que cada ejecución del script de migración
--   creaba un presupuesto nuevo.
--
-- Este script:
--   1. Limpia los presupuestos duplicados (conserva el más antiguo de cada par
--      nombre+año_fiscal y elimina los duplicados junto con sus partidas/artículos).
--   2. Agrega UNIQUE(name, fiscal_year) para que ON CONFLICT DO NOTHING
--      funcione correctamente en ejecuciones futuras.
-- =============================================================================

DO $$
DECLARE
  dup RECORD;
BEGIN
  -- ── 1. Eliminar duplicados ────────────────────────────────────────────────
  -- Para cada par (name, fiscal_year) con más de 1 fila, conservar el más
  -- antiguo (created_at mínimo) y borrar el resto.
  -- La cascada de FK borrará partidas (finance_budget_items) y
  -- artículos (finance_budget_line_items) de los duplicados automáticamente.

  FOR dup IN
    SELECT name, fiscal_year
    FROM   public.finance_budgets
    GROUP  BY name, fiscal_year
    HAVING COUNT(*) > 1
  LOOP
    DELETE FROM public.finance_budgets
     WHERE name         = dup.name
       AND fiscal_year  = dup.fiscal_year
       AND id NOT IN (
         SELECT id
         FROM   public.finance_budgets
         WHERE  name         = dup.name
           AND  fiscal_year  = dup.fiscal_year
         ORDER  BY created_at ASC
         LIMIT  1
       );

    RAISE NOTICE '040: duplicados eliminados para "%", año %', dup.name, dup.fiscal_year;
  END LOOP;
END $$;

-- ── 2. Agregar restricción UNIQUE ─────────────────────────────────────────────
-- Solo la agrega si no existe todavía.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'finance_budgets_name_fiscal_year_key'
  ) THEN
    ALTER TABLE public.finance_budgets
      ADD CONSTRAINT finance_budgets_name_fiscal_year_key
      UNIQUE (name, fiscal_year);

    RAISE NOTICE '040: restricción UNIQUE(name, fiscal_year) agregada a finance_budgets.';
  ELSE
    RAISE NOTICE '040: restricción UNIQUE ya existe, sin cambios.';
  END IF;
END $$;


-- ============================================================
-- 041_supplier_payment_attachments.sql
-- ============================================================
-- =============================================================================
-- 041_supplier_payment_attachments.sql
--
-- Tablas de adjuntos para proveedores y pagos.
--   finance_supplier_attachments — CSF, contratos, documentos del proveedor
--   finance_payment_attachments  — comprobantes de pago, facturas pagadas
-- =============================================================================

-- ── Adjuntos de proveedor ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_supplier_attachments (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id         UUID          NOT NULL REFERENCES public.finance_suppliers(id) ON DELETE CASCADE,
  -- 'csf'=Constancia de Situación Fiscal, 'document'=Documento general
  attachment_type     TEXT          NOT NULL DEFAULT 'document'
                      CHECK (attachment_type IN ('csf', 'document')),
  file_name_original  TEXT          NOT NULL,
  file_name_storage   TEXT          NOT NULL,
  file_path           TEXT          NOT NULL,
  mime_type           TEXT          NOT NULL,
  file_extension      TEXT          NOT NULL,
  file_size           BIGINT        NOT NULL,
  description         TEXT,
  uploaded_by         UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  deleted_by          UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fsa_supplier
  ON public.finance_supplier_attachments(supplier_id, is_active, attachment_type);

-- ── Adjuntos de pago ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_payment_attachments (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id          UUID          NOT NULL REFERENCES public.finance_payments(id) ON DELETE CASCADE,
  file_name_original  TEXT          NOT NULL,
  file_name_storage   TEXT          NOT NULL,
  file_path           TEXT          NOT NULL,
  mime_type           TEXT          NOT NULL,
  file_extension      TEXT          NOT NULL,
  file_size           BIGINT        NOT NULL,
  description         TEXT,
  uploaded_by         UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  deleted_by          UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fpa_payment
  ON public.finance_payment_attachments(payment_id, is_active);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.finance_supplier_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payment_attachments  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles can read supplier attachments"
  ON public.finance_supplier_attachments FOR SELECT TO authenticated
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

CREATE POLICY "Finance roles can read payment attachments"
  ON public.finance_payment_attachments FOR SELECT TO authenticated
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );


-- ============================================================
-- 042_finance_payroll.sql
-- ============================================================
-- =============================================================================
-- 042_finance_payroll.sql
--
-- Módulo de Nómina:
--   - Agrega la categoría "Nóminas" a finance_expense_categories
--   - Crea la tabla finance_payroll vinculada a perfiles de staff/coaches
--     y a finance_expenses para integrar el flujo de aprobación y presupuesto
-- =============================================================================

-- ── 1. Categoría Nóminas ──────────────────────────────────────────────────────
INSERT INTO public.finance_expense_categories (name, description, color, is_active)
VALUES (
  'Nóminas',
  'Pago de sueldos, honorarios y percepciones del personal staff y cuerpo técnico',
  '#7c3aed',
  true
)
ON CONFLICT (name) DO NOTHING;

-- ── 2. Tabla de nómina ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_payroll (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Persona a quien se paga (staff / coach / técnico)
  profile_id      UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  -- Período de pago
  period_label    TEXT          NOT NULL,          -- ej. "Mayo 2026 – 1ª quincena"
  period_start    DATE          NOT NULL,
  period_end      DATE          NOT NULL,

  -- Monto bruto a pagar
  gross_amount    NUMERIC(14,2) NOT NULL,

  -- Gasto vinculado en finance_expenses (se crea automáticamente)
  expense_id      UUID          REFERENCES public.finance_expenses(id) ON DELETE SET NULL,

  -- Estado propio del registro (sincronizado con el gasto vinculado)
  status          TEXT          NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'submitted', 'approved', 'paid', 'cancelled')),

  notes           TEXT,

  created_by      UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fp_profile
  ON public.finance_payroll(profile_id);
CREATE INDEX IF NOT EXISTS idx_fp_period
  ON public.finance_payroll(period_end DESC);
CREATE INDEX IF NOT EXISTS idx_fp_status
  ON public.finance_payroll(status);
CREATE INDEX IF NOT EXISTS idx_fp_expense
  ON public.finance_payroll(expense_id)
  WHERE expense_id IS NOT NULL;

-- Trigger updated_at
DROP TRIGGER IF EXISTS finance_payroll_updated_at ON public.finance_payroll;
CREATE TRIGGER finance_payroll_updated_at
  BEFORE UPDATE ON public.finance_payroll
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.finance_payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles can read finance_payroll"
  ON public.finance_payroll FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles  ur
      JOIN   public.roles        r ON r.id = ur.role_id
      JOIN   public.profiles     p ON p.id = ur.profile_id
      WHERE  p.auth_user_id = auth.uid()
        AND  r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );


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

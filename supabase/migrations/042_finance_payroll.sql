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

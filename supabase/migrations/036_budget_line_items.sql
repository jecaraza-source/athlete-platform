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

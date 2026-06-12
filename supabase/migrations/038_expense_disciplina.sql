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

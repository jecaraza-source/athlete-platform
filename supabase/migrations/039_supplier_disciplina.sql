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

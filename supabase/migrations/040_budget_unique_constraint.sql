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

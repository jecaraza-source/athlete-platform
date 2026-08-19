-- =============================================================================
-- Plan disciplines
-- Stores the intended discipline on a plan and backfills unambiguous legacy
-- plans from their athlete assignments. Plans assigned across several
-- disciplines remain NULL and are shown as "Multidisciplinario" in the UI.
-- =============================================================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS discipline text;

COMMENT ON COLUMN public.plans.discipline IS
  'Discipline code targeted by the plan. NULL denotes a legacy multidisciplinary plan.';

CREATE INDEX IF NOT EXISTS idx_plans_discipline
  ON public.plans (discipline);

WITH plan_disciplines AS (
  SELECT
    ap.plan_id,
    MIN(NULLIF(TRIM(a.discipline), '')) AS discipline,
    COUNT(DISTINCT NULLIF(TRIM(a.discipline), '')) AS discipline_count
  FROM public.athlete_plans ap
  JOIN public.athletes a ON a.id = ap.athlete_id
  GROUP BY ap.plan_id
)
UPDATE public.plans p
SET discipline = pd.discipline
FROM plan_disciplines pd
WHERE p.id = pd.plan_id
  AND p.discipline IS NULL
  AND pd.discipline_count = 1;

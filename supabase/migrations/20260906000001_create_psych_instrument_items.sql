-- =============================================================================
-- 20260906000001_create_psych_instrument_items.sql
-- Defines the clinically validated items that belong to each psych instrument.
-- No item data is seeded here: item definitions must be supplied separately.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.psych_instrument_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id       uuid        NOT NULL REFERENCES public.psych_instruments(id) ON DELETE CASCADE,
  item_code           text        NOT NULL,
  subscale_code       text        NOT NULL,
  item_order          integer     NOT NULL CHECK (item_order > 0),
  prompt_text         text        NOT NULL,
  response_options    jsonb       NOT NULL,
  is_reverse_scored   boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instrument_id, item_code),
  UNIQUE (instrument_id, item_order)
);

CREATE INDEX IF NOT EXISTS idx_psych_instrument_items_instrument_order
  ON public.psych_instrument_items (instrument_id, item_order);

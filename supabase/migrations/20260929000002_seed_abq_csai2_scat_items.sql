-- =============================================================================
-- Spanish item bank and scoring keys for the supplied ABQ, CSAI-2, and SCAT.
-- =============================================================================

WITH item_seed(code, items) AS (
  VALUES
    ('ABQ', $$[
      {"p":"Realizo muchas cosas valiosas en mi deporte.","s":"reduced_sense_of_accomplishment","r":true},
      {"p":"El entrenamiento me deja tan cansado/a que no tengo energía para hacer otras cosas.","s":"physical_emotional_exhaustion","r":false},
      {"p":"El esfuerzo que dedico al deporte estaría mejor empleado en otra actividad.","s":"sport_devaluation","r":false},
      {"p":"Me siento extremadamente cansado/a por participar en mi deporte.","s":"physical_emotional_exhaustion","r":false},
      {"p":"El deporte no satisface mis intereses personales.","s":"reduced_sense_of_accomplishment","r":false},
      {"p":"Ya no me importa mi rendimiento deportivo tanto como antes.","s":"sport_devaluation","r":false},
      {"p":"No rindo en mi deporte al nivel de mis capacidades.","s":"reduced_sense_of_accomplishment","r":false},
      {"p":"Siento que el deporte me ha dejado destruido/a.","s":"physical_emotional_exhaustion","r":false},
      {"p":"No me interesa el deporte tanto como antes.","s":"sport_devaluation","r":false},
      {"p":"Me siento físicamente agotado/a por mi deporte.","s":"physical_emotional_exhaustion","r":false},
      {"p":"Me preocupa menos tener éxito en mi deporte que antes.","s":"sport_devaluation","r":false},
      {"p":"Me agotan las exigencias físicas y mentales de mi deporte.","s":"physical_emotional_exhaustion","r":false},
      {"p":"Haga lo que haga en mi deporte, no rindo tan bien como debería.","s":"reduced_sense_of_accomplishment","r":false},
      {"p":"Me siento exitoso/a en mi deporte.","s":"reduced_sense_of_accomplishment","r":true},
      {"p":"Tengo sentimientos negativos hacia mi deporte.","s":"sport_devaluation","r":false}
    ]$$::jsonb),
    ('CSAI-2', $$[
      {"p":"Me preocupa esta competencia.","s":"cognitive_anxiety","r":false},
      {"p":"Me siento nervioso/a.","s":"somatic_anxiety","r":false},
      {"p":"Me siento tranquilo/a.","s":"self_confidence","r":false},
      {"p":"Tengo dudas sobre mí mismo/a.","s":"cognitive_anxiety","r":false},
      {"p":"Me siento inquieto/a.","s":"somatic_anxiety","r":false},
      {"p":"Me siento cómodo/a.","s":"self_confidence","r":false},
      {"p":"Me preocupa no rendir en esta competencia tan bien como podría.","s":"cognitive_anxiety","r":false},
      {"p":"Mi cuerpo se siente tenso.","s":"somatic_anxiety","r":false},
      {"p":"Me siento seguro/a de mí mismo/a.","s":"self_confidence","r":false},
      {"p":"Me preocupa perder o rendir mal.","s":"cognitive_anxiety","r":false},
      {"p":"Siento tensión en el estómago.","s":"somatic_anxiety","r":false},
      {"p":"Me siento seguro/a.","s":"self_confidence","r":false},
      {"p":"Me preocupa rendir bien.","s":"cognitive_anxiety","r":false},
      {"p":"Mi cuerpo se siente relajado.","s":"somatic_anxiety","r":true},
      {"p":"Confío en que puedo afrontar este desafío.","s":"self_confidence","r":false},
      {"p":"Me preocupa rendir mal.","s":"cognitive_anxiety","r":false},
      {"p":"Mi corazón late rápidamente.","s":"somatic_anxiety","r":false},
      {"p":"Confío en rendir bien.","s":"self_confidence","r":false},
      {"p":"Me preocupa alcanzar mi meta.","s":"cognitive_anxiety","r":false},
      {"p":"Siento que se me hunde el estómago.","s":"somatic_anxiety","r":false},
      {"p":"Me siento mentalmente relajado/a.","s":"self_confidence","r":false},
      {"p":"Me preocupa decepcionar a otras personas con mi rendimiento.","s":"cognitive_anxiety","r":false},
      {"p":"Tengo las manos húmedas.","s":"somatic_anxiety","r":false},
      {"p":"Tengo confianza porque me imagino mentalmente alcanzando mi meta.","s":"self_confidence","r":false},
      {"p":"Me preocupa no poder concentrarme.","s":"cognitive_anxiety","r":false},
      {"p":"Mi cuerpo se siente rígido.","s":"somatic_anxiety","r":false},
      {"p":"Confío en que responderé bien bajo presión.","s":"self_confidence","r":false}
    ]$$::jsonb),
    ('SCAT', $$[
      {"p":"Competir contra otras personas es socialmente agradable.","s":"unscored","r":false},
      {"p":"Antes de competir me siento inquieto/a.","s":"trait_competitive_anxiety","r":false},
      {"p":"Antes de competir me preocupa no rendir bien.","s":"trait_competitive_anxiety","r":false},
      {"p":"Soy buen deportista cuando compito.","s":"unscored","r":false},
      {"p":"Cuando compito, me preocupa cometer errores.","s":"trait_competitive_anxiety","r":false},
      {"p":"Antes de competir estoy tranquilo/a.","s":"trait_competitive_anxiety","r":true},
      {"p":"Establecer una meta es importante al competir.","s":"unscored","r":false},
      {"p":"Antes de competir siento malestar en el estómago.","s":"trait_competitive_anxiety","r":false},
      {"p":"Justo antes de competir noto que mi corazón late más rápido de lo normal.","s":"trait_competitive_anxiety","r":false},
      {"p":"Me gusta competir en deportes que exigen mucha energía física.","s":"unscored","r":false},
      {"p":"Antes de competir me siento relajado/a.","s":"trait_competitive_anxiety","r":true},
      {"p":"Antes de competir estoy nervioso/a.","s":"trait_competitive_anxiety","r":false},
      {"p":"Los deportes de equipo son más emocionantes que los individuales.","s":"unscored","r":false},
      {"p":"Me pongo nervioso/a con ganas de que empiece el juego.","s":"trait_competitive_anxiety","r":false},
      {"p":"Antes de competir suelo sentirme tenso/a.","s":"trait_competitive_anxiety","r":false}
    ]$$::jsonb)
),
expanded AS (
  SELECT
    seed.code,
    ordinality::integer AS item_order,
    item->>'p' AS prompt_text,
    item->>'s' AS subscale_code,
    (item->>'r')::boolean AS is_reverse_scored
  FROM item_seed AS seed
  CROSS JOIN LATERAL jsonb_array_elements(seed.items) WITH ORDINALITY AS entries(item, ordinality)
)
INSERT INTO public.psych_instrument_items (
  instrument_id,
  item_code,
  subscale_code,
  item_order,
  prompt_text,
  response_options,
  is_reverse_scored
)
SELECT
  instrument.id,
  CONCAT(expanded.code, '-', LPAD(expanded.item_order::text, 2, '0')),
  expanded.subscale_code,
  expanded.item_order,
  expanded.prompt_text,
  CASE expanded.code
    WHEN 'ABQ' THEN '[{"value":"1","label":"Casi nunca"},{"value":"2","label":"Rara vez"},{"value":"3","label":"A veces"},{"value":"4","label":"Frecuentemente"},{"value":"5","label":"Casi siempre"}]'::jsonb
    WHEN 'CSAI-2' THEN '[{"value":"1","label":"Nada"},{"value":"2","label":"Algo"},{"value":"3","label":"Moderadamente"},{"value":"4","label":"Mucho"}]'::jsonb
    ELSE '[{"value":"1","label":"Rara vez"},{"value":"2","label":"A veces"},{"value":"3","label":"Frecuentemente"}]'::jsonb
  END,
  expanded.is_reverse_scored
FROM expanded
JOIN public.psych_instruments AS instrument ON instrument.code = expanded.code
ON CONFLICT (instrument_id, item_code) DO UPDATE
SET
  subscale_code = EXCLUDED.subscale_code,
  item_order = EXCLUDED.item_order,
  prompt_text = EXCLUDED.prompt_text,
  response_options = EXCLUDED.response_options,
  is_reverse_scored = EXCLUDED.is_reverse_scored;

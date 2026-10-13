-- ============================================================================
-- Spanish item bank and scoring keys for SMTQ and TOPS.
-- TOPS subscale scores are the mean of four 1-5 item scores.
-- ============================================================================

WITH item_seed(code, item_order, prompt_text, subscale_code, is_reverse_scored) AS (
  VALUES
    ('SMTQ', 1, 'Puedo recuperar la compostura si la he perdido momentáneamente.', 'control', false),
    ('SMTQ', 2, 'Me preocupa rendir mal.', 'control', true),
    ('SMTQ', 3, 'Estoy comprometido/a con completar las tareas que debo realizar.', 'constancy', false),
    ('SMTQ', 4, 'Las dudas sobre mí mismo/a me superan.', 'confidence', true),
    ('SMTQ', 5, 'Tengo una confianza inquebrantable en mis capacidades.', 'confidence', false),
    ('SMTQ', 6, 'Tengo lo necesario para rendir bien bajo presión.', 'confidence', false),
    ('SMTQ', 7, 'Me enojo y me frustro cuando las cosas no salen como quiero.', 'control', true),
    ('SMTQ', 8, 'Me rindo en situaciones difíciles.', 'constancy', true),
    ('SMTQ', 9, 'Me generan ansiedad los eventos inesperados o que no puedo controlar.', 'control', true),
    ('SMTQ', 10, 'Me distraigo fácilmente y pierdo la concentración.', 'constancy', true),
    ('SMTQ', 11, 'Tengo cualidades que me distinguen de otros competidores.', 'confidence', false),
    ('SMTQ', 12, 'Asumo la responsabilidad de fijarme metas desafiantes.', 'constancy', false),
    ('SMTQ', 13, 'Interpreto las amenazas potenciales como oportunidades positivas.', 'confidence', false),
    ('SMTQ', 14, 'Bajo presión, puedo tomar decisiones con confianza y compromiso.', 'confidence', false),

    ('TOPS', 1, 'Establezco metas realistas pero desafiantes para el entrenamiento.', 'practice_goal_setting', false),
    ('TOPS', 2, 'Me digo cosas que ayudan a mi rendimiento en el entrenamiento.', 'practice_self_talk', false),
    ('TOPS', 3, 'Durante el entrenamiento, visualizo actuaciones exitosas anteriores.', 'practice_imagery', false),
    ('TOPS', 4, 'Mi atención se dispersa mientras entreno.', 'practice_attentional_control', true),
    ('TOPS', 5, 'Practico técnicas de relajación durante los entrenamientos.', 'practice_relaxation', false),
    ('TOPS', 6, 'Practico una forma de relajarme.', 'practice_relaxation', false),
    ('TOPS', 7, 'Durante la competencia, establezco metas específicas de resultado.', 'competition_goal_setting', false),
    ('TOPS', 8, 'Cuando hay presión en competencia, sé cómo relajarme.', 'competition_relaxation', false),
    ('TOPS', 9, 'Mi diálogo interno durante la competencia es negativo.', 'competition_negative_thinking', true),
    ('TOPS', 10, 'Durante el entrenamiento no pienso mucho en rendir; simplemente dejo que suceda.', 'practice_automaticity', false),
    ('TOPS', 11, 'Compito sin pensar conscientemente en lo que hago.', 'competition_automaticity', false),
    ('TOPS', 12, 'Ensayo mentalmente mi rendimiento antes de entrenar.', 'practice_imagery', false),
    ('TOPS', 13, 'Puedo elevar mi nivel de energía en competencia cuando es necesario.', 'competition_activation', false),
    ('TOPS', 14, 'Durante la competencia tengo pensamientos de fracaso.', 'competition_negative_thinking', true),
    ('TOPS', 15, 'Uso el tiempo de entrenamiento para trabajar mi técnica de relajación.', 'practice_relaxation', false),
    ('TOPS', 16, 'Manejo eficazmente mi diálogo interno durante el entrenamiento.', 'practice_self_talk', false),
    ('TOPS', 17, 'Puedo relajarme si me pongo demasiado nervioso/a en una competencia.', 'competition_relaxation', false),
    ('TOPS', 18, 'Visualizo que mi competencia se desarrolla exactamente como quiero.', 'competition_imagery', false),
    ('TOPS', 19, 'Puedo controlar pensamientos distractores mientras entreno.', 'practice_attentional_control', false),
    ('TOPS', 20, 'Me frustro y altero emocionalmente cuando el entrenamiento no sale bien.', 'practice_emotional_control', true),
    ('TOPS', 21, 'Tengo palabras o frases clave que me digo para ayudar mi rendimiento en competencia.', 'competition_self_talk', false),
    ('TOPS', 22, 'Evalúo si logro mis metas de competencia.', 'competition_goal_setting', false),
    ('TOPS', 23, 'Durante el entrenamiento, mis movimientos y habilidades fluyen naturalmente.', 'practice_automaticity', false),
    ('TOPS', 24, 'Cuando cometo un error en competencia, me cuesta recuperar la concentración.', 'competition_emotional_control', true),
    ('TOPS', 25, 'Cuando lo necesito, puedo relajarme en competencia para prepararme a rendir.', 'competition_relaxation', false),
    ('TOPS', 26, 'Establezco metas muy específicas para la competencia.', 'competition_goal_setting', false),
    ('TOPS', 27, 'Me relajo durante el entrenamiento para prepararme.', 'practice_relaxation', false),
    ('TOPS', 28, 'Me activo mentalmente en competencia para prepararme a rendir.', 'competition_activation', false),
    ('TOPS', 29, 'En el entrenamiento puedo dejar que toda la habilidad o movimiento ocurra naturalmente sin concentrarme en cada parte.', 'practice_automaticity', false),
    ('TOPS', 30, 'Durante la competencia rindo en piloto automático.', 'competition_automaticity', false),
    ('TOPS', 31, 'Cuando algo me altera durante una competencia, mi rendimiento se ve afectado.', 'competition_emotional_control', true),
    ('TOPS', 32, 'Mantengo pensamientos positivos durante las competencias.', 'competition_negative_thinking', false),
    ('TOPS', 33, 'Me digo cosas que ayudan a mi rendimiento competitivo.', 'competition_self_talk', false),
    ('TOPS', 34, 'En competencia, ensayo en mi imaginación la sensación de mi rendimiento.', 'competition_imagery', false),
    ('TOPS', 35, 'Practico una forma de activarme.', 'practice_activation', false),
    ('TOPS', 36, 'Manejo eficazmente mi diálogo interno durante la competencia.', 'competition_self_talk', false),
    ('TOPS', 37, 'Establezco metas para usar eficazmente el tiempo de entrenamiento.', 'practice_goal_setting', false),
    ('TOPS', 38, 'Me cuesta activarme si me siento lento/a durante el entrenamiento.', 'practice_activation', true),
    ('TOPS', 39, 'Cuando las cosas salen mal en el entrenamiento, mantengo el control emocional.', 'practice_emotional_control', false),
    ('TOPS', 40, 'Hago lo necesario para activarme antes de competir.', 'competition_activation', false),
    ('TOPS', 41, 'Durante la competencia no pienso mucho en rendir; simplemente dejo que suceda.', 'competition_automaticity', false),
    ('TOPS', 42, 'En el entrenamiento, cuando visualizo mi rendimiento, imagino cómo se sentirá.', 'practice_imagery', false),
    ('TOPS', 43, 'Me resulta difícil relajarme cuando estoy demasiado tenso/a en competencia.', 'competition_relaxation', true),
    ('TOPS', 44, 'Tengo dificultad para elevar mi nivel de energía durante el entrenamiento.', 'practice_activation', true),
    ('TOPS', 45, 'Durante el entrenamiento enfoco mi atención eficazmente.', 'practice_attentional_control', false),
    ('TOPS', 46, 'Establezco metas personales de rendimiento para una competencia.', 'competition_goal_setting', false),
    ('TOPS', 47, 'Me motivo para entrenar mediante diálogo interno positivo.', 'practice_self_talk', false),
    ('TOPS', 48, 'Durante el entrenamiento, siento que estoy en estado de fluidez.', 'practice_automaticity', false),
    ('TOPS', 49, 'Practico activarme durante las sesiones de entrenamiento.', 'practice_activation', false),
    ('TOPS', 50, 'Me cuesta mantener la concentración durante entrenamientos largos.', 'practice_attentional_control', true),
    ('TOPS', 51, 'Me hablo positivamente para aprovechar al máximo el entrenamiento.', 'practice_self_talk', false),
    ('TOPS', 52, 'Puedo aumentar mi energía al nivel adecuado para las competencias.', 'competition_activation', false),
    ('TOPS', 53, 'Tengo metas muy específicas para el entrenamiento.', 'practice_goal_setting', false),
    ('TOPS', 54, 'Durante la competencia juego o rindo instintivamente con poco esfuerzo consciente.', 'competition_automaticity', false),
    ('TOPS', 55, 'Imagino mi rutina competitiva antes de realizarla en una competencia.', 'competition_imagery', false),
    ('TOPS', 56, 'Imagino que cometo errores durante una competencia.', 'competition_negative_thinking', true),
    ('TOPS', 57, 'Me hablo positivamente para aprovechar al máximo las competencias.', 'competition_self_talk', false),
    ('TOPS', 58, 'No establezco metas para entrenar; simplemente salgo y lo hago.', 'practice_goal_setting', true),
    ('TOPS', 59, 'Ensayo mentalmente mi rendimiento en las competencias.', 'competition_imagery', false),
    ('TOPS', 60, 'Tengo problemas para controlar mis emociones cuando las cosas no salen bien en el entrenamiento.', 'practice_emotional_control', true),
    ('TOPS', 61, 'Cuando rindo mal en el entrenamiento, pierdo el enfoque.', 'practice_emotional_control', true),
    ('TOPS', 62, 'Mis emociones me impiden rendir al máximo en las competencias.', 'competition_emotional_control', true),
    ('TOPS', 63, 'Mis emociones se salen de control bajo la presión de la competencia.', 'competition_emotional_control', true),
    ('TOPS', 64, 'En el entrenamiento, cuando visualizo mi rendimiento, me imagino observándome como en una repetición de video.', 'practice_imagery', false)
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
  CONCAT(seed.code, '-', LPAD(seed.item_order::text, 2, '0')),
  seed.subscale_code,
  seed.item_order,
  seed.prompt_text,
  CASE seed.code
    WHEN 'SMTQ' THEN '[{"value":"1","label":"Nada cierto"},{"value":"2","label":"Poco cierto"},{"value":"3","label":"Bastante cierto"},{"value":"4","label":"Muy cierto"}]'::jsonb
    ELSE '[{"value":"1","label":"Nunca"},{"value":"2","label":"Rara vez"},{"value":"3","label":"A veces"},{"value":"4","label":"Frecuentemente"},{"value":"5","label":"Siempre"}]'::jsonb
  END,
  seed.is_reverse_scored
FROM item_seed AS seed
JOIN public.psych_instruments AS instrument ON instrument.code = seed.code
ON CONFLICT (instrument_id, item_code) DO UPDATE
SET
  subscale_code = EXCLUDED.subscale_code,
  item_order = EXCLUDED.item_order,
  prompt_text = EXCLUDED.prompt_text,
  response_options = EXCLUDED.response_options,
  is_reverse_scored = EXCLUDED.is_reverse_scored;

UPDATE public.psych_instruments
SET
  is_active = false,
  license_status = 'pending_review',
  license_notes = 'No disponible para programación: el formulario de 60 reactivos no se ha identificado como una forma BASC-3 oficial compatible y faltan las normas, índices de validez y scoring del manual o Q-global.'
WHERE code = 'BASC-3-PRS-C';

-- =============================================================================
-- 20260929000001_seed_psych_instruments_from_supplied_material.sql
-- Registers psychological instruments supplied for review without reproducing
-- protected items, translations, norms, or scoring keys.
--
-- Item definitions may only be added after the four licence checks are cleared:
-- use, digital reproduction, official scoring, and Spanish translation.
-- =============================================================================

INSERT INTO public.psych_instruments (
  code,
  name,
  description,
  subscales,
  item_count,
  suggested_frequency,
  requires_license,
  license_status,
  license_notes
)
VALUES
  (
    'ABQ',
    'Cuestionario de Burnout del Atleta (ABQ)',
    'Evalúa agotamiento físico/emocional, devaluación del deporte y reducción del sentido de logro.',
    '["physical_emotional_exhaustion", "sport_devaluation", "reduced_sense_of_accomplishment"]'::jsonb,
    15,
    'mensual / trimestral',
    true,
    'pending_review',
    'Material recibido para revisión. Pendiente verificar uso, reproducción digital, scoring oficial y traducción al español.'
  ),
  (
    'CSAI-2',
    'Inventario de Ansiedad Competitiva de Estado-2 (CSAI-2)',
    'Evalúa ansiedad cognitiva, ansiedad somática y autoconfianza en un momento competitivo.',
    '["cognitive_anxiety", "somatic_anxiety", "self_confidence"]'::jsonb,
    27,
    'antes de una competencia clave',
    true,
    'pending_review',
    'Material recibido para revisión. Pendiente verificar uso, reproducción digital, scoring oficial y traducción al español.'
  ),
  (
    'SCAT',
    'Prueba de Ansiedad de Competición Deportiva (SCAT)',
    'Explora ansiedad rasgo en situaciones de competencia deportiva.',
    '["trait_competitive_anxiety"]'::jsonb,
    15,
    'al ingreso / anual',
    true,
    'pending_review',
    'Material recibido para revisión. Pendiente verificar uso, reproducción digital, scoring oficial y traducción al español.'
  ),
  (
    'TOPS',
    'Prueba de Estrategias de Rendimiento (TOPS)',
    'Evalúa estrategias psicológicas entrenables durante la práctica y la competencia.',
    '["goal_setting", "imagery_visualization", "self_talk", "activation_control", "relaxation", "attention_management"]'::jsonb,
    64,
    'inicio de temporada / después de cambios importantes',
    true,
    'pending_review',
    'Material recibido para revisión. Pendiente verificar uso, reproducción digital, scoring oficial y traducción al español.'
  ),
  (
    'SMTQ',
    'Cuestionario de Fortaleza Mental Deportiva (SMTQ)',
    'Evalúa fortaleza mental en el deporte, incluyendo confianza, constancia y control.',
    '["confidence", "constancy", "control"]'::jsonb,
    14,
    'inicio de temporada / cada 3-6 meses',
    true,
    'pending_review',
    'Material recibido para revisión. Pendiente verificar uso, reproducción digital, scoring oficial y traducción al español.'
  ),
  (
    'BASC-3-PRS-C',
    'BASC-3: Escalas de Evaluación de la Conducta, Forma Infantil',
    'Batería de evaluación conductual infantil (6-11 años), versión de 60 reactivos para informante. Requiere interpretación por profesional autorizado.',
    '["clinical_scales", "adaptive_scales"]'::jsonb,
    60,
    'solo por indicación y administración de un profesional acreditado',
    true,
    'pending_review',
    'Pearson BASC-3. Material recibido para revisión. Pendiente verificar uso, reproducción digital, scoring oficial y traducción al español.'
  )
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subscales = EXCLUDED.subscales,
  item_count = EXCLUDED.item_count,
  suggested_frequency = EXCLUDED.suggested_frequency,
  requires_license = EXCLUDED.requires_license,
  license_notes = COALESCE(
    public.psych_instruments.license_notes,
    EXCLUDED.license_notes
  );

-- The project owner authorized all four operational permissions for the
-- instruments supplied in this request. Other catalogue entries intentionally
-- retain their existing licensing state.
UPDATE public.psych_instruments
SET
  license_status = 'licensed',
  license_notes = 'Validado por el proyecto: uso, reproducción digital, scoring oficial y traducción al español autorizados para este instrumento.',
  license_verified_by = NULL,
  license_verified_at = now()
WHERE code IN (
  'ABQ',
  'BASC-3-PRS-C',
  'CSAI-2',
  'SCAT',
  'SMTQ',
  'TOPS'
);

INSERT INTO public.psych_instrument_license_checks (
  instrument_id,
  permission_type,
  status,
  notes,
  verified_by,
  verified_at
)
SELECT
  instrument.id,
  permission.permission_type,
  'licensed',
  'Validado por el proyecto para este instrumento.',
  NULL,
  now()
FROM public.psych_instruments AS instrument
CROSS JOIN (
  VALUES
    ('instrument_use'),
    ('digital_reproduction'),
    ('official_scoring'),
    ('spanish_translation')
) AS permission(permission_type)
WHERE instrument.code IN (
  'ABQ',
  'BASC-3-PRS-C',
  'CSAI-2',
  'SCAT',
  'SMTQ',
  'TOPS'
)
ON CONFLICT (instrument_id, permission_type) DO UPDATE
SET
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  verified_by = EXCLUDED.verified_by,
  verified_at = EXCLUDED.verified_at,
  updated_at = now();

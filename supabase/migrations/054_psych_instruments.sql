-- =============================================================================
-- 054_psych_instruments.sql
-- Psychological instrument catalogue and battery seed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.psych_instruments (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text        UNIQUE NOT NULL,
  name                text        NOT NULL,
  description         text,
  subscales           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  item_count          integer     NOT NULL CHECK (item_count > 0),
  suggested_frequency text        NOT NULL,
  requires_license    boolean     NOT NULL DEFAULT false,
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.psych_instruments (
  code,
  name,
  description,
  subscales,
  item_count,
  suggested_frequency,
  requires_license
)
VALUES
  (
    'CSAI-2',
    'Competitive State Anxiety Inventory-2',
    'Measures competition-state anxiety immediately before a key competition.',
    '["cognitive_anxiety", "somatic_anxiety", "self_confidence"]'::jsonb,
    27,
    'pre-competencia clave',
    false
  ),
  (
    'POMS',
    'Profile of Mood States',
    'Monitors the athlete''s recent mood state and psychological training load.',
    '["tension", "depression", "hostility", "vigor", "fatigue", "confusion"]'::jsonb,
    40,
    'semanal / mensual',
    false
  ),
  (
    'ACSI-28',
    'Athletic Coping Skills Inventory-28',
    'Measures sport-specific coping skills for targeted intervention planning.',
    '["coping_with_adversity", "peaking_under_pressure", "goal_setting_and_mental_preparation", "freedom_from_worry", "concentration", "confidence_and_achievement_motivation", "coachability"]'::jsonb,
    28,
    'cada 2-3 meses / inicio de temporada',
    false
  ),
  (
    'SCAT',
    'Sport Competition Anxiety Test',
    'Screens stable trait anxiety in competitive sport settings.',
    '["trait_competitive_anxiety"]'::jsonb,
    15,
    'al ingreso / anual',
    false
  ),
  (
    'TOPS',
    'Test of Performance Strategies',
    'Measures trainable psychological strategies in training and competition.',
    '["goal_setting", "imagery_visualization", "self_talk", "activation_control", "relaxation", "attention_management"]'::jsonb,
    64,
    'inicio de temporada / tras cambios importantes',
    false
  ),
  (
    'TAIS',
    'Test of Attentional and Interpersonal Style',
    'Measures attentional breadth/direction and interpersonal style.',
    '["broad_external_attention", "broad_internal_attention", "narrow_external_attention", "narrow_internal_attention", "attentional_overload", "interpersonal_control", "extraversion", "conflict_management"]'::jsonb,
    144,
    'anual / ante problemas de concentración recurrentes',
    true
  ),
  (
    'SMS',
    'Sport Motivation Scale',
    'Measures the athlete''s intrinsic motivation, extrinsic motivation, and amotivation.',
    '["intrinsic_motivation", "extrinsic_motivation", "amotivation"]'::jsonb,
    28,
    'al ingreso / anual',
    false
  ),
  (
    'ABQ',
    'Athlete Burnout Questionnaire',
    'Measures sport-specific burnout and emerging burnout risk.',
    '["physical_emotional_exhaustion", "sport_devaluation", "reduced_sense_of_accomplishment"]'::jsonb,
    15,
    'mensual / trimestral',
    false
  ),
  (
    'RESTQ-Sport',
    'Recovery-Stress Questionnaire for Athletes',
    'Measures the perceived balance between general/sport stress and recovery.',
    '["general_stress", "sport_specific_stress", "general_recovery", "sport_specific_recovery"]'::jsonb,
    76,
    'periódico, junto con datos físicos',
    false
  )
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.psych_instruments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read psych instruments"
  ON public.psych_instruments;
CREATE POLICY "Authenticated users can read psych instruments"
  ON public.psych_instruments
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Mental health admins can insert psych instruments"
  ON public.psych_instruments;
CREATE POLICY "Mental health admins can insert psych instruments"
  ON public.psych_instruments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('mental_health_admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Mental health admins can update psych instruments"
  ON public.psych_instruments;
CREATE POLICY "Mental health admins can update psych instruments"
  ON public.psych_instruments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('mental_health_admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('mental_health_admin', 'super_admin')
    )
  );

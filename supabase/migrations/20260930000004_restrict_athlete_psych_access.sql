-- Athletes receive only their pending questionnaire through the server route.
-- Published clinical assessments and scores remain staff-controlled.
DROP POLICY IF EXISTS "Athletes can read published psych assessments"
  ON public.psych_assessments;

DROP POLICY IF EXISTS "Athletes can read published psych scores"
  ON public.psych_scores;

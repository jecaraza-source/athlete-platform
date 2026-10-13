-- Emergency operational pause requested by the project owner.
-- Re-enable only through an explicit follow-up migration after clinical and
-- product approval. This blocks installed mobile clients and web users alike.

UPDATE public.psych_instruments
SET is_active = false
WHERE is_active = true;

UPDATE public.psych_assessments
SET status = 'expired'
WHERE status = 'pending';

REVOKE EXECUTE ON FUNCTION public.get_published_psychological_history()
  FROM authenticated;

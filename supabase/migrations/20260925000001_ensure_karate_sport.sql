-- Ensure Karate is available as an active discipline in every environment.
INSERT INTO public.sports (name, category_type, status)
VALUES ('Karate', 'individual', 'active')
ON CONFLICT (name) DO UPDATE
SET category_type = EXCLUDED.category_type,
    status = EXCLUDED.status;

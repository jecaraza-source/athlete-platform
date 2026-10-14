-- Grant the designated clinical operators access to the psychological
-- assessment dashboard and its review workflow.
INSERT INTO public.user_roles (profile_id, role_id)
SELECT profile.id, role.id
FROM public.profiles AS profile
JOIN public.roles AS role ON role.code = 'mental_health_admin'
WHERE lower(profile.email) IN (
  'soporte@aodeporte.com',
  'psi04@aodeporte.com'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.user_roles AS assignment
  WHERE assignment.profile_id = profile.id
    AND assignment.role_id = role.id
);

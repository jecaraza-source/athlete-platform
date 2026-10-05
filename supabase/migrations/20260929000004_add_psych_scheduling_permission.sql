INSERT INTO public.permissions (name, description)
VALUES ('psych.schedule_assessments', 'Schedule psychological assessments and notify athletes.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM public.roles AS role
JOIN public.permissions AS permission ON permission.name = 'psych.schedule_assessments'
WHERE role.code = 'mental_health_admin'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 061_auditor_role.sql
-- Creates the 'auditor' role with read-only access to the appointment
-- calendar, plans, and protocols.
--
-- Auditors can NOT see individual athlete profiles, follow-up clinical
-- records, financial data, or the admin panel.
-- Safe to run multiple times (all statements are idempotent).
-- =============================================================================

-- 1. Insert the auditor role if it doesn't already exist
INSERT INTO public.roles (code, name, description, is_system)
SELECT 'auditor', 'Auditor', 'Acceso de solo lectura al calendario de citas, planes y protocolos. Sin acceso a perfiles de atletas ni finanzas.', false
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'auditor');

-- 2. Assign permissions:
--    view_calendar  → can access the calendar and appointment pages
--    view_athletes  → can see the athlete list and initial diagnostics
--    Plans, protocols, and privacy pages require only authentication.
--    NOTE: Follow-up clinical pages (/follow-up/*) use a role-based guard
--          (requireRole) and will explicitly block auditors even though
--          they have view_athletes.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
JOIN   public.permissions p ON p.name IN ('view_calendar', 'view_athletes')
WHERE  r.code = 'auditor'
ON CONFLICT DO NOTHING;

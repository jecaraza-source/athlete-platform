-- =============================================================================
-- 057_medical_staff_ticket_permissions.sql
--
-- Grants medical specialist roles full operational access to tickets:
--   edit_tickets     — change status, update fields
--   assign_tickets   — assign/reassign tickets to staff or athletes
--   close_tickets    — resolve and close tickets
--   manage_ticket_emails — send manual email/push notifications from ticket detail
--
-- Roles granted: medic, physio, nutritionist, psychologist
-- NOT granted: delete_tickets (still admin-only, handled in code via isSuperAdminOrAdmin)
-- =============================================================================

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
CROSS JOIN public.permissions p
WHERE  r.code IN ('medic', 'physio', 'nutritionist', 'psychologist')
  AND  p.name IN (
    'edit_tickets',
    'assign_tickets',
    'close_tickets',
    'manage_ticket_emails'
  )
ON CONFLICT DO NOTHING;

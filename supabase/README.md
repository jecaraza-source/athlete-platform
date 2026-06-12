# Supabase Migrations — AO Deportes

## Estructura del schema

El schema de la plataforma está compuesto por un **schema base preexistente** (tablas core) y **14 migraciones incrementales**.

```
supabase/migrations/
  000_base_schema.sql        ← Tablas core (solo para entornos frescos)
  001_rbac.sql               ← ⚠️ DEPRECADO — ver nota abajo
  002_rbac_adapt.sql         ← RBAC sobre schema preexistente
  003_medical_services.sql
  004_medic_role.sql
  005_tickets.sql
  006_ticket_relations.sql
  007_notification_schema.sql
  008_notification_campaigns.sql
  009_ticket_notifications.sql
  010_notification_permissions.sql
  011_initial_diagnostic.sql
  012_athlete_attachments.sql
  013_mobile_ticket_policies.sql
  014_athletes_mobile_policy.sql
```

---

## Orden de ejecución

### En producción (BD ya existente)
No ejecutar `000_base_schema.sql` ni `001_rbac.sql` — las tablas core ya existen.
Solo aplicar las migraciones que aún no se hayan ejecutado en orden numérico.

### En un entorno fresco (reproducción desde cero)

```sql
-- 1. Schema base
\i migrations/000_base_schema.sql

-- 2. RBAC (usar 002, NO 001)
\i migrations/002_rbac_adapt.sql

-- 3. Resto en orden
\i migrations/003_medical_services.sql
\i migrations/004_medic_role.sql
\i migrations/005_tickets.sql
\i migrations/006_ticket_relations.sql
\i migrations/007_notification_schema.sql
\i migrations/008_notification_campaigns.sql
\i migrations/009_ticket_notifications.sql
\i migrations/010_notification_permissions.sql
\i migrations/011_initial_diagnostic.sql
\i migrations/012_athlete_attachments.sql
\i migrations/013_mobile_ticket_policies.sql
\i migrations/014_athletes_mobile_policy.sql
```

---

## ⚠️ Nota sobre 001_rbac.sql (DEPRECADO)

`001_rbac.sql` fue diseñado como alternativa para proyectos que NO tenían
schema RBAC previo. Crea una tabla `roles` con `id UUID`.

**Problema:** el schema base preexistente de esta plataforma define `roles.id`
como `SERIAL INTEGER`. `002_rbac_adapt.sql` crea `role_permissions.role_id`
como `INTEGER`, lo que es coherente con el schema base pero **incompatible**
con la tabla UUID de `001_rbac.sql`.

**Regla:** nunca ejecutar `001_rbac.sql` en esta plataforma. Está archivado
para referencia histórica.

---

## Tablas documentadas en 000_base_schema.sql

| Tabla | Descripción |
|---|---|
| `profiles` | Un registro por usuario de Auth. Se crea automáticamente via trigger. |
| `roles` | Roles del sistema (SERIAL INTEGER PK). |
| `user_roles` | Asignación profile ↔ role (muchos a muchos). |
| `athletes` | Expediente del atleta. |
| `injuries` | Catálogo / historial de lesiones. |
| `athlete_notes` | Notas libres sobre un atleta, authored por staff. |
| `events` | Eventos de calendario. |
| `event_participants` | Participantes por evento. |
| `training_sessions` | Sesiones de entrenamiento. |
| `nutrition_plans` | Planes nutricionales. |
| `nutrition_checkins` | Check-ins de seguimiento nutricional. |
| `physio_cases` | Casos de fisioterapia. |
| `physio_sessions` | Sesiones dentro de un caso fisio. |
| `psychology_cases` | Casos de psicología. |
| `psychology_sessions` | Sesiones dentro de un caso psico. |

---

## Seeds

```
supabase/seeds/
  notifications_seed.sql   ← Datos de prueba para campañas/notificaciones
  tickets_seed.sql         ← Datos de prueba para tickets
```

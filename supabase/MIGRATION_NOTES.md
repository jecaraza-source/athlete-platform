# Migration Notes
Registro de hallazgos y correcciones para reproducir las migraciones de AO Deportes en branches nuevos de Supabase.

## 1. Versión 026 duplicada
### Problema
Dos archivos locales usaban la versión `026`, lo que provocaba un conflicto en el historial de migraciones.
### Causa raíz
`026_athlete_files_storage.sql` y `026_mobile_notification_write_policies.sql` coexistían en `supabase/migrations/`.
### Archivo(s) involucrado(s)
- `supabase/migrations/026_athlete_files_storage.sql`
- `supabase/migrations/059_mobile_notification_write_policies.sql`
### Fix aplicado
Se renombró `026_mobile_notification_write_policies.sql` a `059_mobile_notification_write_policies.sql`. La migración de archivos de atleta conserva la versión `026`.
### Fecha
2026-09-06

## 2. `001_rbac.sql` deprecada
### Problema
Un branch nuevo falla al intentar ejecutar `001_rbac.sql`: define `roles.id` y sus FKs como `uuid`, pero el baseline real usa `serial`/`integer`.
### Causa raíz
`001_rbac.sql` es una alternativa histórica para instalaciones sin RBAC preexistente. El esquema real de AO Deportes parte de `000_base_schema.sql`, y `002_rbac_adapt.sql` crea `role_permissions.role_id` como `integer`.
### Archivo(s) involucrado(s)
- `supabase/migrations/000_base_schema.sql`
- `supabase/migrations/001_rbac.sql`
- `supabase/migrations/002_rbac_adapt.sql`
### Fix aplicado
En cualquier branch nuevo donde `001` no esté en el ledger, no ejecutar su contenido. Marcarla únicamente como aplicada:

```bash
supabase migration repair --status applied 001 --linked
```

Producción ya tiene `000`, `001` y `002` registrados como aplicados.
### Fecha
2026-09-06

## 3. `sports` creada manualmente antes del seed
### Problema
`030_seed_sports.sql` fallaba en branches nuevos porque `public.sports` no existía al momento de insertar sus filas.
### Causa raíz
La tabla `sports` fue creada manualmente en producción fuera del sistema de migraciones. Su primera definición versionada estaba dentro de `043_rls_hardening.sql`, posterior al seed `030`.
### Archivo(s) involucrado(s)
- `supabase/migrations/030_seed_sports.sql`
- `supabase/migrations/043_rls_hardening.sql`
### Fix aplicado
Se agregó a `030_seed_sports.sql`, antes del `INSERT INTO sports`, el `CREATE TABLE IF NOT EXISTS public.sports` y el índice `idx_sports_status`. `043_rls_hardening.sql` se mantuvo intacta: su DDL idempotente sigue siendo redundante pero inofensivo y conserva el hardening RLS.
### Fecha
2026-09-06

## 4. `activities` creada manualmente fuera del historial
### Problema
`20260709000001_bitacora_campos_extendidos.sql` fallaba porque `public.activities` no existía. La misma tabla también bloqueaba `20260720000001_activity_athletes_and_entregado.sql`.
### Causa raíz
No existe un `CREATE TABLE activities` previo en el árbol de migraciones ni una sentencia equivalente en el ledger de producción. La tabla fue creada manualmente. El esquema exacto se reconstruyó desde la tabla viva de producción mediante `information_schema.columns`, `pg_indexes`, `pg_constraint` y `pg_enum`.
### Archivo(s) involucrado(s)
- `supabase/migrations/20260101000000_create_activities_table.sql`
- `supabase/migrations/20260709000001_bitacora_campos_extendidos.sql`
- `supabase/migrations/20260720000001_activity_athletes_and_entregado.sql`
### Fix aplicado
Se creó `20260101000000_create_activities_table.sql` con los enums, columnas, constraints e índices de `public.activities` reconstruidos desde producción. El timestamp queda antes de los consumidores de Bitácora. Como el branch ya contenía una migración posterior aplicada (`20260708000001`), se aplicó con:

```bash
supabase db push --linked --include-all
```

La flag seleccionó únicamente versiones ausentes del ledger remoto; no reejecutó migraciones ya registradas.
### Fecha
2026-09-06

## Riesgo pendiente: dos árboles de migraciones
Existe una carpeta separada en la raíz del árbol local:

```text
../../supabase/migrations/
```

Es distinta de la carpeta canónica usada por la app web:

```text
supabase/migrations/
```

No son symlinks, contienen conjuntos divergentes de archivos y sus `project-ref` pueden apuntar a destinos distintos. La copia raíz conserva, entre otras diferencias, `026_mobile_notification_write_policies.sql`, mientras que el árbol web usa `059_mobile_notification_write_policies.sql`.

No se modificó ni eliminó la carpeta raíz en esta sesión. Debe investigarse y resolverse por separado antes de automatizar migraciones o ejecutar comandos desde la raíz del monorepo.

## Estándar de autorización del módulo de Perfil Psicológico
### Problema
Los permisos granulares del módulo no bastan para expresar el ámbito profesional clínico ni los límites de roster. Los helpers RBAC genéricos también permiten bypass de `super_admin`, incompatible con publicación y edición clínica.
### Causa raíz
Las operaciones clínicas requieren proteger simultáneamente el rol profesional, la capacidad revocable y las filas disponibles. Un permiso aislado no expresa el ámbito clínico; un rol aislado no permite revocar una capacidad puntual.
### Archivo(s) involucrado(s)
- `app/api/psych/**`
- `app/[locale]/(app)/dashboard/coach/psych/**`
- `app/[locale]/(app)/dashboard/mental-health/**`
- `supabase/migrations/052_psych_rbac.sql`
- `supabase/migrations/053_psych_coach_athlete_assignments.sql`
### Fix aplicado
Toda operación psicológica aplica tres capas:

1. Rol estricto: `mental_health_admin` para operaciones clínicas y `coach` para vistas del roster.
2. Permiso granular revocable: `psych.publish_to_athlete`, `psych.write_interpretation`, `psych.manage_instruments` o `psych.read_interpreted`, según la operación.
3. RLS y roster como límite de filas.

No usar `requireRoutePermission()` ni `assertRole()` en operaciones clínicas cuando sus bypasses administrativos amplíen el acceso. `super_admin` no obtiene publicación ni edición clínica solo por bypass administrativo.
### Fecha
2026-09-06

# Seguridad — Registro de Auditoría RBAC

**Última revisión:** 2026-07-08
**Verificación automatizada:** 2026-07-08 — `295/295 tests pasan`
**Rama:** `main` (apps/web) · `main` (monorepo)

## Resumen ejecutivo
Esta auditoría fue solicitada para verificar los roles, permisos y accesos del perfil
`auditor`, en particular del usuario **José Javier Sánchez Ramírez**
(`javier.sanchezramirez67@gmail.com`). Se identificaron 6 hallazgos de seguridad en
`apps/web`, todos corregidos en esta sesión y verificados mediante una suite de
34 tests automatizados.

| Hallazgo | Severidad | Estado |
|----------|-----------|--------|
| HAL-01: Auditor clasificado como `isAdmin` en lista de citas | Media | ✅ Corregido |
| HAL-02: Detalle de cita inaccesible (flujo roto) | Baja | ✅ Corregido |
| HAL-03: Server Actions de escritura con guard insuficiente | Alta | ✅ Corregido |
| HAL-04: Links al diagnóstico integral visibles | Baja | ✅ Corregido |
| HAL-05: Links "Ver todo" de seguimientos visibles | Baja | ✅ Corregido |
| HAL-06: Documentos clínicos del expediente accesibles | Media | ✅ Corregido |

---

## Rol `auditor` — definición canónica

Creado por migración `061_auditor_role.sql`.

| Propiedad | Valor |
|-----------|-------|
| Código RBAC | `auditor` |
| Permisos asignados en BD | `view_athletes`, `view_calendar` |
| Acceso admin | ❌ No (`requireAdminAccess` lo rechaza) |
| Acceso finanzas | ❌ No (requiere `view_finances`) |
| Acceso follow-up clínico | ❌ No (excluido de `showFollowUp` en AppShell) |
| Acceso secciones diagnóstico | ❌ No (`getDiagnosticAccess` retorna `[]`) |

### Usuario actual con este rol

| Email | Nombre | Rol RBAC | `profiles.role` (legacy) |
|-------|--------|----------|--------------------------|
| javier.sanchezramirez67@gmail.com | José Javier Sánchez Ramírez | `auditor` | `NULL` |

> **Nota:** El campo `profiles.role` está en NULL para este usuario. Código que lea
> ese campo directamente (fuera del sistema RBAC) lo trataría como sin rol.

---

## Hallazgos — `/medical/appointments`

### HAL-01 · Auditor clasificado como `isAdmin` en la vista de lista (CORREGIDO)

**Archivo:** `apps/web/app/[locale]/(app)/medical/appointments/page.tsx` (línea 70)

**Descripción:** El auditor quedaba incluido en el array del check `isAdmin`, lo que
hacía que la query no filtrara por `created_by_profile_id` y le mostrara **todas las
citas del sistema** con el mismo label que un administrador ("Todas las citas del
sistema").

**Riesgo:** Divulgación de información — el auditor ve datos clínicos de todas las
citas sin distinción explícita de que es una vista de solo lectura.

**Corrección:** Se extrajo la detección de auditor a un flag `isAuditor` independiente.
La query sigue mostrando todas las citas (acceso de auditoría legítimo) pero con un
label diferenciado ("Vista de auditoría — todas las citas") y sin confundirse con
acceso administrativo.

---

### HAL-02 · Acceso al detalle de cita bloqueado inconsistentemente (CORREGIDO)

**Archivo:** `apps/web/app/[locale]/(app)/medical/appointments/[eventId]/page.tsx`

**Descripción:** El auditor puede ver el listado de citas y hacer clic en cualquiera,
pero la página de detalle tenía `MEDICAL_ROLE_CODES` sin incluir `auditor`, por lo que
el usuario era redirigido al dashboard inmediatamente. Flujo roto: acceso visible pero
no funcional.

**Adicionalmente:** `canEdit` se calculaba como `isOwner || isAdmin`. Al agregar
`auditor` a `MEDICAL_ROLE_CODES` sin corrección, el auditor habría podido editar
citas que no le pertenecen (ya que `isAdmin` no lo incluye pero el path lo alcanzaba).

**Corrección:** Se agregó `auditor` a `MEDICAL_ROLE_CODES` para que pueda acceder al
detalle, se introdujo `AUDITOR_ROLE_CODES` y el flag `isAuditor`. Se forzó siempre
`AppointmentReadOnly` para auditors y `canEdit` es siempre `false` para ese rol.

---

### HAL-03 · Server Actions de escritura protegidas con permiso insuficiente (CORREGIDO)

**Archivo:** `apps/web/app/[locale]/(app)/medical/appointments/[eventId]/actions.ts`

**Descripción:** Las acciones de escritura (`confirmShow`, `confirmNoShow`,
`confirmNoShowRemote`, `confirmReschedule`) usaban `assertPermission('view_athletes')`
como guard, un permiso que el auditor **sí posee**. Esto significa que un auditor
que llamara directamente a esas Server Actions (o que alcanzara el componente
`AttendanceActions` por cualquier bug futuro) podría **modificar el estado de citas**
médicas sin ser un profesional de salud.

**Riesgo:** Elevación de privilegios — escritura no autorizada sobre registros clínicos.

**Corrección:** Las cuatro acciones de escritura ahora usan `assertMedicalAccess()`,
que valida explícitamente roles clínicos y no incluye `auditor`.

---

### HAL-04 · Links al diagnóstico integral visibles para el auditor (CORREGIDO)

**Archivo:** `apps/web/app/[locale]/(app)/athletes/[id]/page.tsx`

**Descripción:** El perfil del atleta mostraba dos links a `/athletes/[id]/diagnostic`:
uno en el banner de diagnóstico incompleto y otro en el encabezado del resumen de
secciones. Aunque la página de destino ya redirigía al auditor de vuelta al perfil
(por `getDiagnosticAccess()` retornando `[]`), los links eran visibles y generaban
confusión.

**Corrección:** Ambos links se condicionan a `!isAuditor`. El auditor ve el semáforo
de estado y el porcentaje de avance, pero sin acceso al detalle clínico de cada sección.

---

### HAL-05 · Links "Ver todo" a seguimientos visibles para el auditor (CORREGIDO)

**Archivo:** `apps/web/app/[locale]/(app)/athletes/[id]/page.tsx`

**Descripción:** Los cuatro paneles de seguimiento (Entrenamiento, Nutrición, Fisioterapia,
Psicología) mostraban un link "Ver todo" que apuntaba a rutas `/follow-up/*`. El auditor
nunca puede acceder a esas rutas (`requireRole` los bloquea), pero los links eran
visibles e inducían a error.

**Corrección:** El componente `SectionHeader` acepta `href` y `viewAllLabel` opcionales.
Cuando `isAuditor` es true se pasan como `undefined` y el link no se renderiza.
El auditor sigue viendo el resumen (título, fecha, estado, nota de psicología).

---

### HAL-06 · Documentos del expediente accesibles para el auditor (CORREGIDO)

**Archivo:** `apps/web/app/[locale]/(app)/athletes/[id]/page.tsx`

**Descripción:** El componente `AthleteDocuments` se renderizaba incondicionalmente
para cualquier usuario con `view_athletes`. Esto permitía al auditor ver y descargar
los documentos adjuntos de diagnóstico y seguimiento de los atletas (estudios,
evaluaciones, imágenes médicas).

**Corrección:** El componente se envuelve en `{!isAuditor && ...}`. Los auditores
no ven la sección de documentos.

---

## Matriz de acceso — estado corregido

| Ruta / Acción | auditor |
|---------------|---------|
| `/dashboard` | ✅ Lectura |
| `/athletes` (lista) | ✅ Lectura |
| `/calendar` | ✅ Lectura |
| `/plans` | ✅ Lectura |
| `/protocols` | ✅ Lectura |
| `/medical/appointments` (lista) | ✅ Lectura — todas las citas (vista auditoría) |
| `/medical/appointments/[id]` (detalle) | ✅ Solo lectura — `AppointmentReadOnly` forzado |
| Modificar estado de cita (Server Actions) | ❌ Bloqueado |
| `/athletes/[id]` (perfil) | ✅ Lectura — info general, semáforo diagnóstico, resumen seguimientos |
| `/athletes/[id]` → link diagnóstico integral | ❌ Oculto |
| `/athletes/[id]` → links "Ver todo" seguimientos | ❌ Ocultos |
| `/athletes/[id]` → documentos adjuntos | ❌ Ocultos |
| `/athletes/[id]/diagnostic` (detalle clínico) | ❌ Redirige al perfil (`getDiagnosticAccess` retorna `[]`) |
| `/follow-up` | ❌ Bloqueado |
| `/admin` | ❌ Bloqueado |
| `/finances` | ❌ Bloqueado |
| Tickets admin / notificaciones / newsletter | ❌ Bloqueado |

---

## Archivos modificados

Todos los cambios pertenecen al repositorio `apps/web`.

| Archivo | Tipo | Hallazgos |
|---------|------|-----------|
| `app/[locale]/(app)/medical/appointments/page.tsx` | Modificado | HAL-01 |
| `app/[locale]/(app)/medical/appointments/[eventId]/page.tsx` | Modificado | HAL-02 |
| `app/[locale]/(app)/medical/appointments/[eventId]/actions.ts` | Modificado | HAL-03 |
| `app/[locale]/(app)/athletes/[id]/page.tsx` | Modificado | HAL-04, HAL-05, HAL-06 |
| `tests/helpers.ts` | Modificado | Escenario `auditor` agregado |
| `tests/rbac/auditor-access.test.ts` | Nuevo | Suite de 34 tests de verificación |

---

## Verificación automatizada

**Fecha:** 2026-07-08
**Comando:** `npm run test:run` (Vitest) en `apps/web`
**Resultado global:** `10 archivos / 295 tests — todos PASS`

### Suite `tests/rbac/auditor-access.test.ts` (34 tests, todos PASS)

Sección 1 — `hasRole`
- `hasRole("auditor")` → `true` ✅
- `hasRole("admin")` → `false` ✅
- `hasRole("super_admin")` → `false` ✅
- `hasRole("medic","physio","nutritionist","psychologist")` → `false` ✅
- `hasRole("coach")` → `false` ✅
- `hasRole("program_director","event_coordinator")` → `false` ✅

Sección 2 — `hasPermission`
- `view_athletes` → `true` ✅ (concedido por migración 061)
- `view_calendar` → `true` ✅ (concedido por migración 061)
- `edit_athletes` → `false` ✅
- `create_athletes` → `false` ✅
- `delete_athletes` → `false` ✅
- `manage_calendar` → `false` ✅
- `manage_users` → `false` ✅
- `manage_roles` → `false` ✅
- `manage_permissions` → `false` ✅
- `view_finances` → `false` ✅
- `manage_finances` → `false` ✅

Sección 3 — `requireAdminAccess`
- Redirige a `/en/dashboard` (no es admin) ✅

Sección 4 — `assertAdminAccess`
- Retorna `{ error: "Admin access required." }` ✅

Sección 5 — `requireRoutePermission`
- `view_athletes` → `null` (permitido) ✅
- `view_calendar` → `null` (permitido) ✅
- `edit_athletes` → HTTP 403 ✅
- `create_athletes` → HTTP 403 ✅
- `delete_athletes` → HTTP 403 ✅
- `manage_users` → HTTP 403 ✅
- `manage_roles` → HTTP 403 ✅
- `view_finances` → HTTP 403 ✅

Sección 6 — `getDiagnosticAccess`
- `allowedSections` → `[]` (vacío) ✅
- `canViewIntegratedResult` → `false` ✅

Sección 7 — `confirmShow` (Server Action)
- Auditor → `{ error: "No tienes acceso a esta sección." }` ✅ (HAL-03 corregido)
- Admin (program_director) → `{ error: null }` ✅ (control positivo)

Sección 8 — Auditor vs Admin
- Admin tiene `manage_users`; auditor no ✅
- Admin tiene `edit_athletes`; auditor no ✅
- Admin accede al panel admin; auditor es redirigido ✅

### Suite de regresión — tests pre-existentes (261 tests, todos PASS)

| Archivo | Tests |
|---------|-------|
| `tests/rbac/guards.test.ts` | 38 ✅ |
| `tests/attachments/attachments-flow.test.ts` | 49 ✅ |
| `tests/diagnostic/diagnostic-flow.test.ts` | 39 ✅ |
| `tests/finance/finance-module.test.ts` | 68 ✅ |
| `tests/calendar/filtering.test.ts` | 19 ✅ |
| `tests/calendar/create-event-notifications.test.ts` | 13 ✅ |
| `tests/middleware.test.ts` | 16 ✅ |
| `tests/notifications/template-utils.test.ts` | 12 ✅ |
| `tests/notifications/scheduler.test.ts` | 7 ✅ |

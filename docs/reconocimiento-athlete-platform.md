# Reconocimiento Arquitectónico — AO Deportes Platform
> Documento de base para el diseño del módulo de Finanzas.
> Generado: 2026-05-16 | Revisión: 1.0

---

## 1. RESUMEN EJECUTIVO

**AO Deportes** es una plataforma de gestión integral para atletas de alto rendimiento, compuesta por:

| App | Stack | Deploy |
|-----|-------|--------|
| **Web** (`apps/web`) | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 + Supabase | Vercel |
| **Mobile** (`apps/mobile`) | Expo / React Native + Zustand + Supabase | EAS |
| **Shared** (`packages/shared`) | TypeScript types compartidos entre web y mobile | — |

**Backend exclusivo:** Supabase (PostgreSQL 15+, Auth, Storage, Row Level Security).
No hay API REST propia; toda la lógica de negocio corre en **Next.js Server Actions** o **Route Handlers** usando el cliente `supabaseAdmin` (service role, bypasses RLS).

**Módulos activos:**
- Gestión de Atletas (expediente completo)
- Diagnóstico Inicial Integral (5 rubros: médico, nutrición, psicología, entrenador, fisioterapia)
- Seguimiento (medical, nutrición, fisioterapia, psicología, entrenamiento)
- Calendario de eventos
- Planes individuales (PDF por disciplina)
- Tickets / Case Management
- Notificaciones (email vía Resend, push vía OneSignal)
- Protocolos (PDFs de referencia por especialidad)
- Documentos adjuntos del expediente (Supabase Storage)
- RBAC completo (roles, permisos, asignación por usuario)

**Módulo por construir:** Finanzas / Gestión Económica del Programa.

---

## 2. ESTRUCTURA DEL MONOREPO

```
athlete-platform/
├── apps/
│   ├── web/                        ← Next.js (App Router)
│   │   ├── app/
│   │   │   ├── [locale]/
│   │   │   │   ├── (app)/          ← rutas protegidas (AppShell + nav)
│   │   │   │   │   ├── admin/      ← panel admin (acceso, staff, tickets, notificaciones)
│   │   │   │   │   ├── athletes/   ← expediente + diagnóstico
│   │   │   │   │   ├── calendar/
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── follow-up/  ← medical, nutrition, physio, psychology, training
│   │   │   │   │   ├── plans/
│   │   │   │   │   ├── protocols/
│   │   │   │   │   └── tickets/
│   │   │   │   └── login/
│   │   │   └── api/
│   │   │       ├── admin/run-cron/
│   │   │       ├── avatar/upload/
│   │   │       └── cron/           ← process-email-jobs, process-push-jobs, process-ticket-automation
│   │   ├── components/
│   │   │   ├── attachments/        ← AttachmentsLoader (SC), AttachmentsPanel (CC)
│   │   │   ├── plans/
│   │   │   └── follow-up/
│   │   ├── lib/
│   │   │   ├── rbac/server.ts      ← guards: requirePermission, assertPermission
│   │   │   ├── supabase-admin.ts   ← service role (server only)
│   │   │   ├── supabase-server.ts  ← anon + cookie session (server)
│   │   │   ├── supabase.ts         ← anon (client)
│   │   │   ├── attachments/
│   │   │   ├── notifications/
│   │   │   ├── plans/
│   │   │   └── types/
│   │   │       ├── diagnostic.ts
│   │   │       ├── attachments.ts
│   │   │       └── shared.ts
│   │   ├── i18n/                   ← next-intl (es / en)
│   │   ├── messages/               ← es.json, en.json
│   │   └── tests/
│   └── mobile/
│       ├── app/                    ← Expo Router
│       ├── components/
│       ├── services/               ← athletes, calendar, diagnostic, follow-up, plans…
│       ├── store/                  ← Zustand (auth-store)
│       └── hooks/
├── packages/
│   └── shared/src/types.ts         ← DiagnosticStatus, DisabilityStatus (source of truth)
├── supabase/
│   ├── migrations/                 ← 000 … 031 (ordenadas)
│   └── seeds/
└── docs/                           ← este archivo
```

---

## 3. STACK TECNOLÓGICO DETALLADO

### Web (`apps/web`)

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.2 |
| UI | React | 19.2.4 |
| Estilos | Tailwind CSS | 4.x |
| BaaS | Supabase JS | 2.101.1 |
| Auth SSR | @supabase/ssr | 0.10.0 |
| i18n | next-intl | 4.9.1 |
| Gráficos | Recharts | 3.8.1 |
| Email | Resend | 6.10.0 |
| Validación | Zod | 4.3.6 |
| Tests | Vitest | 4.1.2 |
| Tipos | TypeScript | 5.x |

### Mobile (`apps/mobile`)

| Categoría | Tecnología |
|-----------|-----------|
| Framework | Expo + React Native |
| Navegación | Expo Router |
| Estado global | Zustand |
| BaaS | Supabase JS |
| Push notifications | Expo Notifications + Firebase |

### Infraestructura

| Servicio | Uso |
|---------|-----|
| Supabase | PostgreSQL, Auth, Storage, RLS |
| Vercel | Deploy web + cron jobs |
| Resend | Envío de emails transaccionales |
| OneSignal | Push notifications móviles |
| EAS (Expo) | Build y deploy mobile |

---

## 4. ESQUEMA DE BASE DE DATOS

### Tablas de identidad y acceso

| Tabla | Columnas clave |
|-------|---------------|
| `profiles` | `id` (uuid PK), `auth_user_id` (uuid FK→auth.users), `first_name`, `last_name`, `email`, `role` (legado), `phone`, `specialty`, `avatar_url` |
| `roles` | `id` (serial PK), `code` (text unique), `name`, `description`, `is_system` |
| `permissions` | `id` (uuid PK), `name` (text unique), `description` |
| `user_roles` | `profile_id` (uuid FK), `role_id` (int FK) — PK compuesta |
| `role_permissions` | `role_id` (int FK), `permission_id` (uuid FK) — PK compuesta |

### Tablas de atleta

| Tabla | Columnas clave |
|-------|---------------|
| `athletes` | `id`, `profile_id`, `athlete_code`, `first_name`, `last_name`, `date_of_birth`, `sex`, `height_cm`, `weight_kg`, `dominant_side`, `school_or_club`, `discipline`, `disability_status`, `status` |
| `injuries` | `id`, `athlete_id`, `injury_type`, `description`, `occurred_at` |
| `athlete_notes` | `id`, `athlete_id`, `author_profile_id`, `content` |
| `athlete_attachments` | `id`, `athlete_id`, `module_name`, `section_name`, `related_record_id`, `file_name_original`, `file_path`, `mime_type`, `file_size`, `description`, `uploaded_by`, `is_active` |

### Diagnóstico inicial

| Tabla | Columnas clave |
|-------|---------------|
| `athlete_initial_diagnostic` | `id`, `athlete_id`, `overall_status`, `completion_pct`, `is_baseline`, `version` |
| `athlete_diagnostic_sections` | `id`, `diagnostic_id`, `athlete_id`, `section` (medico/nutricion/psicologia/entrenador/fisioterapia), `status`, `completion_pct` |
| `athlete_medical_evaluation` | `id`, `diagnostic_section_id`, `athlete_id`, `weight_kg`, `height_cm`, `bmi`, `body_fat_pct`, `heart_rate_rest`, `blood_pressure`, `ecg_rest`, `ecg_effort`, `muscle_strength`, `flexibility`, `posture`, `joint_integrity`, `strength_tests`, `resistance_tests`, `flexibility_tests`, `balance_coordination`, `injury_history`, `clinical_result`, `diagnosis`, `injury_risk_factors`, `medical_conditions`, `diagnostic_integration`, `risk_level`, `care_priorities`, `injury_prevention_plan`, `medical_recommendations`, `nutritional_coordination`, `recovery_strategies`, `training_load_control`, `follow_up_schedule`, `monitoring_notes`, `observations`, `sport_medical_history`, `consultation_reason`, `heredofamilial_pathological`, `heredofamilial_non_pathological`, `heredofamilial_andrological`, `heredofamilial_gyneco_obstetric`, `lab_biometria_hematica`, `lab_quimica_sanguinea`, `lab_electrocardiograma`, `lab_examen_orina`, `lab_densitometria_osea` |
| `athlete_nutrition_evaluation` | `id`, `diagnostic_section_id`, `athlete_id`, `medical_antecedents`, `heredofamilial_antecedents`, `height_cm`, `skinfolds`, `body_composition`, `food_intake`, `quantitative_data`, `qualitative_data`, `energy_expenditure`, `calorie_percentages`, `clinical_metabolic_integration`, `nutritional_diagnosis`, `qualitative_results`, `quantitative_results`, `food_plan`, `energy_requirements`, `sport_objectives`, `individual_characteristics`, `observations` |
| `athlete_psychology_evaluation` | `id`, `diagnostic_section_id`, `athlete_id`, `sport_psychological_interview`, `competitive_anxiety_inventory`, `sport_motivation_scale`, `resilience_scale`, `emotional_regulation`, `internal_motivation`, `external_motivation`, `pressure_tolerance`, `concentration`, `diagnostic_integration`, `visualization`, `self_dialogue`, `breathing_control`, `goal_setting`, `concentration_training`, `goal_follow_up`, `practical_exercises`, `psychological_feedback`, `quantitative_psychological_state`, `quantitative_performance`, `sport_performance_impact`, `observations` |
| `athlete_coach_evaluation` | `id`, `diagnostic_section_id`, `athlete_id`, `strength_test`, `power_test`, `speed_test`, `endurance_test`, `flexibility_test`, `technical_weaknesses`, `competitive_capabilities`, `movement_efficiency`, `body_mechanics`, `segment_alignment`, `athlete_sport_profile`, `discipline_intervention`, `season_structure`, `competitive_calendar`, `performance_objectives`, `preparation_stages`, `technical_correction`, `load_supervision`, `competition_preparation`, `performance_analysis`, `continuous_feedback`, `mark_monitoring`, `plan_adjustments`, `observations` |
| `athlete_physiotherapy_evaluation` | `id`, `diagnostic_section_id`, `athlete_id`, `sport_antecedents`, `previous_injuries`, `current_symptoms`, `training_loads`, `relevant_medical_factors`, `postural_anterior`, `postural_lateral`, `postural_posterior`, `joint_range_of_motion`, `strength_tests`, `contractile_capacity`, `muscle_group_performance`, `muscle_imbalances`, `joint_limitations`, `biomechanical_alterations`, `injury_risk`, `functional_diagnosis`, `discipline_intervention`, `manual_therapy`, `specific_strengthening`, `neuromuscular_reeducation`, `mobility_exercises`, `relapse_prevention`, `myofascial_release`, `joint_mobilization`, `sports_massage`, `tens_electrotherapy`, `therapeutic_ultrasound`, `muscle_electrostimulation`, `therapeutic_exercise`, `observations` |
| `athlete_integrated_results` | `id`, `diagnostic_id`, `athlete_id`, `overall_summary`, `medical_summary`, `nutritional_summary`, `psychological_summary`, `sport_profile`, `physiotherapy_summary`, `interdisciplinary_result` |
| `athlete_individual_plans` | `id`, `diagnostic_id`, `athlete_id`, `plan_type` (medico/alimentario/psicologico/entrenamiento/rehabilitacion), `content` |
| `athlete_follow_up_log` | `id`, `athlete_id`, `diagnostic_id`, `section`, `action`, `notes`, `logged_by`, `logged_at` |

### Seguimiento (follow-up)

| Tabla | Columnas clave |
|-------|---------------|
| `training_sessions` | `id`, `athlete_id`, `coach_profile_id`, `title`, `session_date`, `start_time`, `end_time`, `location`, `notes` |
| `nutrition_plans` | `id`, `athlete_id`, `nutritionist_profile_id`, `title`, `start_date`, `end_date`, `status` |
| `nutrition_checkins` | `id`, `athlete_id`, `nutritionist_profile_id`, `checkin_date`, `weight_kg`, `body_fat_percent`, `adherence_score`, `notes`, `next_actions` |
| `physio_cases` | `id`, `athlete_id`, `physio_profile_id`, `injury_id`, `status`, `opened_at` |
| `physio_sessions` | `id`, `physio_case_id`, `session_date`, `treatment_summary`, `pain_score`, `mobility_score`, `notes`, `next_session_date` |
| `psychology_cases` | `id`, `athlete_id`, `psychologist_profile_id`, `status`, `opened_at`, `summary` |
| `psychology_sessions` | `id`, `psychology_case_id`, `session_date`, `mood_score`, `stress_score`, `topic_summary`, `recommendations`, `next_session_date` |

### Calendario y eventos

| Tabla | Columnas clave |
|-------|---------------|
| `events` | `id`, `title`, `event_type`, `sport_id`, `start_at`, `end_at`, `status`, `description`, `created_by_profile_id` |
| `event_participants` | `id`, `event_id`, `participant_id`, `participant_type`, `attendance_status`, `notes` |

### Planes (PDFs)

| Tabla | Columnas clave |
|-------|---------------|
| `plans` | `id`, `type` (medical/nutrition/psychology/training/rehabilitation), `title`, `description`, `notes`, `file_path`, `file_name`, `file_size`, `is_published`, `uploaded_by` |
| `athlete_plans` | `id`, `plan_id`, `athlete_id`, `assignment_mode` (individual/collective) |

### Tickets

| Tabla | Columnas clave |
|-------|---------------|
| `tickets` | `id`, `title`, `description`, `status` (open/in_progress/resolved/closed), `priority` (low/medium/high/urgent), `created_by`, `assigned_to` |
| `ticket_comments` | `id`, `ticket_id`, `author_id`, `message` |
| `ticket_activity_log` | `id`, `ticket_id`, `action`, `performed_by`, `metadata` (jsonb) |
| `ticket_athlete_links` | asocia tickets con atletas (migración 006) |

### Notificaciones

| Tabla | Columnas clave |
|-------|---------------|
| `notification_templates` | `id`, `type` (email/push), `name`, `subject`, `body_html`, `body_text`, `variables` (jsonb) |
| `notification_campaigns` | `id`, `template_id`, `name`, `audience_filter` (jsonb), `scheduled_at`, `status` |
| `push_jobs` | `id`, `campaign_id`, `device_token`, `payload` (jsonb), `status`, `scheduled_at`, `sent_at`, `read_at` |
| `email_jobs` | `id`, `campaign_id`, `recipient_email`, `subject`, `body_html`, `status`, `scheduled_at`, `sent_at` |
| `push_device_tokens` | `id`, `profile_id`, `device_token`, `platform` (ios/android) |
| `notification_preferences` | `id`, `profile_id`, `email_enabled`, `push_enabled` |

### Catálogos

| Tabla | Columnas clave |
|-------|---------------|
| `cat_disciplines` | `id`, `code`, `name`, `block` |
| `cat_risk_levels` | `id`, `code`, `name`, `color` |
| `sports` | (migración 030) |

### Storage Buckets

| Bucket | Acceso | Uso |
|--------|--------|-----|
| `athlete-files` | Privado | Adjuntos del expediente (`athlete_attachments`) |
| `plans` | Privado | PDFs de planes (`plans.file_path`) |
| `avatars` | Privado | Fotos de perfil (`profiles.avatar_url`) |
| `protocols` | Privado | PDFs de protocolos por especialidad |
| `nutrition-files` | Privado | Archivos de seguimiento nutricional |

---

## 5. MODELO DE IDENTIDAD Y ATLETA

### Flujo de autenticación

```
Supabase Auth (email + password)
  └─► auth.users (manejado por Supabase)
        └─► trigger on insert → public.profiles (1:1)
              └─► public.user_roles (N:N)
                    └─► public.roles
                          └─► public.role_permissions
                                └─► public.permissions
```

### Resolución de identidad en el servidor

El helper `getCurrentUser()` en `lib/rbac/server.ts` resuelve en una sola request (memoizado con `React.cache()`):
1. Auth user via `supabase.auth.getUser()`
2. Profile via `supabaseAdmin.from('profiles').select(...)` (`avatar_url` incluido desde migración 022)
3. Roles via join `user_roles → roles`
4. Permissions via join `role_permissions → permissions`

El resultado es `CurrentUser { authUserId, profile, roles[], permissions: Set<string> }`.

### Roles del sistema (inmutables)

| Código (`roles.code`) | Nombre | Permisos base |
|-----------------------|--------|---------------|
| `super_admin` | Super Admin | Todos (bypasses checks) |
| `program_director` | Program Director | Todo excepto `manage_permissions` |
| `coach` | Coach | view/create/edit athletes + manage_calendar |
| `nutritionist` | Nutritionist | view/edit athletes + view_calendar |
| `physio` | Physio | view/edit athletes + view_calendar |
| `psychologist` | Psychologist | view/edit athletes + view_calendar |
| `medic` | Médico | view/edit athletes + view_calendar |
| `event_coordinator` | Event Coordinator | view_calendar |
| `guardian` | Guardian | view_calendar |
| `athlete` | Athlete | view_calendar + tickets propios |

### Relación Atleta ↔ Profile

Un atleta puede estar vinculado a un usuario Auth (cuando tiene cuenta), o existir como registro puro (staff lo gestiona todo):

```
athletes.profile_id  →  profiles.id  (nullable, ON DELETE SET NULL)
athletes.email       →  campo de contacto (puede coincidir con auth email)
```

La pantalla `/athletes/[id]` incluye un formulario `LinkAccountForm` para vincular un atleta existente a un `profile_id`.

---

## 6. PATRÓN ARQUITECTÓNICO (Server/Client Components)

### Server Component típico

```typescript
// app/[locale]/(app)/athletes/page.tsx
export default async function AthletesPage() {
  await requirePermission('view_athletes');           // guard — redirige si no tiene permiso
  const { data } = await supabaseAdmin.from('athletes').select('*');
  return <AthletesList athletes={data} />;
}
```

### Client Component típico

```typescript
// app/[locale]/(app)/athletes/[id]/diagnostic/medical-form.tsx
'use client';
export default function MedicalForm({ athleteId, existingData }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(complete: boolean) {
    const formData = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await saveMedicalSection(athleteId, complete, formData);
      // handle result
    });
  }
  return <form ref={formRef}>...</form>;
}
```

### Server Action típica

```typescript
// app/[locale]/(app)/athletes/[id]/diagnostic/actions.ts
'use server';
export async function saveMedicalSection(athleteId: string, complete: boolean, formData: FormData) {
  const denied = await assertPermission('edit_athletes');
  if (denied) return denied;
  // ... upsert supabaseAdmin
  revalidatePath(`/athletes/${athleteId}`);
  return { error: null };
}
```

### Patrón Server → Client para Server Components como props

Cuando un Server Component necesita renderizar otro Server Component dentro de un Client Component, se usa el patrón de **ReactNode como prop**:

```typescript
// page.tsx (Server)
const labStudiesPanel = <AttachmentsLoader athleteId={id} module="diagnostic" sectionName="estudios_laboratorio" />;
// DiagnosticTabs (Client) recibe labStudiesPanel: ReactNode y lo renderiza
```

### Convenciones de código

| Aspecto | Convención |
|---------|-----------|
| Archivos | `kebab-case` (e.g. `medical-form.tsx`) |
| Componentes | `PascalCase` |
| Funciones / variables | `camelCase` |
| DB columns | `snake_case` |
| Server Actions | `'use server'` al top del archivo |
| Client Components | `'use client'` al top del archivo |
| Fetch de datos | Fetch nativo vía `supabaseAdmin` en Server Components / Server Actions |
| Estado cliente | `useState` / `useTransition` — sin SWR ni React Query |
| Internacionalización | `next-intl` — locales `es` y `en` — rutas bajo `[locale]` |

---

## 7. SISTEMA DE RBAC

### Implementación

- **Guarda de páginas:** `requirePermission('permiso')` — hace `redirect()` si falla
- **Guarda de actions:** `assertPermission('permiso')` — retorna `{ error }` o `null`
- **Guarda de rutas API:** `requireRoutePermission('permiso')` — retorna `Response 403` o `null`
- **Super admin:** el rol `super_admin` bypasea todos los checks (nunca se rechaza)
- **Memoización:** `getCurrentUser()` usa `React.cache()` — máximo 1 query DB por request

### Permisos actuales en la BD

| Permiso | Descripción |
|---------|-------------|
| `view_athletes` | Leer perfiles y expedientes |
| `create_athletes` | Crear nuevos atletas |
| `edit_athletes` | Editar atletas, diagnósticos, seguimientos |
| `delete_athletes` | Eliminar atletas |
| `view_calendar` | Ver eventos del calendario |
| `manage_calendar` | Crear, editar y eliminar eventos |
| `manage_users` | Gestionar cuentas y perfiles |
| `manage_roles` | Crear, editar y eliminar roles |
| `manage_permissions` | Asignar y revocar permisos en roles |
| `view_tickets` | Leer tickets y comentarios |
| `create_tickets` | Abrir nuevos tickets |
| `edit_tickets` | Actualizar campos y estado |
| `assign_tickets` | Asignar tickets a otros usuarios |
| `comment_tickets` | Añadir comentarios |
| `close_tickets` | Cerrar y resolver tickets |
| `manage_notifications` | Gestionar plantillas y campañas |
| `view_protocols` | Leer protocolos |
| `manage_protocols` | Subir y gestionar protocolos |

---

## 8. SISTEMA DE NOTIFICACIONES

### Arquitectura

```
Scheduler (cron cada 5 min en Vercel)
  → /api/cron/process-email-jobs    → email_jobs → Resend
  → /api/cron/process-push-jobs     → push_jobs  → OneSignal
  → /api/cron/process-ticket-automation → ticket rules
```

### Flujo de campaña

1. Admin crea `notification_template` (tipo email o push, con variables)
2. Admin crea `notification_campaign` con `audience_filter` (jsonb) y `scheduled_at`
3. Cron procesa la campaña: resuelve la audiencia → inserta `email_jobs` o `push_jobs`
4. Cron procesa los jobs: los envía vía Resend (email) u OneSignal (push)

---

## 9. VARIABLES DE ENTORNO

| Variable | Lado | Archivos que la usan |
|---------|------|---------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente + Servidor | `supabase-admin.ts`, `supabase-server.ts`, `supabase.ts` (mobile) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente + Servidor | `supabase-server.ts`, `supabase.ts` (mobile) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor | `supabase-admin.ts` |
| `RESEND_API_KEY` | Solo servidor | `lib/notifications/providers/resend-adapter.ts` |
| `RESEND_FROM_EMAIL` | Solo servidor | `lib/notifications/email-service.ts` |
| `ONESIGNAL_APP_ID` | Solo servidor | `lib/notifications/providers/onesignal-adapter.ts` |
| `ONESIGNAL_REST_API_KEY` | Solo servidor | `lib/notifications/providers/onesignal-adapter.ts` |
| `NEXT_PUBLIC_APP_URL` | Cliente + Servidor | links en emails de tickets |
| `CRON_SECRET` | Solo servidor | `lib/cron/auth.ts` — valida requests del cron de Vercel |

---

## 10. CONFLICTOS POTENCIALES CON EL MÓDULO DE FINANZAS

### CONFLICTO 1: Tabla de nomenclatura `plans`

- **Descripción:** Ya existe una tabla `public.plans` que almacena planes de entrenamiento/nutrición/psicología en PDF. El módulo de finanzas podría querer usar "planes" en el sentido de presupuestos o planes de pago.
- **Archivos afectados:** `supabase/migrations/020_plans.sql`, `apps/web/lib/plans/actions.ts`, `components/plans/`, `app/[locale]/(app)/plans/`
- **Impacto:** Alto — colisión de nombre lógico y posiblemente de ruta URL (`/plans`)
- **Mitigación propuesta:** Nombrar las entidades financieras con prefijo explícito: `finance_budgets`, `finance_invoices`, `finance_payments`. La ruta debe ser `/finanzas/` no `/plans/`.

### CONFLICTO 2: Permisos RBAC — ningún permiso financiero existe

- **Descripción:** La tabla `permissions` no tiene ninguna entrada relacionada con finanzas. Todos los roles existentes (incluyendo `program_director`) carecen de permisos financieros.
- **Archivos afectados:** `supabase/migrations/002_rbac_adapt.sql`, `lib/rbac/server.ts`
- **Impacto:** Medio — hay que insertar permisos nuevos y asignarlos a roles
- **Mitigación propuesta:** Migración `032_finance_permissions.sql` que inserte: `view_finances`, `manage_finances`, `approve_expenses`, `view_reports`. Asignar a `super_admin` y `program_director` por defecto.

### CONFLICTO 3: `profiles.role` (campo legado) vs RBAC

- **Descripción:** Existe un campo legado `profiles.role TEXT` que algunos fallbacks en el código usan cuando `user_roles` no está poblado. Un rol "financiero" que solo exista en RBAC podría no funcionar en esos fallbacks.
- **Archivos afectados:** `lib/rbac/server.ts` (`getProfilesByRoleCodes` — línea fallback), `supabase/migrations/000_base_schema.sql`
- **Impacto:** Bajo — los fallbacks son para compatibilidad backward, no se usan en instalaciones nuevas
- **Mitigación propuesta:** Asegurarse de que cualquier query de staff financiero use exclusivamente el path RBAC (`user_roles → roles`), no el fallback `profiles.role`.

### CONFLICTO 4: Storage bucket naming

- **Descripción:** Los buckets existentes (`athlete-files`, `plans`, `avatars`, `protocols`, `nutrition-files`) usan nombres cortos. Finanzas necesitará su propio bucket para facturas/comprobantes.
- **Archivos afectados:** `supabase/migrations/012_athlete_attachments.sql`, `026_athlete_files_storage.sql`
- **Impacto:** Bajo — no hay colisión, solo requiere creación explícita
- **Mitigación propuesta:** Crear bucket `finance-files` con políticas RLS restringidas a roles financieros. Path convention: `finance-files/{concept_type}/{uuid}.pdf`.

### CONFLICTO 5: Navegación (`nav-links.tsx`) — estructura fija

- **Descripción:** `components/nav-links.tsx` tiene un array `mainLinks` hardcodeado. No hay sistema de navegación dinámica basado en permisos.
- **Archivos afectados:** `apps/web/components/nav-links.tsx`
- **Impacto:** Medio — agregar "Finanzas" requiere editar este archivo manualmente y gestionar visibilidad por rol
- **Mitigación propuesta:** Agregar entrada a `mainLinks` con ocultamiento usando `isAthlete` guard (igual que se hace con `/athletes` y `/follow-up`). Considerar refactorizar a un array basado en permisos para mayor escalabilidad.

### CONFLICTO 6: Módulo de notificaciones — sin trigger financiero

- **Descripción:** El sistema de notificaciones soporta email y push, con templates y campañas. No existe un trigger/automación para eventos financieros (facturas vencidas, pagos aprobados, etc.).
- **Archivos afectados:** `lib/notifications/`, `app/api/cron/process-ticket-automation/`
- **Impacto:** Bajo — es una extensión, no un conflicto directo
- **Mitigación propuesta:** Agregar un nuevo job cron `process-finance-automation` o reutilizar el mecanismo de `ticket_automation_rules` para disparos financieros.

---

## 11. OPORTUNIDADES DE REUTILIZACIÓN

| Elemento | Tipo | Archivo | Cómo usarlo en Finanzas |
|---------|------|---------|------------------------|
| `assertPermission` / `requirePermission` | Guard function | `lib/rbac/server.ts` | Proteger todas las server actions y páginas financieras con `view_finances` / `manage_finances` |
| `supabaseAdmin` | Supabase client | `lib/supabase-admin.ts` | Todas las queries de escritura en tablas financieras |
| `AttachmentsLoader` + `AttachmentsPanel` | Server + Client Components | `components/attachments/` | Adjuntar comprobantes de pago, facturas PDF — solo requiere un nuevo `module_name` como `'finance'` en `lib/types/attachments.ts` |
| `Pagination` | Client Component | `components/pagination.tsx` | Paginar listados de transacciones o facturas |
| `revalidatePath` pattern | Next.js cache | en todas las server actions | Invalidar cache de páginas financieras tras mutaciones |
| `getProfilesByRoleCodes` | Helper RBAC | `lib/rbac/server.ts` | Obtener listado de responsables financieros para selectores de asignación |
| `update_updated_at_column()` | PostgreSQL trigger | `supabase/migrations/005_tickets.sql` | Reutilizar el mismo trigger function para tablas `finance_*` |
| Notification templates + campaigns | Sistema completo | `lib/notifications/` | Notificar aprobación de gastos o vencimiento de pagos vía email/push |
| Tickets + `ticket_activity_log` | Case management | `lib/tickets/` | Modelar solicitudes de reembolso como tickets si el volumen no justifica un sistema propio |
| `formatFileSize` | Helper | `lib/types/attachments.ts` | Mostrar tamaño de archivos adjuntos en finanzas |
| RBAC admin UI | Páginas completas | `app/[locale]/(app)/admin/access-control/` | Crear/asignar el nuevo rol financiero desde la UI existente — sin código nuevo |
| i18n (next-intl) | Infraestructura | `i18n/`, `messages/es.json` | Agregar claves de traducción bajo namespace `finances` |

---

## 12. DECISIONES REQUERIDAS ANTES DE CONTINUAR

1. **Alcance del módulo de Finanzas**
   - Opción A: Solo gestión de presupuestos y gastos del programa (sin facturación a atletas)
   - Opción B: Presupuestos + pagos de inscripciones / cuotas de atletas (requiere vincular `athletes` con conceptos financieros)

2. **Granularidad de permisos financieros**
   - Opción A: Un solo permiso `manage_finances` para todo (más simple)
   - Opción B: Permisos separados `view_finances`, `manage_finances`, `approve_expenses`, `view_reports` (más fino, ya definido en sección 10 conflicto 2)

3. **Visibilidad por rol**
   - ¿Quién puede ver/gestionar finanzas? Solo `super_admin` y `program_director`, ¿o también el nuevo rol `finance_admin`?

4. **Modelo de datos principal**
   - Opción A: Tabla `finance_transactions` genérica con `type` (ingreso/egreso/transferencia)
   - Opción B: Tablas separadas `finance_budgets`, `finance_expenses`, `finance_invoices`

5. **Integración con atletas**
   - Opción A: Finanzas es independiente del expediente del atleta (solo nivel de programa)
   - Opción B: Cada atleta tiene registros financieros propios (cuotas, becas, equipamiento)

6. **Adjuntos (comprobantes)**
   - Opción A: Reutilizar `athlete_attachments` con un nuevo `module_name = 'finance'`
   - Opción B: Nueva tabla `finance_attachments` desvinculada de atletas

7. **Vista móvil**
   - ¿El módulo de finanzas debe tener visibilidad en la app mobile, o es exclusivo de la web?

8. **Numeración de migración**
   - La siguiente migración disponible es `032`. ¿El módulo de finanzas va en una sola migración grande o en varias (032 tablas + 033 permisos + 034 storage)?

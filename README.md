# AO Deportes — Athlete Platform

Plataforma de gestión y desarrollo deportivo para AO Deportes.

## Estructura del proyecto

```
athlete-platform/
├── apps/
│   ├── web/        # App web — Next.js 16 (desplegada en Vercel)
│   └── mobile/     # App móvil — Expo / React Native (iOS + Android)
└── packages/
    └── shared/     # Tipos TypeScript compartidos
```

## Estructura de repositorios Git

> **Importante:** aunque los proyectos están colocados en el mismo directorio,
> `apps/web` y `apps/mobile` son **repositorios Git independientes** con su
> propio directorio `.git`. El directorio raíz `athlete-platform/` NO es un
> repositorio Git.

```
athlete-platform/          ← directorio físico (sin .git)
├── apps/
│   ├── web/.git           ← repo independiente, branch: main
│   └── mobile/.git        ← repo independiente, branch: fix/mobile-web-separation
└── packages/
    └── shared/            ← sin .git — mantenido manualmente en sync
```

### Flujo de trabajo por plataforma

**Web:**
```bash
cd apps/web
git status / git pull / git push   # opera sobre el repo de web
```

**Mobile:**
```bash
cd apps/mobile
git status / git pull / git push   # opera sobre el repo de mobile
```

### ¿Por qué repos separados?

La web y el mobile se despliegan de forma independiente (Vercel vs EAS/App Stores)
y tienen ciclos de release distintos. Mantener repos separados simplifica el CI/CD
de cada plataforma sin acoplar sus versiones.

---

## Inicio rápido

### Web

```bash
cd apps/web
npm install
cp .env.example .env.local   # completar valores reales
npm run dev                  # http://localhost:3000
```

Comandos disponibles:

| Comando          | Descripción                         |
|------------------|-------------------------------------|
| `npm run dev`    | Servidor de desarrollo              |
| `npm run build`  | Build de producción                 |
| `npm run lint`   | ESLint                              |
| `npm run test:run` | Pruebas unitarias (Vitest, single pass) |

### Mobile

```bash
cd apps/mobile
npm install
cp .env.example .env.local   # completar valores reales
npx expo start               # abre Expo Dev Tools
```

Comandos disponibles:

| Comando              | Descripción                          |
|----------------------|--------------------------------------|
| `npm run ios`        | Inicia en simulador iOS              |
| `npm run android`    | Inicia en emulador Android           |
| `npm run lint`       | ESLint via expo lint                 |
| `npm run test:run`   | Pruebas unitarias (Vitest, single pass) |

---

## Tipos compartidos (`packages/shared`)

`packages/shared/src/types.ts` es la fuente de verdad de los tipos de dominio.

La app web los re-exporta desde `apps/web/lib/types/shared.ts`.
La app mobile los mantiene en **copia manual sincronizada** en `apps/mobile/types/index.ts`.

Consulta la cabecera de `apps/mobile/types/index.ts` para las instrucciones de sincronización.

---

## Base de datos

El backend es [Supabase](https://supabase.com). Las migraciones están numeradas
y se aplican con:

```bash
node apply-migration.mjs
```

---

## Variables de entorno

Cada app tiene su propio `.env.example`. Copia el archivo a `.env.local` y
completa los valores antes de correr el proyecto.

| Variable                      | App    | Descripción                                     |
|-------------------------------|--------|-------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`    | web    | URL del proyecto Supabase                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web  | Clave anon de Supabase                         |
| `SUPABASE_SERVICE_ROLE_KEY`   | web    | Clave service role (server-only)                |
| `RESEND_API_KEY`              | web    | API key de Resend (email)                       |
| `RESEND_FROM_EMAIL`           | web    | Dirección remitente verificada en Resend        |
| `ONESIGNAL_APP_ID`            | web    | ID de app OneSignal (push server-side)          |
| `ONESIGNAL_REST_API_KEY`      | web    | REST API key de OneSignal                       |
| `CRON_SECRET`                 | web    | Secret para autenticar llamadas de Vercel Cron  |
| `NEXT_PUBLIC_APP_URL`         | web    | URL pública de la app (`https://aodeporte.com`) |
| `EXPO_PUBLIC_SUPABASE_URL`    | mobile | URL del proyecto Supabase                       |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | Clave anon de Supabase                        |
| `EXPO_PUBLIC_WEB_URL`         | mobile | URL de la web (para proxy de avatares)          |

# AO Deportes — Web App

Plataforma de gestión y desarrollo de atletas. Construida con [Next.js](https://nextjs.org) 16, [Supabase](https://supabase.com), y desplegada en [Vercel](https://vercel.com).

Dominio de producción: **https://aodeporte.com**

## Stack tecnológico

- **Framework**: Next.js 16 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS v4
- **Backend/Auth**: Supabase (PostgreSQL + Auth + Storage)
- **Email**: Resend
- **Push notifications**: OneSignal
- **i18n**: next-intl (español e inglés)
- **Deployment**: Vercel

## Desarrollo local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env.local` y rellena los valores:

```bash
cp .env.example .env.local
```

Variables requeridas:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo server-side) |
| `RESEND_API_KEY` | API key de Resend para emails |
| `RESEND_FROM_EMAIL` | Dirección remitente verificada en Resend |
| `ONESIGNAL_APP_ID` | App ID de OneSignal |
| `ONESIGNAL_REST_API_KEY` | REST API key de OneSignal |
| `NEXT_PUBLIC_APP_URL` | URL base de la app (`http://localhost:3000` en dev) |
| `CRON_SECRET` | Secret compartido para proteger los cron jobs |

### 3. Iniciar servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Scripts disponibles

```bash
npm run dev        # Servidor de desarrollo
npm run build      # Build de producción
npm run start      # Servidor de producción (requiere build previo)
npm run lint       # ESLint
npm run test       # Vitest (modo watch)
npm run test:run   # Vitest (una sola ejecución)
```

## Arquitectura

### Routing

Usa el App Router de Next.js con segmento `[locale]` para internacionalización:

```
app/
  layout.tsx                    # Root layout (html/body)
  globals.css
  [locale]/
    layout.tsx                  # Layout con AppShell + next-intl
    page.tsx                    # Redirige a /dashboard
    login/
    dashboard/
    athletes/
    calendar/
    follow-up/
    protocols/
    preferencias/
    admin/                      # Panel de administración
      access-control/           # RBAC: roles, permisos, usuarios
      notificaciones/           # Email, push, tickets
      staff/
      tickets/
  api/
    cron/                       # Cron jobs (protegidos por CRON_SECRET)
      process-email-jobs/
      process-push-jobs/
      process-ticket-automation/
    admin/run-cron/             # Trigger manual de crons
```

### Middleware (proxy.ts)

Maneja locale detection, redirección automática y autenticación Supabase en cada request.

### Supabase

- `lib/supabase.ts` — cliente pública (browser)
- `lib/supabase-server.ts` — cliente server-side con cookies (Server Components / Actions)
- `lib/supabase-admin.ts` — cliente con service role key (solo server)

### i18n

Traduciones en `messages/en.json` y `messages/es.json`. Configuración en `i18n/`.

## Deployment en Vercel

### Variables de entorno requeridas en Vercel

Configura estas variables en **Settings → Environment Variables** de tu proyecto Vercel:

| Variable | Dev | Preview | Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | ✓ |
| `RESEND_API_KEY` | ✓ | ✓ | ✓ |
| `RESEND_FROM_EMAIL` | ✓ | ✓ | ✓ |
| `ONESIGNAL_APP_ID` | ✓ | ✓ | ✓ |
| `ONESIGNAL_REST_API_KEY` | ✓ | ✓ | ✓ |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | URL de preview | `https://aodeporte.com` |
| `CRON_SECRET` | string aleatorio | string aleatorio | string aleatorio |

### Dominio

1. En Vercel → **Settings → Domains**: agrega `aodeporte.com` y `www.aodeporte.com`.
2. En tu proveedor de dominio: configura los registros DNS según las instrucciones de Vercel (generalmente registros A/CNAME hacia `cname.vercel-dns.com`).

### Cron Jobs

Definidos en `vercel.json`. Se ejecutan diariamente a medianoche UTC. Vercel los llama con el header `Authorization: Bearer <CRON_SECRET>`.

## Monorepo

Este proyecto vive en `apps/web/` dentro del monorepo `athlete-platform`. El monorepo también contiene:
- `apps/mobile/` — App React Native (Expo)
- `packages/shared/` — Tipos compartidos

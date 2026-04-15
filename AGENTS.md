# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Start production server (requires build)
npm run start

# Lint
npm run lint

# Run tests (watch mode)
npm run test

# Run tests (single pass)
npm run test:run
```

There is no separate test runner setup needed — Vitest is configured via `vitest.config.ts`.

## Architecture

This is the **AO Deportes** web app — a [Next.js](https://nextjs.org) 16 application using the **App Router**. It is part of a monorepo at `../../` (athlete-platform), alongside `apps/mobile` and `packages/shared`.

Production domain: `https://aodeporte.com`. Deployed on Vercel.

### Routing structure

All pages live under `app/[locale]/` for i18n support (Spanish / English via `next-intl`).

```
app/
  layout.tsx                  # Root layout (html/body, reads locale header)
  globals.css
  [locale]/
    layout.tsx                # AppShell + next-intl provider; exports metadata
    page.tsx                  # / → redirects to /dashboard
    login/
    dashboard/
    athletes/[id]/
    calendar/
    follow-up/medical|nutrition|physio|psychology|training/
    protocols/coach|medic|nutrition|physio|psychology/
    preferencias/notificaciones/
    admin/
      page.tsx                # Admin home
      access-control/         # RBAC: roles, permissions, users
      notificaciones/         # Email campaigns, push campaigns, ticket automation
      staff/
      tickets/
  api/
    cron/process-email-jobs/
    cron/process-push-jobs/
    cron/process-ticket-automation/
    admin/run-cron/           # Manual cron trigger (admin UI)
```

### Middleware (proxy.ts)

Handles locale detection and redirect, Supabase session refresh, and auth gating for all routes. Public paths: `/login` and `/api/auth/**`.

### Path alias

`@/` is aliased to the project root (`/apps/web/`), configured in `tsconfig.json`. Use it for all internal imports, e.g. `@/lib/supabase`, `@/components/AppShell`.

### Backend

Supabase is the backend, initialized in:
- `lib/supabase.ts` — browser client
- `lib/supabase-server.ts` — server client (reads/writes auth cookies; use in Server Components, Actions, and middleware)
- `lib/supabase-admin.ts` — service-role client (bypasses RLS; server-only)

### Email / Push

- Email via **Resend** (`lib/notifications/providers/resend-adapter.ts`). Sender address: `RESEND_FROM_EMAIL` env var.
- Push notifications via **OneSignal** (`ONESIGNAL_APP_ID` / `ONESIGNAL_REST_API_KEY`).
- Ticket lifecycle emails in `lib/notifications/ticket-email-service.ts`.

### i18n

Translations in `messages/en.json` and `messages/es.json`. Routing config in `i18n/routing.ts`.
Default locale: `en`. Supported: `['en', 'es']`.

### Environment variables

See `.env.example` for the full list. Required for local dev: copy to `.env.local`.
For production (`NEXT_PUBLIC_APP_URL`): must be `https://aodeporte.com`.

### Shared types (monorepo)

Domain types live in `../../packages/shared/src/types.ts` (`@athlete-platform/shared`). Currently exports `UserRole` and `AthleteStatus`.

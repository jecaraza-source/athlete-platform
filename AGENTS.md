# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start dev server (opens QR code for Expo Go / simulators)
npm start               # or: npx expo start

# Run on a specific platform
npm run ios             # iOS simulator
npm run android         # Android emulator
npm run web             # Browser

# Lint
npm run lint            # runs expo lint (eslint-config-expo)
```

There is no test runner configured in this project.

## Architecture

This is an [Expo](https://expo.dev) React Native app using **file-based routing via `expo-router`**. It is part of a monorepo at `../../` (athlete-platform), alongside `apps/web` and `packages/shared`.

### Routing structure

expo-router maps the `app/` directory to routes. The nesting here is intentional:

```
app/
  _layout.tsx              # Root Stack: registers "app" and "modal" screens
  modal.tsx                # Presented as a modal over any route
  app/
    _layout.tsx            # Nested Stack (no headers)
    (auth)/
      login.tsx            # /app/(auth)/login
    (tabs)/
      _layout.tsx          # Bottom tab navigator (Home, Calendar, Plan, Progress, Profile)
      index.tsx            # /app/(tabs)/ — Home
      calendar.tsx
      plan.tsx
      progress.tsx
      profile.tsx
```

The root URL navigates to `app/app/(tabs)/index.tsx` (Home). The `(auth)` and `(tabs)` segments are route groups (parentheses = not part of the URL).

### Path alias

`@/` is aliased to the repo root (`/apps/mobile/`), configured in `tsconfig.json`. Use it for all internal imports, e.g. `@/components/themed-text`, `@/lib/supabase`, `@/constants/theme`.

### Backend

Supabase is the backend, initialized in `lib/supabase.ts` and exported as `supabase`. The client uses a public anon key.

### Theming

- Color palette: `constants/theme.ts` exports `Colors` (light/dark variants) and `Fonts` (platform-specific font stacks).
- `hooks/use-theme-color.ts` — resolves a color token for the active color scheme.
- `components/themed-text.tsx` / `components/themed-view.tsx` — drop-in themed wrappers for `Text` and `View`.
- Light/dark mode is automatic (`userInterfaceStyle: "automatic"` in `app.json`).

### Shared types (monorepo)

Domain types live in `../../packages/shared/src/types.ts` (`@athlete-platform/shared`). Currently exports `UserRole` and `AthleteStatus`. There is also a local stub at `app/packages/shared/` — prefer the monorepo root package.

### Notable Expo config flags (app.json)

- `newArchEnabled: true` — React Native New Architecture is on.
- `experiments.reactCompiler: true` — React Compiler is enabled; avoid manual `useMemo`/`useCallback` unless the compiler can't handle the pattern.
- `experiments.typedRoutes: true` — expo-router generates types for all routes; use typed `href` values when navigating.

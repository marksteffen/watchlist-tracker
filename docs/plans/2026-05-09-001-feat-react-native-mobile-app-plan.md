---
title: "feat: React Native / Expo Mobile App"
type: feat
status: active
date: 2026-05-09
---

# feat: React Native / Expo Mobile App

## Overview

Build a React Native / Expo mobile app that connects to the same Supabase backend as the existing Next.js web app. The mobile app will let users sign in, complete onboarding (Letterboxd username + streaming provider selection), view their watchlist filtered to what's streaming, and automatically refresh that data every time the app comes to the foreground.

The app will live as a `mobile/` directory inside the existing repository. Core behavior is identical to the web app; the difference is platform and the addition of automatic on-launch syncing.

## Problem Frame

The web app requires a browser visit to check what's newly streaming on your watchlist. A mobile app makes this ambient: glance at the homescreen, tap to check. The two features the user specifically wants on mobile are (1) persistent login across launches and (2) automatic watchlist + streaming data refresh on open — neither of which the web app currently provides.

## Requirements Trace

- R1. User remains logged in across app restarts without re-authenticating
- R2. Watchlist and streaming availability data refresh automatically when the app is opened (foreground sync)
- R3. Full onboarding flow: Letterboxd username entry + streaming provider selection
- R4. Dashboard: watchlist film grid filtered to streaming availability, with "new" badges
- R5. Settings: update username/subscriptions, sign out
- R6. Mobile app shares the same Supabase project as the web app (same DB, same auth)
- R7. TMDB API key and Supabase service role key are never bundled in the mobile app
- R8. Business logic constants and shared types are defined once and imported by both web and mobile

## Scope Boundaries

- iOS and Android targets; no Expo web target
- Email/password auth only (no OAuth, no magic links in v1)
- Foreground sync only — no background sync while app is closed
- US streaming region only (matches current web app behavior)
- No in-app notifications (push notifications are a follow-up plan)
- Film detail screen is out of scope (links to Letterboxd in browser, same as web app)

### Deferred to Separate Tasks

- Push notifications ("now streaming" alerts): requires Expo Notifications, push token storage, Supabase Edge Function, and DB webhooks — separate plan after mobile v1 ships
- App rename: UI strings and `app.json` `name`/`slug` can be updated when a name is chosen; no blocker to shipping first
- International region support: hardcoded to US in current backend; extend in a separate task if needed
- `streaming_subscriptions` DB migration from `text[]` to `int[]`: a cleanup task; mobile app will cast on read/write, same as web app currently does

## Context & Research

### Relevant Code and Patterns

- `lib/supabase.ts` — browser client using `@supabase/ssr`'s `createBrowserClient` (cookies-based); mobile cannot use this
- `lib/supabase-server.ts` — server client pattern using `createServerClient`; API route auth reads from request cookies — **needs to also accept JWT Bearer tokens for mobile**
- `app/api/sync-watchlist/route.ts` — scrapes Letterboxd + upserts `films` + `user_watchlist`; uses TMDB and service role (server-only); mobile must call this route, not replicate it
- `app/api/refresh-streaming/route.ts` — fetches TMDB streaming availability; same server-only constraint
- `app/api/validate-username/route.ts` — public, no auth; mobile can call as-is
- `components/OnboardingClient.tsx` / `SettingsClient.tsx` — pattern for writing to `users` table via anon client with JWT; same pattern works in React Native
- `supabase-schema.sql` — `users.streaming_subscriptions` is `text[]` storing stringified integers (e.g. `["8", "337"]`); handle with `.map(Number)` on read, `.map(String)` on write

### External References

- Supabase React Native auth: use `@supabase/supabase-js` v2 directly with `@react-native-async-storage/async-storage` as the storage adapter
- `react-native-url-polyfill` required as first import — Supabase uses WHATWG URL internally
- `processLock` (imported from `@supabase/supabase-js`) prevents token refresh race conditions
- `detectSessionInUrl: false` is required on native to prevent the client from accessing `window.location`
- Expo Router (SDK 53+) is the recommended file-based navigation solution; mirrors Next.js App Router mental model
- `expo-background-task` replaces deprecated `expo-background-fetch` as of SDK 53; deferred — not used in v1
- AsyncStorage size is unbounded for sessions (unlike SecureStore's 2048-byte limit); correct choice for Supabase JWTs

## Key Technical Decisions

- **Monorepo structure (`mobile/` directory)**: Keeps the web and mobile apps in a single repo so TypeScript types, environment setup, and deployment stay coordinated. Mobile package.json is self-contained — no root-level Expo config bleeds into the web build.
- **JWT Bearer auth added to web API routes**: The sync and refresh routes currently read auth from cookies only. Rather than duplicating scraping logic in a Supabase Edge Function, we extend the existing route handlers to also accept `Authorization: Bearer <token>`. This is the lowest-effort path that keeps server-side secrets server-side and avoids managing a separate Edge Function deployment.
- **New `GET /api/streaming-providers` route**: The onboarding page currently calls `getAllStreamingProviders()` server-side in a Next.js Server Component. Mobile needs this list too, but cannot call TMDB directly (API key is server-only). A lightweight public route exposes the list.
- **Direct Supabase reads for dashboard data**: The mobile app queries `user_watchlist`, `films`, and `streaming_availability` directly using the user's JWT — same as the web app does in Server Components, just from a mobile client. No API route intermediary needed for reads.
- **Foreground sync via AppState**: Sync fires on initial mount and whenever `AppState` transitions to `'active'`. A timestamp ref prevents syncing more than once per hour. No `expo-background-task` in v1.
- **Expo SDK 53 target**: SDK 53 introduced `expo-background-task` (deferred) and stabilized Expo Router v4. More conservative than bleeding-edge SDK 55 while still getting typed routes and `Stack.Protected`.

## Open Questions

### Resolved During Planning

- **Can mobile reuse web API routes?** Yes — with the JWT Bearer auth modification (Unit 3). Routes already return JSON and don't depend on SSR rendering.
- **Where does the TMDB provider list come from on mobile?** A new `GET /api/streaming-providers` route (Unit 3), since the TMDB key must stay server-side.
- **Can mobile query Supabase directly for reads?** Yes — existing RLS policies allow users to read their own `user_watchlist`, and `films`/`streaming_availability` are publicly readable.
- **What session storage adapter?** `@react-native-async-storage/async-storage` — not `expo-secure-store`, which has a 2048-byte limit too small for Supabase JWTs.

### Deferred to Implementation

- **Exact debounce interval for on-launch sync**: Start with 60 minutes. Tune based on TMDB rate limits and user feedback.
- **Splash screen + loading state duration**: Depends on how long `INITIAL_SESSION` takes from AsyncStorage. Implement with a minimum 400ms shimmer to avoid flash.
- **Error retry behavior for sync failures**: No retry in v1; show a status message and let user manually retry (matches web app pattern).

## Output Structure

```
shared/                         ← Imported by both web (app/) and mobile/
  constants.ts                  ← NEW_THRESHOLD_DAYS, STALE_DAYS
  types.ts                      ← Film, Provider, SyncResult shared interfaces

mobile/
  app.json                      ← Expo config (name, scheme, plugins)
  package.json
  tsconfig.json
  .env.example
  app/
    _layout.tsx                 ← Root layout (SessionProvider, url polyfill)
    (auth)/
      _layout.tsx               ← Redirects to dashboard if session exists
      sign-in.tsx
      sign-up.tsx
    (app)/
      _layout.tsx               ← Auth guard + on-launch sync trigger
      index.tsx                 ← Dashboard (film grid)
      onboarding.tsx            ← Letterboxd username + provider selection
      settings.tsx
  components/
    FilmCard.tsx
    ProviderBadge.tsx
    ProviderPicker.tsx          ← Multi-select provider grid for onboarding/settings
    Spinner.tsx
  lib/
    supabase.ts                 ← Supabase client (AsyncStorage, processLock)
    session.ts                  ← SessionContext + useSession hook
    sync.ts                     ← syncWatchlist() and refreshStreaming() helpers
    api.ts                      ← fetch wrappers for the web API routes
```

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
App launch
  │
  ▼
Root _layout: import url polyfill, init Supabase client,
             mount SessionProvider (listens to onAuthStateChange)
  │
  ├── INITIAL_SESSION = null ──► (auth) group ──► sign-in.tsx
  │
  └── INITIAL_SESSION = session ──► (app) group ──► index.tsx (dashboard)
                                        │
                                        └── on mount / AppState 'active'
                                              │
                                              ├── POST /api/sync-watchlist
                                              │     (Bearer <jwt>)
                                              │
                                              └── POST /api/refresh-streaming
                                                    (Bearer <jwt>)

Data reads (dashboard):
  Supabase anon client + JWT
    → user_watchlist JOIN films JOIN streaming_availability
    → filter by user's streaming_subscriptions (from users table)

Data writes (onboarding/settings):
  Supabase anon client + JWT
    → supabase.from('users').update({ letterboxd_username, streaming_subscriptions })
```

## Implementation Units

- [ ] **Unit 0: Shared Constants & Types**

**Goal:** Extract the business logic constants and core TypeScript interfaces that both the web app and mobile app must agree on into a single `shared/` directory.

**Requirements:** R8

**Dependencies:** None

**Files:**
- Create: `shared/constants.ts`
- Create: `shared/types.ts`
- Modify: `components/DashboardClient.tsx` (import `NEW_THRESHOLD_DAYS` from shared)
- Modify: `app/dashboard/page.tsx` (import `STALE_DAYS` from shared)
- Modify: `tsconfig.json` (add `@shared/*` path alias)

**Approach:**
- `shared/constants.ts`: export `NEW_THRESHOLD_DAYS = 14` and `STALE_DAYS = 30`. These are the two values currently hardcoded in `DashboardClient.tsx` and `dashboard/page.tsx` respectively.
- `shared/types.ts`: export `Provider`, `Film`, and `SyncResult` interfaces (currently inlined in `DashboardClient.tsx` and the API route responses). The mobile app will import these same types.
- `tsconfig.json` root: add `"@shared/*": ["./shared/*"]` to `compilerOptions.paths` so both `app/` and `mobile/` can import via `@shared/constants`.
- Update the two web files to import from `@shared/constants` rather than using inline literals. No behavior change — purely a refactor that makes the constants canonical.

**Patterns to follow:**
- Existing `@/` path alias pattern in `tsconfig.json`

**Test scenarios:**
- Test expectation: none — pure refactor, no behavioral change. Verification is that the web app builds and the dashboard still renders with the correct badge and staleness thresholds.

**Verification:**
- `npm run build` passes with no type errors
- Dashboard "new" badge still appears on films within 14 days; stale films (>30 days `last_seen_at`) still filtered out

---

- [ ] **Unit 1: Expo Project Bootstrap**

**Goal:** Initialize a working Expo app with TypeScript, Expo Router, and the correct project structure.

**Requirements:** R6 (shared Supabase backend), R7 (no secret keys in app bundle)

**Dependencies:** None

**Files:**
- Create: `mobile/app.json`
- Create: `mobile/package.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/.env.example`
- Create: `mobile/app/_layout.tsx` (placeholder root layout)

**Approach:**
- Run `npx create-expo-app@latest mobile --template tabs` (or `blank-typescript`) then reshape to match planned structure, OR manually scaffold the files
- `app.json`: set `name` (placeholder — rename later), `slug`, `scheme` (e.g. `watchlisttracker` — must be lowercase alphanumeric), `platforms: ["ios", "android"]`; enable `experiments.typedRoutes: true`
- `package.json` dependencies: `expo`, `expo-router`, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, `expo-status-bar`, `expo-constants`
- `tsconfig.json`: extend `expo/tsconfig.base`, set `"moduleResolution": "bundler"`, path alias `@/*` → `./`, `@shared/*` → `../shared/*` (pointing up to the repo-root `shared/` directory)
- `.env.example`: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (note `EXPO_PUBLIC_` prefix, not `NEXT_PUBLIC_`)
- `.env` (gitignored) with actual values from the existing Supabase project

**Test expectation:** none — this is scaffolding. Verification is that `npx expo start` runs without errors.

**Verification:**
- `npx expo start` launches without module resolution errors
- TypeScript compilation passes
- Path alias `@/lib/...` resolves correctly

---

- [ ] **Unit 2: Supabase Client & Auth Session Persistence**

**Goal:** Set up the Supabase client with AsyncStorage session persistence, AppState-driven token refresh, and a SessionContext that the rest of the app can consume.

**Requirements:** R1 (persist login), R6 (same Supabase project)

**Dependencies:** Unit 1

**Files:**
- Create: `mobile/lib/supabase.ts`
- Create: `mobile/lib/session.ts`
- Modify: `mobile/app/_layout.tsx`

**Approach:**
- `lib/supabase.ts`: import `react-native-url-polyfill/auto` as the **first line**; create client with `storage: AsyncStorage`, `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`, `lock: processLock`; register `AppState.addEventListener('change', ...)` at module scope to call `startAutoRefresh()` / `stopAutoRefresh()` — this must be outside any component
- `lib/session.ts`: `SessionContext` with `{ session: Session | null, isLoading: boolean }` shape; `SessionProvider` listens to `supabase.auth.onAuthStateChange`; sets `isLoading = false` when event is `INITIAL_SESSION` (which fires whether a session was found or not)
- `app/_layout.tsx`: wrap `<Slot />` with `<SessionProvider>`; import the url polyfill here if not already in `lib/supabase.ts`

**Patterns to follow:**
- `lib/supabase.ts` (web) for client creation pattern — but use `AsyncStorage` adapter and remove `@supabase/ssr` dependency entirely

**Test scenarios:**
- Happy path: cold launch with existing session → `INITIAL_SESSION` fires with valid session → `isLoading` becomes false → user sees dashboard without re-logging in
- Happy path: cold launch with no session → `INITIAL_SESSION` fires with `null` → `isLoading` becomes false → user sees sign-in screen
- Happy path: app moves to background and back → `AppState` listener calls `startAutoRefresh()` → expired token refreshed before next API call
- Edge case: first-ever launch (no AsyncStorage data) → `INITIAL_SESSION` fires quickly with `null` — no hanging spinner

**Verification:**
- Sign in once, force-close app, reopen — dashboard loads without prompting re-auth
- Sign out — next launch shows sign-in screen

---

- [ ] **Unit 3: Web API Route Updates (JWT Bearer Auth + Streaming Providers Endpoint)**

**Goal:** Modify the two authenticated web API routes to accept `Authorization: Bearer <jwt>` in addition to cookies, and add a new public endpoint for fetching the streaming provider list.

**Requirements:** R2 (sync on launch), R3 (onboarding), R7 (TMDB key stays server-side)

**Dependencies:** None (web-side changes, independent of mobile units)

**Files:**
- Create: `lib/get-user-from-request.ts`
- Modify: `app/api/sync-watchlist/route.ts`
- Modify: `app/api/refresh-streaming/route.ts`
- Create: `app/api/streaming-providers/route.ts`

**Approach:**
- `lib/get-user-from-request.ts`: extract a reusable `getUserFromRequest(req: Request)` helper. Check `Authorization: Bearer <token>` header first; if present, call `supabase.auth.getUser(token)` using the anon client (not the SSR client). If no Bearer header, fall through to the existing cookie-based `createServerSupabaseClient().auth.getUser()` pattern. Return `{ user, error }`.
- Update `sync-watchlist` and `refresh-streaming` to call `getUserFromRequest` instead of directly calling `createServerSupabaseClient().auth.getUser()`
- `GET /api/streaming-providers`: call `getAllStreamingProviders('US')` from `lib/tmdb.ts`; sort by `display_priority`; return array of `{ provider_id, provider_name, logo_url }`. No auth required. Cache for 24h with `Cache-Control: max-age=86400` response header.

**Patterns to follow:**
- Existing pattern in `app/api/sync-watchlist/route.ts` for how the user identity is currently fetched

**Test scenarios:**
- Happy path (Bearer): POST `/api/sync-watchlist` with valid `Authorization: Bearer <jwt>` → 200 response with sync results
- Happy path (cookie): POST `/api/sync-watchlist` with valid session cookie → still works as before (web app regression test)
- Error path: POST `/api/sync-watchlist` with invalid/expired Bearer token → 401 response
- Error path: POST `/api/sync-watchlist` with no auth → 401 response
- Happy path: GET `/api/streaming-providers` → returns sorted provider array with logo URLs
- Error path: GET `/api/streaming-providers` with TMDB unavailable → returns empty array or 502

**Verification:**
- Existing web app sign-in + dashboard still works (cookie auth not broken)
- `curl -H "Authorization: Bearer <token>" -X POST /api/sync-watchlist` returns 200 with sync data

---

- [ ] **Unit 4: Expo Router Navigation Structure & Auth Guard**

**Goal:** Implement the file-based route groups with auth-aware guards that redirect users to the correct screen based on session state.

**Requirements:** R1 (persist login), R3, R4, R5

**Dependencies:** Unit 2

**Files:**
- Create: `mobile/app/(auth)/_layout.tsx`
- Create: `mobile/app/(app)/_layout.tsx`
- Modify: `mobile/app/_layout.tsx`

**Approach:**
- `(auth)/_layout.tsx`: consume `useSession()`; if `isLoading` show splash/spinner; if `session` exists, redirect to `/(app)/`; otherwise render `<Stack />`
- `(app)/_layout.tsx`: consume `useSession()`; if `isLoading` show spinner; if no `session`, redirect to `/(auth)/sign-in`; otherwise render `<Stack />` and trigger on-launch sync (see Unit 8)
- Root `_layout.tsx`: use `<Stack screenOptions={{ headerShown: false }} />` with `SessionProvider` wrapping — no screen-level header at the root, let each group define its own

**Patterns to follow:**
- Next.js App Router `(auth)` / `(app)` group pattern — same mental model applies in Expo Router

**Test scenarios:**
- Happy path: user with active session opens app → (app) layout renders immediately, no flash of sign-in screen
- Happy path: signed-out user opens app → (auth) layout renders sign-in
- Edge case: `isLoading = true` on both layouts → spinner shown, no redirect fires prematurely
- Integration: signing in from (auth) group → session state updates → (auth) layout redirects to (app)

**Verification:**
- No navigation loop or flickering between auth and app screens
- Back button from dashboard does not expose auth screens to a logged-in user

---

- [ ] **Unit 5: Authentication Screens (Sign In / Sign Up)**

**Goal:** Sign in and sign up screens using Supabase email/password auth.

**Requirements:** R1, R6

**Dependencies:** Units 2, 4

**Files:**
- Create: `mobile/app/(auth)/sign-in.tsx`
- Create: `mobile/app/(auth)/sign-up.tsx`
- Create: `mobile/components/Spinner.tsx`

**Approach:**
- Both screens: controlled email + password inputs, submit button with loading state, error display
- Sign in: `supabase.auth.signInWithPassword({ email, password })` → session triggers `onAuthStateChange` → (auth) layout redirects to dashboard automatically. No manual `router.push()` needed — session change drives navigation.
- Sign up: `supabase.auth.signUp({ email, password })` → if `data.session` is null (email confirmation required), show "Check your email" message — same behavior as web app
- Sign up success with immediate session: same session change → auth guard redirects. The redirect target `(app)` layout will check if onboarding is complete.
- Tab or button to switch between sign-in / sign-up modes (single-screen approach like web, or two separate screens — implementer's choice based on Expo Router convention)

**Patterns to follow:**
- `app/auth/page.tsx` for UI logic and error handling patterns

**Test scenarios:**
- Happy path: valid credentials → sign-in → dashboard (session persists next launch)
- Error path: wrong password → error message displayed, loading spinner stops
- Error path: network failure → error message displayed
- Happy path: sign-up with valid email → "check your email" message (if confirmation enabled)
- Edge case: sign-up when email already registered → Supabase returns error, displayed to user

**Verification:**
- Sign in → force close → reopen → dashboard loads without re-auth prompt

---

- [ ] **Unit 6: Onboarding Screen**

**Goal:** Collect Letterboxd username and streaming provider selections, save to Supabase, trigger initial sync.

**Requirements:** R3, R6, R7

**Dependencies:** Units 2, 3, 4

**Files:**
- Create: `mobile/app/(app)/onboarding.tsx`
- Create: `mobile/components/ProviderPicker.tsx`
- Create: `mobile/lib/api.ts`

**Approach:**
- On mount: check `users` table for existing `letterboxd_username` and `streaming_subscriptions`; if both are set, redirect to `/` (dashboard)
- Letterboxd username: text input + validate button; call `GET /api/validate-username?username=<value>` via the deployed Vercel URL (no auth needed); show inline error if invalid
- Provider list: fetch from `GET /api/streaming-providers` (Unit 3); render a scrollable grid of provider logo buttons (similar to `OnboardingClient.tsx`)
- `ProviderPicker.tsx`: receives provider list + selected IDs; renders a scrollable grid; tapping toggles selection; selected providers get a highlighted border
- On submit: write to Supabase via `supabase.from('users').update({ letterboxd_username, streaming_subscriptions: selectedIds.map(String) }).eq('id', user.id)`; then call `POST /api/sync-watchlist` with Bearer token (via `lib/api.ts`); navigate to `/` on success
- `lib/api.ts`: wrapper functions `syncWatchlist(jwt: string)` and `refreshStreaming(jwt: string)` that POST to the deployed Vercel URL with correct headers

**Patterns to follow:**
- `components/OnboardingClient.tsx` for provider selection UX and Supabase write pattern

**Test scenarios:**
- Happy path: valid username + providers selected → saves + triggers sync → navigates to dashboard
- Error path: invalid Letterboxd username → validation error shown, submit blocked
- Error path: submit with no providers selected → validation prevents submit (match web behavior)
- Error path: sync fails after save → navigate to dashboard anyway (user can refresh manually)
- Edge case: user navigates back to onboarding after completing it → redirected to dashboard immediately

**Verification:**
- After onboarding, dashboard shows synced films
- `users` table in Supabase shows updated `letterboxd_username` and `streaming_subscriptions`

---

- [ ] **Unit 7: Dashboard Screen (Film Grid)**

**Goal:** Show the user's watchlist films filtered to streaming availability, with "new" badges, sort options, and a filter toggle.

**Requirements:** R4

**Dependencies:** Units 2, 4

**Files:**
- Create: `mobile/app/(app)/index.tsx`
- Create: `mobile/components/FilmCard.tsx`
- Create: `mobile/components/ProviderBadge.tsx`

**Approach:**
- Query Supabase directly (no API route): join `user_watchlist`, `films`, `streaming_availability` for the authenticated user; filter `streaming_availability` to `last_seen_at >= now - 30 days` (matches web app stale threshold)
- Load user's `streaming_subscriptions` from `users` table
- Client-side filter: "my services only" toggle (default on if subscriptions exist)
- Client-side sort: newest first (by `first_seen_at`), alphabetical — same logic as `DashboardClient.tsx`
- "New" badge: `first_seen_at` within 14 days (same `NEW_THRESHOLD_DAYS` constant as web)
- `FilmCard.tsx`: poster image (from stored `poster_url`, direct TMDB CDN URL), title, year, provider badges; taps open Letterboxd URL in browser (`Linking.openURL`)
- `ProviderBadge.tsx`: provider logo with TMDB CDN URL
- Pull-to-refresh: calls `syncWatchlist()` + `refreshStreaming()` from `lib/sync.ts` (Unit 8), then re-queries Supabase
- Empty state: matches web app copy

**Patterns to follow:**
- `components/DashboardClient.tsx` for filtering/sorting logic, badge logic, and empty state copy
- `components/FilmCard.tsx` and `components/ProviderBadge.tsx` for data shape

**Test scenarios:**
- Happy path: films with active streaming availability display with provider badges
- Happy path: "New" badge appears on films with `first_seen_at` within 14 days
- Happy path: "My services only" toggle filters to subscribed providers
- Edge case: film on watchlist with no streaming availability → shows film card with no providers (not hidden)
- Edge case: all films filtered out by "my services only" → empty state message
- Edge case: no films at all (empty watchlist) → empty state with prompt to sync
- Integration: pull-to-refresh triggers sync + re-queries Supabase → updated data displayed

**Verification:**
- Dashboard renders films that are in `user_watchlist` and have active `streaming_availability`
- Filter and sort are consistent with web app behavior

---

- [ ] **Unit 8: On-Launch Foreground Sync**

**Goal:** Automatically sync watchlist and streaming data when the app opens, with debouncing to avoid excess API calls.

**Requirements:** R2 (auto-update on launch)

**Dependencies:** Units 2, 3, 6

**Files:**
- Create: `mobile/lib/sync.ts`
- Modify: `mobile/app/(app)/_layout.tsx`

**Approach:**
- `lib/sync.ts`: export `syncAll(jwt: string): Promise<SyncResult>` that calls `POST /api/sync-watchlist` then `POST /api/refresh-streaming` in sequence (refresh-streaming depends on sync having updated the films list). Wrap in try/catch; return `{ ok: boolean, error?: string }`.
- `(app)/_layout.tsx`: after session is confirmed, register `AppState` listener. Track last sync timestamp in a `useRef`. On `'active'` state: if `Date.now() - lastSyncRef.current > 60 * 60 * 1000` (1 hour), call `syncAll(session.access_token)` and update `lastSyncRef.current`. Also sync immediately on first mount.
- Expose sync status (syncing/idle/error) via a context or state lifted into `(app)/_layout.tsx` so the dashboard can show a sync indicator
- Do not block rendering on sync completion — load cached data from Supabase immediately, sync happens in parallel

**Test scenarios:**
- Happy path: app launched fresh → `syncAll` fires → watchlist updated → dashboard reflects changes
- Happy path: app backgrounded and foregrounded within 1 hour → sync does NOT fire (debounced)
- Happy path: app backgrounded and foregrounded after 1 hour → sync fires
- Edge case: sync while onboarding is not complete → `syncAll` should not fire (guard: check that `letterboxd_username` exists before calling)
- Error path: API returns non-200 → `syncResult.ok = false`, error message surfaced in UI, dashboard still loads from Supabase

**Verification:**
- Fresh install: after onboarding, film data appears without user tapping a sync button
- Kill app, wait, reopen — dashboard shows updated streaming data

---

- [ ] **Unit 9: Settings Screen**

**Goal:** Allow user to update their Letterboxd username and streaming subscriptions, and sign out.

**Requirements:** R5

**Dependencies:** Units 2, 4, 6

**Files:**
- Create: `mobile/app/(app)/settings.tsx`

**Approach:**
- Load current `letterboxd_username` and `streaming_subscriptions` from `users` table on mount
- Reuse `ProviderPicker.tsx` (from Unit 6) for subscription management
- Username field + validate button — same validation flow as onboarding
- Save: `supabase.from('users').update(...)` then trigger `syncAll()` if username changed
- Sign out: `supabase.auth.signOut()` → `onAuthStateChange` fires with `SIGNED_OUT` event → `SessionProvider` sets `session = null` → (app) layout's auth guard redirects to sign-in automatically. No manual navigation needed.

**Patterns to follow:**
- `components/SettingsClient.tsx` for data shape and save flow

**Test scenarios:**
- Happy path: username change saved → sync triggered → new watchlist data appears on dashboard
- Happy path: subscription change saved → dashboard filter reflects new subscriptions immediately
- Happy path: sign out → redirected to sign-in, `session = null` confirmed
- Error path: invalid new username → validation error, save blocked
- Integration: sign out clears session from AsyncStorage → cold relaunch shows sign-in (R1 complement: sign-out is permanent)

**Verification:**
- After username change, dashboard reflects the new watchlist
- After sign out and cold relaunch, sign-in screen is shown (not dashboard)

## System-Wide Impact

- **Interaction graph:** The `(app)/_layout.tsx` `AppState` listener and the dashboard's pull-to-refresh both call `syncAll`. Ensure calls are not concurrent — a simple `isSyncing` ref guard is sufficient.
- **Error propagation:** Sync failures must never crash the app or block dashboard rendering. Errors surface as inline status messages; the app always falls back to displaying the last-known Supabase data.
- **API route auth:** The Bearer token change to sync/refresh routes must be tested against the web app to confirm cookie auth is not broken.
- **State lifecycle risks:** On sign-out, `session` becomes `null` mid-render. Guard any `session.access_token` accesses with null checks; the route guard redirect happens asynchronously.
- **Unchanged invariants:** The existing web app's cookie-based auth, all three web API routes (validate-username, cron), the database schema, and the Vercel deployment are unchanged by this work. The only web-side modification is adding Bearer token support to two routes and a new public streaming-providers route.
- **Integration coverage:** The on-launch sync path (AppState → syncAll → Bearer auth → API route → Supabase write → Supabase read) spans multiple layers and should be validated end-to-end on a physical device, not just a simulator.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Bearer token auth change breaks existing web cookie auth | `getUserFromRequest` checks Bearer header first, falls through to cookies if absent. Test cookie path explicitly before ship. |
| Supabase JWT expires mid-session (1 hour default) | `autoRefreshToken: true` + AppState listener handles this automatically. Only risk is if app is backgrounded for exactly the expiry window without the listener firing — acceptable edge case for v1. |
| `streaming_subscriptions` text[] vs number[] type mismatch | Mobile reads with `.map(Number)`, writes with `.map(String)`, matching existing web behavior. Document this as a known inconsistency to fix in a follow-up migration. |
| TMDB rate limits during on-launch sync | Sync calls `/api/refresh-streaming` which does one TMDB call per film. Large watchlists may hit rate limits. The web app already has this exposure; no new risk. |
| Letterboxd HTML structure changes break scraping | Existing risk on web app. Mobile is insulated — scraping stays server-side in the Next.js route. |
| Vercel deployed URL hardcoded in mobile `lib/api.ts` | Use `EXPO_PUBLIC_API_BASE_URL` env var. Set to Vercel URL in production, `http://localhost:3000` in dev. |

## Documentation / Operational Notes

- Add `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_API_BASE_URL` to the project's secret management / env docs
- EAS Build (Expo Application Services) is the recommended path for producing App Store / Play Store builds — set up as a follow-up after the app runs locally on device
- The app `scheme` in `app.json` must be registered with the Supabase project's redirect URLs if OAuth/magic links are added later
- App name placeholder: use `"Watchlist Tracker"` until a final name is chosen; changing `name`, `slug`, and bundle identifier at that point is a 15-minute update

## Sources & References

- Related code: `app/api/sync-watchlist/route.ts`, `app/api/refresh-streaming/route.ts`, `components/DashboardClient.tsx`, `components/OnboardingClient.tsx`, `lib/supabase.ts`
- Supabase React Native Quickstart: https://supabase.com/docs/guides/auth/quickstarts/react-native
- Expo Router docs: https://docs.expo.dev/router/introduction/
- Expo + Supabase guide: https://docs.expo.dev/guides/using-supabase/
- Supabase push notifications with Edge Functions: https://supabase.com/docs/guides/functions/examples/push-notifications

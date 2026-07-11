# Research: Theme Preference Toggle & Dark Mode Polish

**Feature**: 031-theme-toggle-preferences | **Date**: 2026-07-11

## Current-state findings (informing every decision below)

- No theme system exists today: no `ThemeContext`, no class-based dark mode, no `localStorage` usage anywhere in `frontend/src`. Dark mode is 100% OS-driven via Tailwind v4's default `dark:` variant, which follows `prefers-color-scheme` and is not user-overridable.
- `frontend/src/styles/global.css` defines only `--color-primary`, `--font-sans`, and the rating-badge color bands in its `@theme` block — no centralized dark-mode tokens. Every other dark-mode style is an ad hoc `dark:bg-gray-900` / `dark:text-gray-100`-style utility, repeated across ~30+ component files.
- `frontend/src/pages/ProfilePage.tsx` currently has only a header and a "Connected services" section (`DiscogsConnectionCard`); no Preferences/Settings section exists.
- `backend/src/services/userService.ts` defines `UserProfile { uid, displayName, email, photoURL, createdAt, lastSignInAt }`, stored at Firestore `users/{uid}`, read/written via `POST /api/auth/session` and `GET /api/auth/me` (`backend/src/routes/auth.ts`). No preference fields exist yet.
- The codebase's precedent for **isolated** state is `discogsConnections/{uid}` (`backend/src/discogs/oauth/discogsOauthService.ts`) — a separate collection, but that holds sensitive OAuth token material with its own lifecycle, unlike a single scalar preference.
- No toggle/switch component exists in `frontend/src/components/ui/`; the closest pattern is `Checkbox.tsx` (functional component, props interface extending native attrs, `clsx`, inline `dark:` variants).
- No toast/notification system exists; `ProfilePage.tsx` already has a local, one-shot, dismissible `OutcomeMessage` banner pattern (tone: success/warning) for the Discogs OAuth callback outcome.
- `frontend/index.html` is a standard Vite SPA shell (`<div id="root">` + `main.tsx` module script) — nothing currently runs before React mounts.
- `frontend/src/main.tsx` wraps `<App />` in a root `<div>` with `dark:bg-gray-950` already hardcoded, inside `QueryClientProvider` → `BrowserRouter` → `AuthProvider`.

## Decisions

### R1. Manual theme switching mechanism

**Decision**: Add a Tailwind v4 class-based custom dark variant (`@custom-variant dark (&:where(.dark, .dark *));`) to `global.css`, toggled by adding/removing a `dark` class on `<html>`. Pair this with a small synchronous inline bootstrap `<script>` in `index.html` that reads the cached preference from `localStorage` (falling back to `matchMedia('(prefers-color-scheme: dark)')` when unset) and applies the class **before** the SPA mounts.

**Rationale**: Tailwind v4 defaults `dark:` to the `prefers-color-scheme` media query, which a JS toggle cannot override. The class-based custom variant is the documented, supported way to add a manual override in v4 while every existing `dark:` utility class across the app keeps working unchanged — only `global.css` needs to change, not the ~30+ files using `dark:` utilities. The inline bootstrap script is required because React only applies effects after first paint; without it, a returning user with an explicit dark preference would see a flash of the light theme on every load, which the spec's clarification (FR-015/SC-002) explicitly rules out.

**Alternatives considered**:
- Apply the theme class only after React mounts (`useEffect`) — rejected: guarantees a visible flash for any user whose explicit preference differs from the OS default, directly violating FR-015.
- Adopt a library such as `next-themes` — rejected: this is a Vite SPA, not Next.js; the no-flash bootstrap pattern is ~15 lines of vanilla JS, and the constitution favors minimal added dependencies (Principle III).
- Rework theming to pure CSS variables with no `dark:` utilities — rejected: a much larger refactor across the whole app for no benefit over the custom-variant approach.

### R2. Where the preference is persisted

**Decision**: Add `themePreference: 'light' | 'dark' | null` to the existing `users/{uid}` Firestore document (extend `UserProfile` in `backend/src/services/userService.ts`), rather than a new collection.

**Rationale**: It is a single scalar always read/written alongside the rest of the user's profile, which is already fetched on every `/api/auth/me` and `/api/auth/session` call — no new read endpoint is needed. `discogsConnections` is a separate collection because it holds larger, sensitive OAuth-token state with its own lifecycle (created/deleted independently of the user doc); that rationale doesn't apply here. Firestore is schemaless, so adding the field is strictly additive: existing documents without it are naturally interpreted as "no explicit preference" (FR-007), requiring no backfill or migration script — consistent with the constitution's Firebase MINOR-change guidance.

**Alternatives considered**:
- A separate `themePreferences/{uid}` collection mirroring `discogsConnections` — rejected as unnecessary indirection for one field with no independent lifecycle.
- Client-only storage (never synced to Firebase) — rejected outright: contradicts the explicit requirement (FR-005/FR-006) and the user's request.

### R3. Local paint-ahead cache (FR-015)

**Decision**: Cache the last resolved theme in `localStorage` under a single namespaced key (`vinylmania:theme-preference`, value `'light' | 'dark'`). Write it whenever the user toggles and whenever the Firestore-sourced value is loaded. Treat it as purely advisory: on any divergence, the Firestore value overwrites the local cache, never the reverse.

**Rationale**: `localStorage` is synchronous and readable by the inline bootstrap script before any framework code runs, which is what makes instant, flash-free painting possible. Making Firestore always win on divergence satisfies the multi-device edge case in the spec ("the next time each of them loads or reconnects, they reflect the latest saved preference") without needing any real-time sync mechanism.

**Alternatives considered**:
- A cookie — rejected: no server-side rendering exists to benefit from a cookie being sent with the request; pure added complexity.
- IndexedDB — rejected: overkill for one string value, and not synchronously readable from a blocking inline script (async API), which would reintroduce the flash.

### R4. Save-failure notification (FR-011)

**Decision**: Reuse the existing one-shot, dismissible, toned message-banner pattern already implemented locally in `ProfilePage.tsx` (`OutcomeMessage`) — generalized slightly so the Preferences section can show a `warning`-toned banner when a preference save ultimately fails after retries — instead of building an app-wide toast/notification system.

**Rationale**: No toast system exists anywhere in the codebase today. Building one is disproportionate to a single, low-frequency, non-blocking notice, and would violate the Simplicity/YAGNI principle (III). The existing banner pattern already covers everything this needs: dismissible, toned, non-blocking.

**Alternatives considered**: A global toast/snackbar library or new app-wide toast context — rejected as new infrastructure out of proportion to this one usage; worth reconsidering only if a second, unrelated feature independently needs the same capability (noted under Suggested Enhancements in `spec.md`, out of scope here).

### R4a. Retry policy for preference saves (FR-010/FR-011)

**Decision**: On save failure, retry up to 3 times with exponential backoff (1s, 2s, 4s). If all 3 retries fail, the save is considered "ultimately failed" and FR-011's non-blocking notification fires.

**Rationale**: Bounds the "reasonable attempt" language in FR-010 to a concrete, testable number; 3 attempts with short exponential backoff is enough to ride out a transient network blip without leaving the user waiting long before being told persistence may have failed.

**Alternatives considered**: Indefinite retries — rejected, could retry silently forever with no user feedback, contradicting FR-011. A single retry — rejected as too eager to give up on a flaky connection.

### R5. Dark-mode palette darkening (FR-013/FR-014)

**Decision**: Systematically shift the existing ad hoc `dark:` neutral gray-scale utility usages one step deeper on Tailwind's built-in gray scale (e.g., page/section backgrounds `gray-950` stays the darkest anchor already used in `main.tsx`, but component-level `dark:bg-gray-900` surfaces shift to `dark:bg-gray-950`/`dark:bg-gray-900` as appropriate per element, borders `dark:border-gray-800` → `dark:border-gray-900`, etc.), re-verifying WCAG 2.1 AA text contrast for every adjusted surface/text pairing. No new `@theme` color tokens are introduced.

**Rationale**: The current dark palette is defined ad hoc per-component using Tailwind's stock gray scale, not centralized `@theme` tokens (confirmed in `global.css` and across components) — a mechanical one-step darkening preserves that existing convention and satisfies FR-013/SC-004 without a large, risky refactor to a new token system (Simplicity/YAGNI, Principle III). The darker steps used (`gray-950`, `gray-900`, etc.) are already part of Tailwind v4's default palette, so nothing here is "outside the default scale" per the constitution's styling rules (no new `@theme` justification needed).

**Alternatives considered**: Introducing dedicated `--color-dark-bg` / `--color-dark-surface` tokens in `@theme` — deferred; a larger, riskier refactor across every `dark:` usage than this increment's scope warrants. Worth revisiting if/when finer-grained control beyond the built-in gray steps is needed.

### R6. Toggle artwork implementation

**Decision**: Implement the sun/blue-sky/clouds and moon/night-sky/stars artwork as inline SVG inside a new `ThemeToggle` component (`frontend/src/components/ui/`) — no external image assets, no icon-library dependency.

**Rationale**: Keeps the control self-contained and stylable with Tailwind classes, avoids a new dependency or network asset request (constitution favors minimal dependencies), and matches the app's existing pattern of hand-rolled UI in `components/ui`.

**Alternatives considered**: An icon library (e.g., `lucide-react`) — rejected: adds a new dependency for two bespoke, detailed illustrations (sky, clouds, stars) that a generic icon library's sun/moon glyphs wouldn't fully satisfy per the spec's design description.

## Summary of technology choices

| Concern | Choice |
|---|---|
| Theme application | Class-based Tailwind v4 custom `dark` variant on `<html>` + inline no-flash bootstrap script |
| Preference storage (source of truth) | New `themePreference` field on existing `users/{uid}` Firestore document |
| Preference read | Extend existing `GET /api/auth/me` / `POST /api/auth/session` responses (no new read endpoint) |
| Preference write | New `PATCH /api/auth/preferences` endpoint (see `contracts/theme-preference-api.md`) |
| Save retry policy | Up to 3 attempts, exponential backoff (1s/2s/4s), then surface failure (R4a) |
| Instant-paint cache | `localStorage` key `vinylmania:theme-preference`, advisory only |
| Save-failure UX | Reused/generalized `OutcomeMessage`-style banner on Profile page |
| Dark palette darkening | One-step-deeper Tailwind built-in gray scale, no new `@theme` tokens |
| Toggle artwork | Inline SVG, no new dependency |

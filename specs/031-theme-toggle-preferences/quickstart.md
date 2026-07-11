# Quickstart: Validating the Theme Preference Toggle & Dark Mode Polish

**Feature**: 031-theme-toggle-preferences

How to prove the feature works end-to-end. Contracts: [contracts/theme-preference-api.md](./contracts/theme-preference-api.md) · Data model: [data-model.md](./data-model.md).

## Prerequisites

- Node.js + repo dependencies installed (`npm install` in `backend/`, `frontend/`, `e2e/`).
- Firebase emulators available for backend tests (`firebase emulators:exec --only auth,firestore`, wired into `backend`'s existing `npm test` script).
- A signed-in test account (fake Google sign-in via the emulator, per existing e2e conventions) to reach the Profile page.

## 1. Automated backend tests (unit + contract)

```bash
cd backend && npm test
```

Runs Jest inside the Firebase emulators. Expected: all suites green, including new ones —

- `tests/unit/userService.test.ts` (extended) — `themePreference` read/write on `users/{uid}`, absent-field defaults to no preference.
- `tests/contract/authPreferencesRoute.test.ts` — `PATCH /api/auth/preferences` against [the contract](./contracts/theme-preference-api.md): 200 on valid value, 400 on invalid/missing value, 401 without a bearer token, value round-trips through a subsequent `GET /api/auth/me`, no other profile field is altered.

## 2. Automated frontend tests

```bash
cd frontend && npm test
```

Expected green:

- `ThemeToggle` component: renders sun/light and moon/dark artwork per state, is keyboard-operable (Enter/Space activates it), exposes an accessible name/state (role/aria-checked or equivalent) for screen readers (FR-009/SC-005).
- `ThemeProvider`/`useThemePreference`: resolves to OS preference when no stored value exists (FR-007); applies an explicit value over the OS setting (FR-008); reconciles a locally cached value with a Firestore-sourced value, Firestore winning on conflict (research.md R3).
- Profile page: renders a "Preferences" section with the toggle as its first control (FR-001); on a simulated save failure (mocked rejected mutation), shows the non-blocking warning banner (FR-011) without blocking further toggling.

## 3. End-to-end (Playwright)

```bash
cd e2e && npm test
```

Expected passing scenarios in `tests/theme-preference.spec.ts`:

1. **Toggle switches the whole app**: sign in → Profile → Preferences section → activate the toggle → every visible surface (header, cards, page background) reflects the new theme immediately, and the toggle's artwork matches (sun/blue-sky/clouds for light, moon/night-sky/stars for dark).
2. **Persistence across reload**: set dark mode → reload the page → app opens directly in dark mode, no flash of light mode first (inspect via a Playwright trace/screenshot at first paint) — validates FR-006/FR-015/SC-002.
3. **Persistence across a fresh session**: set a preference → sign out → sign back in (or open a new browser context with the same emulator user) → the same preference is applied automatically — validates FR-006/SC-002 "any device" framing at the level this test harness can simulate.
4. **Default fallback for a brand-new user**: a user with no stored preference sees the OS-simulated (`prefers-color-scheme`) theme, and toggling then persists an explicit choice — validates FR-007/FR-008.
5. **Save-failure notification**: simulate a backend failure for `PATCH /api/auth/preferences` (route interception) → toggling still changes the visible theme immediately, and a dismissible warning notice appears → validates FR-010/FR-011/SC-007.

## 4. Manual smoke test (dark-mode polish, visual)

1. Start the app locally: `cd backend && npm run dev` and `cd frontend && npm run dev`.
2. Sign in → enable dark mode via the new toggle.
3. Visit the dashboard, a search results page, a record detail page, and the profile page itself.
4. Confirm backgrounds/surfaces read as visibly darker than before this change, text and interactive elements remain clearly legible, and cards/badges stay visually distinguishable from their surrounding surface (FR-013/FR-014/SC-004) — spot-check a few text/background pairs with a contrast checker for WCAG 2.1 AA (≥4.5:1 for normal text).
5. Toggle back to light mode and confirm no light-mode regressions (unaffected by the darkening pass).

## 5. Success criteria spot-checks

| Criterion | How to verify here |
|---|---|
| SC-001 (single-interaction, instant switch) | E2E scenario 1 |
| SC-002 (100% correct preference on reload/any device, no flash) | E2E scenarios 2–3 |
| SC-003 (preference never silently reset) | Backend contract test (preferences-only write leaves other fields untouched) + E2E scenario 3 |
| SC-004 (WCAG 2.1 AA in dark mode) | Manual smoke test step 4 |
| SC-005 (keyboard/screen-reader operable toggle) | Frontend component test for `ThemeToggle` |
| SC-006 (toggle self-explanatory from artwork) | Manual smoke test observation (informal, no automated check) |
| SC-007 (visible notice on persistent save failure) | E2E scenario 5 |

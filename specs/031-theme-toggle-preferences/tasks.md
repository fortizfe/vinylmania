# Tasks: Theme Preference Toggle & Dark Mode Polish

**Input**: Design documents from `/specs/031-theme-toggle-preferences/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/theme-preference-api.md, quickstart.md

**Tests**: INCLUDED — the constitution's Test-First principle is NON-NEGOTIABLE. Every test task MUST be written and observed failing before its corresponding implementation task begins.

**Organization**: Tasks are grouped by user story. US2 builds directly on US1 (there is nothing to persist until the toggle exists); US3 (dark-mode darkening) is independently testable via the existing OS-level `prefers-color-scheme` behavior and has no technical dependency on US1/US2, so it can proceed in parallel with either.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 = switch theme from profile page, US2 = preference persists across sessions/devices, US3 = darker dark-mode palette

## Path Conventions

Web app per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `e2e/`.

---

## Phase 1: Setup

**Purpose**: One-time project-level config enabling manual (class-based) dark mode alongside today's OS-driven behavior. No new npm dependencies are required (research.md R1/R4/R6).

- [X] T001 Add `@custom-variant dark (&:where(.dark, .dark *));` to `frontend/src/styles/global.css` immediately after the `@import "tailwindcss";` line, so every existing `dark:` utility class across the app responds to a `dark` class on `<html>` instead of only `prefers-color-scheme` (research.md R1)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared test infrastructure used by more than one story's e2e coverage.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Create `e2e/helpers/theme.ts` exporting `getActiveTheme(page): Promise<'light' | 'dark'>` (reads `document.documentElement.classList.contains('dark')`), for reuse by the US1 and US2 e2e specs

**Checkpoint**: Shared e2e helper available — user story implementation can begin.

---

## Phase 3: User Story 1 - Switch theme from the profile page (Priority: P1) 🎯 MVP

**Goal**: A signed-in user finds a "Preferences" section on the Profile page whose first control is a sun/moon toggle; activating it switches the entire app's theme instantly, within the current session (no cross-session persistence yet — that is US2).

**Independent Test**: quickstart.md §2–3 scenario 1 — open Profile, see the Preferences section with the toggle as its first control, activate it, and confirm every visible surface (header, cards, background) switches theme immediately with matching sun/moon artwork.

### Tests for User Story 1 (write first, observe failing) ⚠️

- [X] T003 [P] [US1] Write failing component tests in `frontend/src/components/ui/ThemeToggle.test.tsx`: renders the sun/blue-sky/clouds artwork when `theme="light"` and the moon/night-sky/stars artwork when `theme="dark"`; clicking invokes the provided toggle handler; Enter/Space keyboard activation works; exposes `role="switch"` + `aria-checked` reflecting the current state (FR-003, FR-009)
- [X] T004 [P] [US1] Write failing unit tests in `frontend/src/theme/ThemeContext.test.tsx`: with no explicit preference, `useTheme()` resolves to the result of `matchMedia('(prefers-color-scheme: dark)')` (FR-007); calling `setTheme('dark')` applies the `dark` class to `document.documentElement` and updates the context value; calling it again with `'light'` removes the class; after an explicit `setTheme` call, simulating a `matchMedia` change event (OS switches to the opposite scheme) does NOT change the resolved `theme` value — the explicit choice keeps precedence (FR-008)
- [X] T005 [P] [US1] Write failing component test in `frontend/src/pages/ProfilePage.test.tsx`: a `<section aria-label="Preferences">` is rendered and its first child is the theme toggle (FR-001, FR-002)

### Implementation for User Story 1

- [X] T006 [US1] Implement `frontend/src/theme/ThemeContext.tsx`: `ThemeProvider` holding in-memory resolved theme state (OS `matchMedia` fallback per FR-007, listens for OS changes only while no explicit preference is set per FR-008), applies/removes the `dark` class on `document.documentElement` on every change, and a `useTheme()` hook exposing `{ theme, setTheme }` — make T004 pass
- [X] T007 [US1] Implement `frontend/src/components/ui/ThemeToggle.tsx`: inline SVG sun/blue-sky/clouds and moon/night-sky/stars artwork (research.md R6), `role="switch"` + `aria-checked` + keyboard activation, Tailwind transition utilities, consumes `useTheme()` — make T003 pass
- [X] T008 [US1] Add the `<section aria-label="Preferences">` to `frontend/src/pages/ProfilePage.tsx` hosting `ThemeToggle` as its first control, placed above or below the existing "Connected services" section — make T005 pass
- [X] T009 [US1] Wrap the existing `<AuthProvider>...</AuthProvider>` tree in a new outer `<ThemeProvider>` in `frontend/src/main.tsx` (theme must resolve even before auth loads, per spec Assumptions)
- [X] T010 [US1] Write and run the e2e "toggle switches the whole app" scenario in `e2e/tests/theme-preference.spec.ts` (quickstart.md scenario 1), using the `getActiveTheme` helper from T002 to assert header/cards/background all reflect the new theme and the toggle artwork matches; run it green

**Checkpoint**: User Story 1 is fully functional and independently testable (session-only toggle; resets on reload until US2 lands).

---

## Phase 4: User Story 2 - Theme preference follows the user across sessions and devices (Priority: P2)

**Goal**: The chosen theme is persisted to the signed-in user's account in Firebase, applied automatically (with no visible flash) on any subsequent load or device, falls back to the OS setting until an explicit choice exists, and shows a non-blocking notice if saving ultimately fails.

**Independent Test**: quickstart.md e2e scenarios 2–5 — reload persistence with no flash, persistence across a fresh session, default OS fallback for a brand-new user, and a visible notice on a simulated persistent save failure.

### Tests for User Story 2 (write first, observe failing) ⚠️

- [X] T011 [P] [US2] Write failing unit tests in `backend/tests/unit/userService.test.ts`: `updateThemePreference(uid, 'dark')` writes only the `themePreference` field and returns the updated profile; `getUser`/`getOrCreateUser` omit the field entirely (not `null`) when it was never set, per data-model.md; and `getOrCreateUser` for a user with an existing `themePreference` (simulating a normal sign-in that refreshes `lastSignInAt`) leaves that field unchanged (FR-012)
- [X] T012 [P] [US2] Write failing contract tests in `backend/tests/contract/authPreferencesRoute.test.ts` per contracts/theme-preference-api.md: `PATCH /api/auth/preferences` returns 200 for a valid value and the value round-trips through a subsequent `GET /api/auth/me`; 400 on a missing/invalid value; 401 without a bearer token; a preferences-only write leaves every other `UserProfile` field untouched
- [X] T013 [P] [US2] Write failing unit tests in `frontend/src/theme/useThemePreference.test.ts`: with no `localStorage` cache and no signed-in user, resolves via `matchMedia`; with a cached value present, resolves instantly from `localStorage` before the account's Firestore-backed value arrives; once the account's `themePreference` loads, a divergent local cache is overwritten by the Firestore value (research.md R3); toggling calls the save mutation with a retry policy of up to 3 attempts with exponential backoff (research.md R4a), and on persistent failure (after all retries are exhausted) exposes a failure flag while keeping the local theme change applied (FR-010); firing `setTheme('dark')` then `setTheme('light')` in quick succession results in only `'light'` ever being sent to the save mutation and reflected in the resolved theme (no lost update, no flicker)
- [X] T014 [P] [US2] Write failing component test in `frontend/src/pages/ProfilePage.test.tsx`: when the preference save is in a persistent-failure state, a dismissible warning banner is shown and the toggle remains fully interactive (FR-011)

### Implementation for User Story 2

- [X] T015 [US2] Extend `UserProfile` in `backend/src/services/userService.ts` with optional `themePreference?: 'light' | 'dark'` and add `updateThemePreference(uid, value)` (Firestore `update` touching only that field) — make T011 pass
- [X] T016 [US2] Add `PATCH /preferences` to `backend/src/routes/auth.ts`: `requireAuth`, zod-validated `{ themePreference: 'light' | 'dark' }` body, structured `preference_saved` / `preference_save_failed` logs matching the existing `{ route, outcome, uid, message }` shape, per contracts/theme-preference-api.md — make T012 pass
- [X] T017 [P] [US2] Implement `frontend/src/services/themePreferenceApi.ts`: `authorizedFetch`-style wrapper calling `PATCH /api/auth/preferences`
- [X] T018 [US2] Implement `frontend/src/theme/useThemePreference.ts`: reads/writes the `localStorage['vinylmania:theme-preference']` paint-ahead cache, reads `themePreference` from the signed-in user (extend `UserProfile` in `frontend/src/auth/AuthContext.tsx` with the optional field), reconciles per research.md R3 (Firestore always wins on divergence), and exposes a save with up to 3 retry attempts (exponential backoff, research.md R4a) + persistent-failure flag once exhausted — make T013 pass
- [X] T019 [US2] Implement `frontend/src/queries/themePreferenceQueries.ts`: `useSetThemePreference` TanStack Query mutation wrapping `themePreferenceApi`, retry policy of up to 3 attempts with exponential backoff (1s, 2s, 4s) per research.md R4a, updates the cached `AuthContext` user on success
- [X] T019a [US2] Add rapid-toggle sequencing to `frontend/src/theme/useThemePreference.ts`: if a new `setTheme` call arrives while a save is still in flight or retrying, the earlier save's eventual result MUST NOT override the later value in state, and only the latest value is ever sent to Firestore (e.g., a monotonically increasing request token or `AbortController` per save) — make the rapid-toggle case in T013 pass
- [X] T020 [US2] Wire `ThemeProvider` (`frontend/src/theme/ThemeContext.tsx`) to source its resolved value from `useThemePreference` instead of pure in-memory state, and add an inline no-flash bootstrap `<script>` to `frontend/index.html` that reads `localStorage['vinylmania:theme-preference']` (falling back to `matchMedia`) and sets the `dark` class on `<html>` before the SPA mounts (research.md R1, FR-015)
- [X] T021 [US2] Generalize the existing `OutcomeMessage` pattern in `frontend/src/pages/ProfilePage.tsx` into a reusable warning banner wired to `useThemePreference`'s persistent-failure state (FR-011) — make T014 pass
- [X] T022 [US2] Extend `e2e/tests/theme-preference.spec.ts` with: persistence-across-reload with no visible flash (scenario 2, using T002's helper at first paint), persistence across a fresh session (scenario 3), default OS fallback for a brand-new user (scenario 4), and save-failure notification via route interception (scenario 5); run green

**Checkpoint**: User Stories 1 and 2 both work independently; the full toggle-and-persist lifecycle is covered.

---

## Phase 5: User Story 3 - More legible, deliberately darker dark mode (Priority: P3)

**Goal**: Dark-mode backgrounds, surfaces, and borders across the app's major screens read as deliberately darker and more consistent than today, while text and interactive elements keep WCAG 2.1 AA contrast.

**Independent Test**: quickstart.md §4 manual smoke test, plus an automated contrast check across the dashboard, search results, record/release detail, and profile pages while dark mode is active (verifiable today via the existing OS-level `prefers-color-scheme` behavior — no dependency on US1/US2).

### Tests for User Story 3 (write first, observe failing) ⚠️

- [X] T023 [P] [US3] Add `e2e/helpers/contrast.ts` (`getContrastRatio(fgRgb, bgRgb): number`, WCAG relative-luminance formula) and write a failing e2e test in `e2e/tests/dark-mode-contrast.spec.ts` asserting ≥4.5:1 contrast for the primary text/background pairing on the dashboard, search results, a record/release detail page, and the profile page with dark mode enabled (SC-004)

### Implementation for User Story 3

- [X] T024 [P] [US3] Darken dark-mode neutral utility classes one step deeper (research.md R5) in the shared UI atoms: `frontend/src/components/ui/Avatar.tsx`, `BackLink.tsx`, `Badge.tsx`, `Button.tsx`, `Card.tsx`, `Checkbox.tsx`, `InlineEditableField.tsx`, `Input.tsx`, `Skeleton.tsx`
- [X] T025 [P] [US3] Darken dark-mode neutral utility classes in the app shell and landing surfaces: `frontend/src/components/AppHeader.tsx`, `LandingHero.tsx`, `UnderConstruction.tsx`, `LibraryLinkRequired.tsx`
- [X] T026 [P] [US3] Darken dark-mode neutral utility classes in the dashboard and news feed: `frontend/src/pages/DashboardPage.tsx`, `frontend/src/components/FeedArticleCard.tsx`, `FeedCarousel.tsx`, `FeedCategoryFilterBar.tsx`
- [X] T027 [P] [US3] Darken dark-mode neutral utility classes in search and library listing: `frontend/src/pages/SearchResultsPage.tsx`, `frontend/src/pages/LibraryListPage.tsx`, `frontend/src/components/SearchResultCard.tsx`, `RecordCard.tsx`, `filters/FormatFilter.tsx`
- [X] T028 [P] [US3] Darken dark-mode neutral utility classes in record/release/master detail views: `frontend/src/pages/RecordDetailPage.tsx`, `ReleaseDetailPage.tsx`, `MasterReleaseDetailPage.tsx`, `frontend/src/components/MasterReleaseDetailsSection.tsx`, `MasterVersionsTable.tsx`, `MyCopySection.tsx`, `ReleaseAdditionalInfoSection.tsx`, `ReleaseDetailsSection.tsx`, `ReleaseImageGallery.tsx`, `ReleaseTracklistSection.tsx`
- [X] T029 [P] [US3] Darken dark-mode neutral utility classes on the profile page and its cards: `frontend/src/pages/ProfilePage.tsx`, `frontend/src/components/DiscogsConnectionCard.tsx`
- [X] T030 [US3] Re-run a repo-wide grep for remaining `dark:bg-gray-*`/`dark:border-gray-*`/`dark:text-gray-*` usages in `frontend/src` not covered by T024–T029 and adjust them per research.md R5; then run T023's contrast test green and perform the quickstart.md §4 manual visual spot-check

**Checkpoint**: All three user stories are independently functional; dark mode is darker and verified accessible.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Constitution workflow gates and final validation.

- [X] T031 [P] Add a dated `0.12.0` `Added` entry to `backend/CHANGELOG.md` and bump `version` to `0.12.0` in `backend/package.json` (MINOR: new `PATCH /api/auth/preferences` endpoint + additive `themePreference` field, per plan.md)
- [X] T032 [P] Add a dated `0.18.0` `Added` entry to `frontend/CHANGELOG.md` and bump `version` to `0.18.0` in `frontend/package.json` (MINOR: new theme toggle, Preferences section, and dark-mode palette update)
- [X] T033 Run the full automated validation from quickstart.md §1–3 (`cd backend && npm test`, `cd frontend && npm test`, `cd e2e && npm test`) and fix anything red
- [X] T034 Perform the full manual smoke test per quickstart.md §4: toggle in the Profile Preferences section, reload/sign-out/sign-in-again persistence, and a final visual pass over dark mode across all major screens

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: after Setup. **Blocks US1 and US2's e2e coverage** (US3's contrast helper is self-contained in T023, not shared)
- **US1 (Phase 3)**: after Phase 2. Within: T003/T004/T005 (failing tests) before T006–T009; T010 last
- **US2 (Phase 4)**: after US1 (nothing to persist until the toggle/context exist). Within: T011–T014 (failing tests) before T015–T021; T019a after T019 (extends the save mutation with sequencing); T022 last
- **US3 (Phase 5)**: independent of US1/US2 — may start any time after Setup (Phase 1); listed after US2 here only to match spec priority order. Within: T023 before T024–T029; T030 last
- **Polish (Phase 6)**: after all desired stories; T031/T032 in parallel; T033 → T034

### User Story Dependencies

- **US1 (P1)**: only Foundational — the MVP (session-only toggle)
- **US2 (P2)**: builds on US1's `ThemeContext`/`ThemeToggle`, still independently testable (its own quickstart scenarios)
- **US3 (P3)**: no dependency on US1/US2 — can run fully in parallel with either once Setup (Phase 1) is done

### Parallel Opportunities

- US1: T003 ∥ T004 ∥ T005 (different test files); T006 → T007 → T008 chain is sequential (context before toggle before section), T009 can follow T006 in parallel with T007/T008
- US2: T011 ∥ T012 ∥ T013 ∥ T014 (different test files); T017 can run parallel to T015/T016 (different files); T018–T021 are mostly sequential (build on T015–T017)
- US3: T024–T029 are fully parallel (disjoint file sets); T023 and T030 are sequential bookends
- US2 and US3 can be worked on in parallel by different developers once US1 is done (disjoint files, except both eventually touch `ProfilePage.tsx` — coordinate or serialize T021 and T029)
- Polish: T031 ∥ T032

## Parallel Example: User Story 1

```bash
# Launch all US1 failing tests together:
Task: "T003 component tests in frontend/src/components/ui/ThemeToggle.test.tsx"
Task: "T004 unit tests in frontend/src/theme/ThemeContext.test.tsx"
Task: "T005 component test in frontend/src/pages/ProfilePage.test.tsx"

# Then implement:
Task: "T006 ThemeContext + T007 ThemeToggle + T008 Preferences section (sequential chain)"
Task: "T009 wrap main.tsx in ThemeProvider (parallel to T007/T008 once T006 lands)"
```

## Parallel Example: User Story 3

```bash
# After T023 (contrast helper + failing test), launch all darkening tasks together:
Task: "T024 shared UI atoms (components/ui/*)"
Task: "T025 app shell & landing"
Task: "T026 dashboard & news feed"
Task: "T027 search & library listing"
Task: "T028 record/release/master detail"
Task: "T029 profile page & Discogs card"
```

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 → Phase 2 → Phase 3 (US1)
2. **STOP and VALIDATE**: e2e scenario 1 green (T010), quickstart.md scenario 1
3. Deployable increment: users can toggle the theme for the current session (resets on reload until US2 ships)

### Incremental Delivery

1. Setup + Foundational → shared e2e helper ready
2. US1 → MVP: working, session-scoped toggle with the sun/moon design
3. US2 → full persistence lifecycle: Firebase-backed, no-flash reload, OS fallback, failure notice
4. US3 → darker, WCAG-verified dark mode across the app (can ship independently/in parallel with US2)
5. Polish → changelogs, version bumps, full automated + manual validation

## Notes

- Verify each test task FAILS before starting its paired implementation task (constitution Principle I)
- Commit after each task or logical group using Conventional Commits (`feat(theme): ...`, `test(theme): ...`)
- T021 (US2) and T029 (US3) both edit `frontend/src/pages/ProfilePage.tsx` — do not run them concurrently
- No new runtime dependencies are introduced anywhere in this task list (research.md R1/R4/R6)
- Retry policy for preference saves is fixed at 3 attempts with exponential backoff (1s/2s/4s) per research.md R4a — T013/T018/T019 tests and implementation MUST use this exact bound, not an arbitrary one

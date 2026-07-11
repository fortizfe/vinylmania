---

description: "Task list for Adopt New Vinylmania Logo Branding"

---

# Tasks: Adopt New Vinylmania Logo Branding

**Input**: Design documents from `/specs/034-logo-rebranding/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED — this project's constitution (Principle I, Test-First, NON-NEGOTIABLE) mandates a failing test before implementation for every change; plan.md's Constitution Check reaffirms this for this feature.

**Organization**: Tasks are grouped by user story (P1/P2/P3 from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and relative to the repository root

## Path Conventions

Frontend-only feature (no backend changes): `frontend/src/`, `frontend/tests/`, `e2e/tests/`.

---

## Phase 1: Setup

**Purpose**: Add the shared configuration every wordmark placement needs (font token + Google Fonts link) before any brand-mark component is built.

- [X] T001 [P] Add `--font-display: 'Anton', sans-serif;` and `--color-brand-icon-dark-bg: #1a1a22;` to the `@theme` block in `frontend/src/styles/global.css` (research.md §4, §6)
- [X] T002 [P] Add a Google Fonts preconnect (`fonts.googleapis.com`, `fonts.gstatic.com`) and an "Anton" stylesheet `<link>` (with `display=swap`) to the `<head>` of `frontend/index.html` (research.md §6; spec FR-010)

**Checkpoint**: `font-display` and the new color token are available; "Anton" is loading with `font-display: swap`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A for this feature — the only genuinely shared building blocks (`VinylmaniaIcon`, `VinylmaniaWordmark`, `VinylmaniaGrungeFilter`) are needed by User Story 1 and User Story 2, but not User Story 3 (the favicon is a fully independent static asset). Per task-organization rules, they are built as part of User Story 1 (P1, the earliest story that needs them) below, rather than a separate phase that would misleadingly imply all three stories depend on it.

**Checkpoint**: Proceed directly to Phase 3.

---

## Phase 3: User Story 1 - Recognize the new brand mark in the app header (Priority: P1) 🎯 MVP

**Goal**: Replace the authenticated app header's plain-text "Vinylmania" label with the new brand mark — icon-only below the `md:` breakpoint (28px), icon+wordmark lockup at `md:`+ (36px icon / 20px wordmark, fixed at every wider desktop width), correctly themed light/dark, still linking to `/app`.

**Independent Test**: Sign in, view any app page at a desktop width and a mobile width, in both light and dark theme, and confirm the header shows the new icon (mobile) or icon+wordmark lockup (desktop) rather than plain text, and still navigates to `/app` when clicked.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T003 [P] [US1] New component test `frontend/tests/components/brand/VinylmaniaIcon.test.tsx`: renders at the given `size`, applies `dark:`-variant fill classes on the outer and center circles (`fill-landing-surface dark:fill-brand-icon-dark-bg`, `fill-landing-accent dark:fill-primary`), and is `aria-hidden="true"`/non-focusable (research.md §2, §5)
- [X] T004 [P] [US1] New component test `frontend/tests/components/brand/VinylmaniaWordmark.test.tsx`: renders the text "VINYLMANIA" in the `font-display` class; applies `style={{ filter: 'url(#vm-wordmark-grunge)' }}` only when `grunge` is `true`; omits the filter style when `grunge` is `false`/absent (research.md §3; spec FR-012)
- [X] T005 [P] [US1] New component test `frontend/tests/components/brand/VinylmaniaGrungeFilter.test.tsx`: renders exactly one `<filter id="vm-wordmark-grunge">` element, visually hidden (research.md §3)
- [X] T006 [P] [US1] Extend `frontend/tests/unit/AppHeader.test.tsx`: the brand `Link` carries `aria-label="Vinylmania"`, `min-h-11 min-w-11` (44×44 CSS px touch target, constitution v2.2.0), and still navigates to `/app`; it always renders `VinylmaniaIcon`; the wordmark is hidden below `md:` and visible at `md:`+ (same breakpoint `HeaderNavIcons`/the hamburger already switch at — research.md §8); icon/wordmark render at their fixed sizes; the brand-mark container's height comes from a fixed icon-anchored class (e.g. `h-9`), not a font-dependent class, so a font swap can't reflow it (FR-010, research.md §6) (spec FR-001, FR-005, FR-006, FR-010, FR-011)

### Implementation for User Story 1

- [X] T007 [US1] Create `frontend/src/components/brand/VinylmaniaGrungeFilter.tsx`: a visually-hidden SVG containing one `<filter id="vm-wordmark-grunge">` (`feTurbulence` + `feDisplacementMap`, matching the brief's `#grungeF`) (research.md §3; depends on T005 failing first)
- [X] T008 [US1] Create `frontend/src/components/brand/VinylmaniaIcon.tsx`: hand-authored inline SVG (200×200 viewBox) matching the brief's `vm-icon`/`vm-icon-dark-bg` geometry, `size` prop, `dark:`-variant fill classes reusing `landing-surface`/`landing-accent`/`primary`/`brand-icon-dark-bg` tokens, `aria-hidden="true" focusable="false"` (research.md §1, §2, §4; depends on T003 failing first)
- [X] T009 [US1] Create `frontend/src/components/brand/VinylmaniaWordmark.tsx`: renders "VINYLMANIA" in `font-display`, `grunge?: boolean` prop (default `false`) applying `style={{ filter: 'url(#vm-wordmark-grunge)' }}` when true (research.md §3; depends on T004 failing first, T007)
- [X] T010 [US1] Mount `<VinylmaniaGrungeFilter />` once at the app root in `frontend/src/App.tsx`, alongside the existing `<Routes>` (research.md §3; depends on T007)
- [X] T011 [US1] Update `frontend/src/components/AppHeader.tsx`: brand `Link` gets `aria-label="Vinylmania"` and `min-h-11 min-w-11` (plus `flex items-center` so the icon/wordmark stay centered within the enlarged hit area) to meet the constitution's 44×44 CSS px mobile touch-target rule — the 28px icon alone is not enough; renders `VinylmaniaIcon` at 28px below `md:` / 36px at `md:`+ (responsive `className`, no JS branch) always visible, in a wrapper whose height is set by the icon's own size classes (not the wordmark), plus `VinylmaniaWordmark` (`grunge={false}`) hidden below `md:` / visible at `md:`+, replacing the current plain-text label (research.md §6, §8; spec FR-001, FR-005, FR-006, FR-010, FR-011, FR-012; depends on T006 failing first, T008, T009)

**Checkpoint**: User Story 1 is fully functional and independently testable — the authenticated header shows the new brand mark, correctly responsive and themed, still linking to `/app`.

---

## Phase 4: User Story 2 - See the new brand mark on the landing page (Priority: P2)

**Goal**: Replace the landing page's sticky header and hero plain-text "Vinylmania" with the new brand mark — header lockup (36px icon / 20px wordmark, non-grunge) in the sticky header, and the larger stacked "general logo" (~120px icon + grunge wordmark) in the hero.

**Independent Test**: Visit the landing page signed out, at desktop and mobile widths and in both themes, and confirm the sticky header and hero both show the new brand mark instead of plain text.

### Tests for User Story 2 ⚠️

- [X] T012 [P] [US2] Extend `frontend/tests/components/LandingHeader.test.tsx`: the brand area renders a `VinylmaniaIcon` (36px) and a `VinylmaniaWordmark` with `grunge={false}`, replacing the current plain `<span>`; the existing "renders no navigation or anchor links" assertion still passes (the brand mark stays non-interactive here, unlike the app header); the brand area and the `GoogleSignInButton` both use classes that allow shrinking/wrapping (e.g. `min-w-0`/`truncate` on the brand area, matching the existing `truncate` already on the label) rather than fixed widths that could force an overflow at narrow container widths (spec FR-002, FR-008, FR-011, FR-012)
- [X] T013 [P] [US2] Extend `frontend/tests/components/LandingHero.test.tsx`: the existing `heading.textContent` assertion (matches `/vinyl/i`) keeps passing using the visible "VINYLMANIA" wordmark text alone — no extra hidden text node needed, since the icon stays `aria-hidden` and the wordmark is real DOM text (research.md §5); renders a `VinylmaniaIcon` (~120px) and a `VinylmaniaWordmark` with `grunge={true}` in a stacked (icon above wordmark) arrangement, per the brief's "general logo" layout (spec FR-002, FR-007, FR-009, FR-012)

### Implementation for User Story 2

- [X] T014 [US2] Update `frontend/src/components/LandingHeader.tsx`: replace the plain `<span>Vinylmania</span>` with `VinylmaniaIcon` (36px) + `VinylmaniaWordmark` (`grunge={false}`) side-by-side, with `min-w-0`/`truncate`-friendly classes on the brand area (so it can shrink rather than force the `GoogleSignInButton` off-screen at 320px, spec FR-008), preserving the header's existing sticky/layout classes and the `GoogleSignInButton` unchanged (spec FR-002, FR-008, FR-011, FR-012; depends on T012 failing first, T008, T009)
- [X] T015 [US2] Update `frontend/src/components/LandingHero.tsx`: replace the plain `<h1>Vinylmania</h1>` with `VinylmaniaIcon` (~120px) + `VinylmaniaWordmark` (`grunge={true}`) stacked inside the heading — the visible wordmark text is enough on its own to keep the heading's accessible text/textContent intact (research.md §5), no extra hidden text node needed — leaving the accent bar and supporting copy paragraph unchanged (spec FR-002, FR-007, FR-009, FR-012; depends on T013 failing first, T008, T009)

**Checkpoint**: User Stories 1 and 2 both work independently — the new brand mark appears consistently across the authenticated header and the entire landing page.

---

## Phase 5: User Story 3 - See the new icon as the browser tab favicon (Priority: P3)

**Goal**: Replace the browser-tab favicon with a static SVG derived from the icon's light-context variant.

**Independent Test**: Load any app page and confirm the browser tab icon is the new circular "VM" mark rather than the current favicon.

### Implementation for User Story 3

- [X] T016 [US3] Replace `frontend/public/favicon.svg` in place (same file path, no `index.html` change needed) with a new standalone SVG derived from the brief's light-context `vm-icon` (colors hardcoded, optimized/legible at 32px/16px), per the brief's "Monocromo & favicon" section (research.md §7; spec FR-004; independent of T001-T015 — no shared dependency)

**Checkpoint**: All three user stories are independently functional — header, landing page, and favicon all show the new brand mark.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 [P] Add a new-version entry to `frontend/CHANGELOG.md` describing the new brand mark (header, landing, favicon) and the "Anton" font addition; bump the `version` field in `frontend/package.json` to the next MINOR version, per Principle VI and the Development Workflow gates
- [X] T018 [P] Verify/extend `e2e/tests/dark-mode-contrast.spec.ts`: confirm the existing `page.getByRole('link', { name: 'Vinylmania' })` header-brand contrast check still resolves the wordmark's text color correctly against the new markup; add an assertion if the new structure requires one
- [X] T019 [P] Extend `e2e/tests/header-responsive-nav.spec.ts`: at 1280px, the header shows the icon+wordmark lockup; at 375px and at the narrowest supported 320px, icon-only with its bounding box not intersecting the hamburger button's bounding box (spec Edge Cases, SC-005); at an ultra-wide viewport (2200px, mirroring feature 033's precedent), the icon/wordmark stay at their fixed 36px/20px size rather than scaling up (spec FR-011, SC-005, Edge Cases) (research.md §8; spec FR-001, FR-008, FR-011, SC-005)
- [X] T020 [P] New `e2e/tests/logo-rebranding.spec.ts` (Playwright): landing header + hero brand-mark presence in light and dark theme (spec User Story 2); at 320px, the landing header's brand mark and `GoogleSignInButton` bounding boxes don't overlap (spec FR-008); a fetch check confirming `/favicon.svg` content changed from the old mark (spec User Story 3, SC-003); a no-flash check using `page.emulateMedia({ colorScheme: 'dark' })` before `page.goto`, then asserting `document.documentElement` already carries the `dark` class on the very first evaluate call after navigation (i.e. before/without waiting for any additional paint), confirming the pre-existing bootstrap script (not new logic from this feature) already governs the new markup too (spec SC-002, FR-003)
- [X] T021 Ran the full `quickstart.md` validation pass via real Playwright e2e tests against the running app (Vite dev server + Express backend + Firebase emulators) rather than an interactive manual walkthrough: header lockup/icon-only switch, fixed sizing at 320px/375px/1280px/2200px, landing header+hero brand mark in light/dark, favicon content change, and the pre-existing no-flash theme bootstrap all verified end-to-end (`e2e/tests/logo-rebranding.spec.ts`, `header-responsive-nav.spec.ts`, `dark-mode-contrast.spec.ts`)
- [X] T022 Ran the frontend full test suite (380/380 passing), lint (clean, only pre-existing unrelated warnings), `tsc -b` (clean), and the full e2e suite (65/74 passing; the 9 failures are pre-existing sign-in-flow flakiness in specs unrelated to this feature, previously confirmed via `git stash` against the unmodified baseline in feature 033's implementation). **Found and fixed one real regression during this run**: the new brand mark's required 44×44 touch target removed slack that the old plain-text label's `truncate` class used to silently absorb, exposing a pre-existing near-overflow in the app header's right side (hamburger + sign-out button) at 320px — fixed by narrowing `HeaderSearchBox`'s base width from `w-40` to `w-28` (research.md — not pre-planned, discovered via diagnostic e2e run)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: N/A — see rationale above
- **User Story 1 (Phase 3)**: Depends on Setup (T001, T002) for the font token/link; no dependency on other stories
- **User Story 2 (Phase 4)**: Depends on User Story 1's shared atoms (`VinylmaniaIcon`/`VinylmaniaWordmark`, T008/T009) already existing — a genuine technical dependency, not just sequencing convenience
- **User Story 3 (Phase 5)**: Fully independent of Setup, User Story 1, and User Story 2 — a standalone static asset replacement; can be done at any time, even first, if convenient
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Tests are written first and MUST fail before implementation begins (Principle I)
- Shared atoms (icon, wordmark, filter) → component wiring (header/hero)

### Parallel Opportunities

- T001 and T002 (Setup) are independent and can run in parallel
- T003, T004, T005, T006 (US1 tests, four different files) can all run in parallel
- T012 and T013 (US2 tests, different files) can run in parallel
- T016 (US3) can run in parallel with all of US1/US2, since it shares no files
- T017, T018, T019, T020 (Polish) are independent and can run in parallel

---

## Parallel Example: User Story 1

```bash
# Tests first, all in parallel (different files):
Task: "New component test in frontend/tests/components/brand/VinylmaniaIcon.test.tsx"
Task: "New component test in frontend/tests/components/brand/VinylmaniaWordmark.test.tsx"
Task: "New component test in frontend/tests/components/brand/VinylmaniaGrungeFilter.test.tsx"
Task: "Extend frontend/tests/unit/AppHeader.test.tsx for brand-mark assertions"

# Then implementation, in dependency order:
Task: "Create VinylmaniaGrungeFilter.tsx"
Task: "Create VinylmaniaIcon.tsx"
Task: "Create VinylmaniaWordmark.tsx"
Task: "Mount VinylmaniaGrungeFilter once in App.tsx"
Task: "Update AppHeader.tsx to render the new brand mark"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: Confirm the authenticated header shows the new brand mark, responsive and themed correctly, still linking to `/app`
4. Deploy/demo — already a visible rebrand of the app's most-seen surface, with no landing-page or favicon changes yet

### Incremental Delivery

1. Setup → font/theme prerequisites ready
2. User Story 1 → validate independently → deploy/demo (app header, MVP)
3. User Story 2 → validate independently → deploy/demo (landing header + hero)
4. User Story 3 → validate independently → deploy/demo (favicon) — can also ship first/anytime, being fully independent

---

## Notes

- No backend, no persisted data, no API changes — this is a purely frontend, presentational feature
- The favicon (US3) has no dedicated unit test: it's a static SVG asset with no runtime logic/props to unit test; its correctness is verified via the new e2e fetch-content check (T020) and manual/quickstart visual confirmation
- Avoid: rendering the icon's light/dark variants as two duplicated SVG elements — one markup with `dark:fill-*` classes is a hard requirement of this plan (research.md §2), not just a suggestion
- Avoid: adopting the brief's "Inter" body font — out of scope; only "Anton" (wordmark) is adopted (research.md §6)
- Avoid: building the monochrome brand-mark variants shown in the brief — explicitly out of scope per spec Assumptions (no in-app placement was specified for them)

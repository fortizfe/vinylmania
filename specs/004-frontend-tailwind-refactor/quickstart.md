# Quickstart: Validating the Frontend Look-and-Feel Refactor

This guide validates that the refactor satisfies its spec (see [spec.md](./spec.md))
once implemented. It assumes the atomic components and screen refactors described in
[data-model.md](./data-model.md) and [contracts/ui-components.md](./contracts/ui-components.md)
are in place.

## Prerequisites

- Node.js toolchain already used by `frontend/` (see `frontend/package.json`)
- `frontend/.env.local` configured as it is today (Firebase/Discogs config unchanged)
- Dependencies installed: `cd frontend && npm install` (after Tailwind CSS v4 and
  `clsx` have been added to `package.json` per research.md §1 and §3)

## Setup

```bash
cd frontend
npm install
npm run dev
```

## Automated validation

```bash
cd frontend
npm test        # Vitest: existing integration suites + new ui/ component unit tests
npm run lint     # oxlint
npm run build    # tsc -b && vite build — confirms the CSS-first Tailwind setup builds
```

**Expected outcome**: All suites pass, including the pre-existing integration tests
in `frontend/tests/integration/` (proving FR-008/SC-006 — no functional regression),
plus new unit tests for each component in `frontend/src/components/ui/`.

## Manual validation scenarios

### 1. Card-based consistency (User Story 1 / SC-001)

1. Sign in and open `/app` (library list), `/app/add`, and any `/app/records/:id`.
2. Confirm every primary content block on each screen is presented inside the same
   `Card` treatment (rounded corners, border, soft shadow, consistent padding).
3. Confirm a shared element (e.g., primary button) looks and behaves identically
   across all screens it appears on.

### 2. Skeleton loading with no layout shift (User Story 2 / SC-002, SC-003)

1. In browser devtools, throttle the network (e.g., "Slow 4G").
2. Navigate to `/app` (library list) and to a record's detail page.
3. Confirm a skeleton placeholder — matching the shape/size of the eventual real
   content — appears immediately; no blank screen or generic spinner.
4. Let the real content load and confirm no visible jump/shift of surrounding page
   elements occurs at the moment skeleton is replaced by content.
5. Repeat for the `/app/add` search flow: submit a search and confirm the results
   area shows a matching skeleton while the request is pending.

### 3. No layout shift across all states (SC-003)

1. On the library list, compare the footprint (size/position) of: the skeleton
   state (throttled network), the empty state (a library with zero records, or a
   test account with none), and the loaded state (records present). Confirm all
   three occupy the same overall content area shape.
2. Force an error (e.g., temporarily block the Discogs API request in devtools) and
   confirm the error state also matches the same footprint.

### 4. Light/dark theme coverage (User Story 3 / SC-004)

1. With the OS/browser set to light mode, review every screen for legibility and
   restrained palette usage.
2. Switch the OS/browser to dark mode (no in-app toggle exists, per FR-007) and
   confirm every screen — including skeleton placeholders — re-renders legibly with
   no unreadable text or broken contrast, without reloading the page.

### 5. Visual lightness (User Story 3)

1. Review spacing between content blocks on each screen — confirm it is generous
   and consistent (no cramped or ad hoc spacing).
2. Review typographic hierarchy — confirm headings/emphasis use medium/semibold
   weight rather than heavy bold text.
3. Review shadows — confirm standard cards use soft/subtle shadows, with stronger
   shadows reserved for floating elements (if any modals/overlays exist).

### 6. No duplicated visual patterns (SC-005)

1. Search the `frontend/src/` tree for repeated Tailwind class strings that define
   a visual pattern (e.g., the same card class combination hand-written in two
   files). None should exist outside the shared `ui/` components.

## Rollback

This refactor touches only `frontend/src/components/`, `frontend/src/pages/`, and
`frontend/src/styles/global.css`, plus `frontend/package.json` dependencies. Reverting
the corresponding commits restores the previous hand-written CSS implementation with
no backend or data impact.

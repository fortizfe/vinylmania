# Quickstart: Validating the Theme Personality Rebuild

**Feature**: `039-theme-personality-rebuild` | **Date**: 2026-07-12

This is a visual-only feature (FR-012) — validation is a mix of automated
regression checks (unchanged suites must stay green) and a manual visual/
contrast audit across every screen, since there is no new business logic to
exercise.

## Prerequisites

- `frontend/` dependencies installed (`npm install` in `frontend/`).
- A Firebase-auth'd session (or the app's existing test-auth path) to reach
  authenticated pages (Dashboard, Search Results, Library, Wishlist, record/
  release detail pages, Profile) — same requirement as before this feature.

## 1. Run the app

```bash
cd frontend
npm run dev
```

Open the app in a browser. Use the existing `ThemeToggle` (Profile page /
header) to switch between light and dark mode for every check below.

## 2. Automated regression gate (SC-004)

```bash
cd frontend
npm run test        # vitest — unit/component suite
```

```bash
# from repo root, if not already covered by CI locally
npx playwright test # e2e suite, per constitution's e2e gate
```

**Expected outcome**: both suites pass. Any failures must be limited to
snapshot/selector adjustments caused by the class-name swap (e.g. a test
asserting `bg-gray-950` literally) — no functional/business-logic assertion
should need to change. If a test fails for a reason other than a literal
color/class-name assertion, treat it as a regression, not an expected diff.

## 3. Token audit (SC-001, SC-002)

Visit each of the following in **both** light and dark mode and confirm the
palette (warm-neutral `stone` backgrounds/text/borders, near-black
`--color-surface`/`--color-surface-raised` in dark mode, indigo primary +
amber secondary accents, `Anton` on in-scope titles only) is applied
consistently — no screen should still show the old generic gray/slate look:

- [ ] Landing page (`/`) + `AppHeader`
- [ ] Dashboard (`/app`)
- [ ] Search Results
- [ ] Library List
- [ ] Wishlist
- [ ] Record Detail
- [ ] Release Detail
- [ ] Master Release Detail
- [ ] Profile
- [ ] Discogs Callback page

For each, also check:
- Skeleton/loading state (throttle network or use React DevTools to freeze
  the loading state) uses the new tokens and the exact same shape/dimensions
  as the loaded content (no layout shift) — SC per FR-008.
- The page/section title (if it's a page header, pillar header, or
  single-record showcase title) renders in Anton with no visible shift once
  the font finishes loading (hard-refresh with cache disabled to see the
  FOUT→Anton swap) — FR-005.
- Per-item titles inside grids/lists (Search Results cards, Library grid
  cards) remain in the regular body typeface, not Anton — FR-005.

Grep check for SC-002 (zero remaining hardcoded neutral utilities outside the
new tokens):

```bash
cd frontend
grep -rn "gray-\|slate-" src --include="*.tsx"
```

**Expected outcome**: no matches (or only matches with an explicit,
documented justification comment, per the constitution's exception bar).

## 4. Contrast spot-check (SC-003)

Using browser devtools' contrast checker (or any WCAG contrast tool) on the
pairings introduced/changed by this feature — see `research.md` §4 for the
full computed table and exact hex values to check:

- [ ] Light-mode body text vs. `stone-50` background
- [ ] Dark-mode body text vs. `--color-surface` / `--color-surface-raised`
- [ ] Light-mode muted text (`stone-500`)
- [ ] Dark-mode muted text (`stone-400`)
- [ ] `--color-accent` on dark surfaces (text/icon use)
- [ ] `--color-accent` as a background with dark text on top
- [ ] `--color-accent-text` on light surfaces (the light-mode amber-as-text case)
- [ ] `--color-primary` white button text (unchanged, sanity check only)

**Expected outcome**: every pairing measures ≥4.5:1 for normal text or ≥3:1
for large text/non-text elements, matching `research.md` §4.

## 5. Rating bands unchanged (FR-009)

- [ ] View a record/release with low, medium, high, and unrated ratings.
      Confirm `--color-rating-low/medium/high` and `--color-rating-unrated`
      look and read exactly as before this feature — no hue/value change.

## 6. Constitution amendment (FR-011, SC-005)

- [ ] `.specify/memory/constitution.md` version is bumped to `2.4.0`.
- [ ] "Visual lightness" section reflects the new direction (warm-neutral
      palette, dual accent, widened `Anton` scope) per `research.md` §7.
- [ ] "Theme-variable dark mode" carries the near-black surface + no-CLS
      heading clause.
- [ ] Every other rule in "UI Design System & Styling" is textually
      unchanged.
- [ ] The amendment's `Sync Impact Report` is present and accurate.

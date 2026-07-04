# Phase 0 Research: Frontend Look-and-Feel Refactor

All Technical Context fields were resolvable from the existing codebase and the
constitution; no `NEEDS CLARIFICATION` markers remain from planning. This document
records the concrete technology/approach decisions and why each was chosen.

## 1. Tailwind CSS v4 integration method

- **Decision**: Add Tailwind CSS v4 to the existing Vite project via the official
  `@tailwindcss/vite` plugin, with configuration living CSS-first in
  `frontend/src/styles/global.css` (`@import "tailwindcss";` plus an `@theme` block).
- **Rationale**: This is the officially recommended integration path for Vite
  projects in v4, requires no PostCSS pipeline of its own, and satisfies the
  constitution's "no `tailwind.config.js` unless a plugin strictly requires it" rule
  — none of the utilities this project needs require one.
- **Alternatives considered**: `@tailwindcss/postcss` + manual PostCSS config
  (rejected — extra moving part with no benefit for a Vite-only project); continuing
  with hand-written CSS (rejected — the entire point of this refactor is to stop
  doing this, per the constitution).

## 2. Dark mode mechanism

- **Decision**: Rely on Tailwind v4's default `dark:` variant, which resolves
  against the `prefers-color-scheme` media query out of the box. No custom variant,
  toggle component, or persisted preference is added.
- **Rationale**: Directly satisfies the spec's clarified FR-006 (light default, dark
  automatically via OS preference) and FR-007 (no manual toggle required) with zero
  extra state or JavaScript — the simplest implementation that meets the requirement
  (Principle III, Simplicity/YAGNI).
- **Alternatives considered**: Class-based dark mode via `@custom-variant` plus a
  toggle button and `localStorage` persistence (rejected — explicitly out of scope
  per the resolved clarification); a `matchMedia` listener duplicating the same
  logic in JS (rejected — redundant with native CSS behavior, adds a component and
  a bug surface for no gain).

## 3. Class-composition utility

- **Decision**: Use `clsx` inside atomic components for conditional/combined
  Tailwind class strings.
- **Rationale**: The constitution names `clsx` and `tailwind-variants` as acceptable
  options. The current component set (`Card`, `Button`, `Badge`, `Avatar`, `Input`,
  `Skeleton`) needs at most one or two boolean/enum-driven variants each (e.g.
  `Button` intent, `Badge` tone) — not a full variant-matrix API. `clsx` covers this
  with the smallest possible dependency footprint (Principle III).
- **Alternatives considered**: `tailwind-variants` (rejected for now — its
  slot/variant API is more than this component set currently needs; revisit if a
  component grows enough variant permutations that `clsx` conditionals become
  unreadable); hand-concatenated template strings (rejected — this is the exact
  per-screen duplication the constitution prohibits).

## 4. Skeleton loading strategy

- **Decision**: Add a generic `Skeleton` primitive (a `div` rendering
  `bg-gray-200 dark:bg-gray-800 animate-pulse rounded-md` at a caller-supplied size),
  and compose per-screen skeletons (`RecordCardSkeleton`, `RecordDetailSkeleton`)
  that reuse the exact same sizing classes/constants as their loaded-state
  counterparts.
- **Rationale**: FR-005 (no layout shift) can only be guaranteed if the skeleton and
  loaded state share one source of truth for dimensions. A single generic primitive
  plus thin per-screen compositions keeps this DRY (FR-002) while letting each
  screen's skeleton match its own real content shape (FR-003).
- **Alternatives considered**: One large monolithic skeleton component with
  conditional shapes (rejected — violates single-responsibility/Principle II);
  ad hoc `animate-pulse` divs written inline per screen (rejected — reintroduces the
  duplication this refactor removes).

## 5. Regression safety net for "no functional change" (FR-008)

- **Decision**: Treat the existing Vitest + React Testing Library integration
  suites (`frontend/tests/integration/*`) as the acceptance gate proving behavior is
  unchanged; extend them only where a test currently asserts on a class name that
  will change, and add new unit tests for the new `ui/` atomic components.
- **Rationale**: Principle I (Test-First) requires tests to gate behavior; since
  this feature's explicit goal is "no behavior change," the pre-existing tests are
  the correct oracle. One known touch point:
  `frontend/tests/integration/landingLayout.test.tsx` currently asserts
  `viewport.className` does not match `/scroll/i` — this assertion is
  implementation-coupled to the current hand-written class name and will need
  updating to check the rendered CSS behavior (e.g., via a data attribute or
  computed style) rather than a literal class-name substring once Tailwind classes
  replace it.
- **Alternatives considered**: Rewriting all integration tests alongside the
  refactor (rejected — increases the risk of masking an actual behavior regression
  behind a simultaneously-rewritten test).

## 6. Palette definition

- **Decision**: Define the new palette entirely as CSS variables inside the
  `@theme` block (e.g., `--color-primary`, plus a neutral gray/slate scale already
  provided by Tailwind's defaults), consumed through generated utilities
  (`bg-primary`, `text-primary`, `border-*`, etc.) rather than hardcoded hex values
  in component files.
- **Rationale**: Matches the constitution's CSS-first and "no custom CSS without
  justification" rules, and keeps the entire palette a one-file, one-block edit for
  future theming.
- **Alternatives considered**: Using Tailwind's built-in neutral/blue scales
  directly with no `@theme` indirection (rejected — the constitution requires the
  palette to be expressed as `@theme` variables so it can be swapped later without
  touching component files).

## 7. Tailwind v4 utility naming compliance

- **Decision**: Use current v4 utility names throughout new/refactored code
  (`shadow-sm`/`shadow-md`, `rounded-xl`, `bg-linear-*` if a gradient is ever
  needed) and catch any stray v3-era names during code review rather than adding
  new lint tooling.
- **Rationale**: Satisfies the constitution's naming rule without introducing a new
  dependency; the project's current lint stack (`oxlint`) has no Tailwind-aware
  plugin, and adding one is out of scope for a visual refactor (YAGNI).
- **Alternatives considered**: Adding an ESLint/oxlint Tailwind plugin for
  class-name validation (rejected for this feature — real but separate tooling
  investment, not required to satisfy the spec's requirements).

## Outcome

All unknowns are resolved. No `NEEDS CLARIFICATION` markers remain. Proceeding to
Phase 1 design (data-model.md, contracts/, quickstart.md).

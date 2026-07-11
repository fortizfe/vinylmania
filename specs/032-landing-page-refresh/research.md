# Research: Landing Page Refresh

All Technical Context items were resolvable directly from the existing codebase and the
resolved spec (`specs/032-landing-page-refresh/spec.md`, clarified 2026-07-11). No
NEEDS CLARIFICATION markers remain. This document records the concrete implementation
decisions the plan builds on.

## 1. Sticky header implementation pattern

- **Decision**: Reuse the existing `sticky top-0 z-40` header pattern already
  established by `frontend/src/components/AppHeader.tsx`, in a new
  landing-specific component (`LandingHeader`) containing only the Vinylmania
  wordmark and the existing `GoogleSignInButton` — no search box, nav icons, or
  hamburger menu (per FR-008 clarification).
- **Rationale**: `AppHeader` already proves the sticky-header + dark-mode +
  z-index pattern works across the app; reusing the same Tailwind utilities
  (`sticky top-0 z-40 border-b ... bg-white dark:bg-gray-950`) keeps the landing
  page visually and structurally consistent with the signed-in shell (FR-002),
  satisfying Simplicity/YAGNI (Constitution Principle III) by not inventing a
  new sticky mechanism.
- **Alternatives considered**: `position: fixed` with manual body padding —
  rejected, `sticky` avoids the extra offset bookkeeping `fixed` requires and
  is what the codebase already uses. A shared `<StickyHeader>` component
  abstracting both `AppHeader` and this new landing header — rejected for now
  as premature abstraction (Principle III); the two headers currently share
  only a class-string pattern, not real behavior, and forcing them into one
  component would need conditional branching for nav/search that AppHeader
  needs and the landing header explicitly must not have (FR-008).

## 2. Pillar section icons

- **Decision**: Hand-authored inline SVG icons (one per pillar: catalog,
  ratings, news), matching the existing pattern in
  `frontend/src/components/HeaderNavIcons.tsx` (no icon library dependency).
- **Rationale**: The clarified FR-009/FR-007 scope explicitly excludes
  illustration/photography but allows icon + short copy per pillar section.
  Simple, single-color line icons are consistent with "typography + color
  only" — they're UI iconography, not illustrative artwork — and match the
  codebase's existing convention of hand-written SVGs with no icon-library
  dependency (Constitution Technology Stack: no unjustified new dependency).
- **Alternatives considered**: Adding `lucide-react` or `heroicons` — rejected;
  neither is currently a dependency, and one-off SVGs for exactly three icons
  don't justify a new package per Principle III (Simplicity/YAGNI).

## 3. Accessibility verification for FR-010 / SC-006

- **Decision**: Add `@axe-core/playwright` as an e2e-only dev dependency and
  run an automated accessibility scan against the landing route in the new/
  updated Playwright spec, asserting zero violations (serious/critical) to
  satisfy SC-006.
- **Rationale**: The e2e suite (`e2e/`) already owns cross-cutting,
  full-page-render verification (Development Workflow gate: e2e coverage
  required for `/frontend` PRs); an axe scan at that layer catches real
  rendered-DOM contrast/keyboard issues that component-level unit tests
  cannot, without adding a testing dependency to `frontend/` where none is
  needed.
- **Alternatives considered**: `vitest-axe` in component tests — rejected as
  the primary check because component tests render in isolation (jsdom) and
  can't validate real contrast against computed CSS custom properties the way
  a real browser (Playwright) can. Manual/spot-check only — rejected, FR-010
  and SC-006 require a verifiable, repeatable gate, not a one-time check.

## 4. Rock/metal-inflected palette tokens (FR-009) — implemented values and contrast verification (T019)

**Final values** (`frontend/src/styles/global.css`):

| Token | Value | Used for |
|---|---|---|
| `--color-landing-surface` | `#0b0b10` | Dark-mode background for the sticky header, hero, and pillar sections |
| `--color-landing-accent` | `#f59e0b` | Dark-mode large-text/icon accent (headline underline bar, pillar icon fill) |
| `--color-primary` | `#4f46e5` (changed from `#6366f1`) | Light-mode large-text/icon accent; also the app-wide primary button color |

**Contrast verification** (WCAG 2.1 AA, relative-luminance method):

| Pairing | Ratio | Threshold | Result |
|---|---|---|---|
| `--color-landing-accent` (#f59e0b) text/icons on `--color-landing-surface` (#0b0b10) | 9.15:1 | 4.5:1 (normal text) | Pass (AAA) |
| `--color-primary` (#4f46e5) large text/icons on white | 6.29:1 | 3:1 (large text/non-text) | Pass |
| Existing `text-gray-900`/`text-gray-100` body copy on `bg-white`/`dark:bg-landing-surface` | Unchanged from pre-existing app tokens | 4.5:1 (normal text) | Pass (already verified by earlier features) |

**Fix discovered during T018's automated scan**: `@axe-core/playwright` flagged the "Sign in with Google" button's `text-white` on the original `--color-primary` (`#6366f1`) at **4.46:1** — just under the 4.5:1 AA minimum for normal-size text. This token is reused app-wide by `Button.tsx`'s primary variant, not something newly introduced by this feature, but the landing page's sign-in button is this feature's primary CTA and now falls under FR-010's explicit gate. Rather than a landing-page-only override (which would leave the same violation live on every other primary button in the app), `--color-primary` was darkened to `#4f46e5` (Tailwind indigo-600, one step down from the original indigo-500) — a minimal, visually adjacent change that raises the ratio to 6.29:1 and fixes the violation everywhere the token is used. Re-running the axe scan after this change reports zero serious/critical violations.

- **Decision**: Extend the existing `@theme` block in
  `frontend/src/styles/global.css` with a small set of new landing-specific
  color tokens (e.g., `--color-landing-surface`, `--color-landing-accent`)
  rather than hardcoding one-off hex values inline in components, following
  the same pattern already used for `--color-rating-low/medium/high`. Exact
  hex values are chosen at implementation time and MUST be verified against
  WCAG 2.1 AA (4.5:1) contrast for every text/background pairing they're used
  in, per FR-010.
- **Rationale**: Constitution's "No custom CSS without justification" rule
  requires values outside the default scale to live in `@theme`, not ad-hoc
  CSS or inline styles. Scoping new tokens to `landing-*` names keeps them
  discoverable and avoids overloading the existing neutral/primary tokens
  used elsewhere in the signed-in app.
- **Alternatives considered**: Reusing `--color-primary` (indigo) exclusively
  with only opacity/shade utility variants — rejected as insufficient to
  express a distinct "darker/higher-contrast, rock/metal-inflected" feel
  (FR-009) without any new token; introducing a full new secondary palette
  system — rejected as overbuilt for three sections on one page (Principle
  III).

## 5. Page layout / scroll structure

- **Decision**: A plain vertical stack of `<section>` elements (hero section
  under the sticky header, then three pillar sections), using standard
  document flow and Tailwind spacing utilities — no scroll-snap, parallax, or
  custom scroll-driven animation.
- **Rationale**: Nothing in the clarified spec calls for scroll-snap or motion
  effects, and the Edge Cases section requires that any motion respect
  `prefers-reduced-motion`. Plain flow is the simplest option that satisfies
  FR-007/FR-008 and avoids introducing motion-related accessibility work not
  required by the spec (Principle III, Simplicity/YAGNI).
- **Alternatives considered**: CSS scroll-snap per section — rejected, adds
  interaction complexity and motion-preference edge cases the spec doesn't
  ask for. Animated section reveal-on-scroll — rejected for the same reason;
  can be revisited in a future increment if explicitly requested.

## 6. Existing test impact

- `frontend/tests/integration/landingLayout.test.tsx` currently asserts the
  landing page has **no** scrollable container and that the CTA lives in the
  same single-viewport element as the heading (`landing-viewport` testid).
  This directly contradicts the clarified FR-007/FR-008 design (scrollable,
  sectioned page with a sticky header) and MUST be rewritten, not just
  extended, as part of this feature.
- `e2e/tests/sign-in.spec.ts` asserts `landing-viewport` is visible on load;
  this assertion still holds if `landing-viewport` is retained as the root
  landing container's testid, but the sign-in journey assertion should be
  extended to also verify the sign-in button/header stays visible after
  scrolling past the pillar sections (FR-003/FR-008).

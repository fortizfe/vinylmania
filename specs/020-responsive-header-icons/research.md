# Phase 0 Research: Responsive Header Navigation

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

No items in the Technical Context were marked `NEEDS CLARIFICATION` — the
stack, testing tools, and target platform are all fixed by the project
constitution and by the existing `AppHeader`/`HamburgerMenu`/
`HeaderSearchBox` code. The research below covers the remaining open design
decisions needed to implement the feature simply and consistently.

## Decision 1: How the layout switches between icons and the hamburger menu

**Decision**: Pure CSS via Tailwind responsive utility classes. Render both
the icon-nav container and the hamburger trigger unconditionally in the DOM;
show the icon-nav with `hidden md:flex` and the hamburger trigger with
`md:hidden` (mirroring the `flex`/`hidden` pattern, not a new one).

**Rationale**: The `md` (768px) breakpoint decision from `/speckit-clarify`
already matches how `HeaderSearchBox` widens itself (`sm:w-64 md:w-80`) —
there is no existing JS-based `matchMedia`/`useMediaQuery` hook anywhere in
`frontend/src`, so introducing one here would add a new pattern for a
problem Tailwind already solves declaratively. CSS media queries respond to
resize/rotation instantly and require no state, effect, or listener,
satisfying FR-008 (no page reload / instant response) with zero JS
complexity — directly aligned with Constitution Principle III (Simplicity,
YAGNI & KISS).

**Alternatives considered**:
- *JS `window.matchMedia` + React state hook*: rejected — adds a resize
  listener, state, and cleanup effect to solve something two Tailwind
  utility classes already solve; no other component in this codebase needs
  this pattern yet, so adding it here would be premature infrastructure.
- *Conditional rendering based on a `useState`/`useEffect`-derived flag*:
  rejected for the same reason, plus it introduces a client/server (or
  first-paint) mismatch risk that pure CSS doesn't have.

## Decision 2: What happens to an open hamburger menu when the viewport crosses the breakpoint

**Decision**: No special handling. The hamburger trigger button is hidden at
`md:hidden`, but the `Modal` it opens is unaffected by width — if a user
has the menu open and resizes/rotates past 768px, the modal stays open and
fully usable (links still work, Escape/backdrop still close it) while the
icon row becomes visible underneath/behind it.

**Rationale**: The spec's edge case only requires that the state "settle
cleanly" rather than break — an open, closable modal is not broken. Forcing
the modal shut on resize would require a resize listener purely to solve a
cosmetic edge case (a user resizing mid-interaction, then also still needing
the icons) that doesn't affect correctness or accessibility. Simpler alternative
preferred per Principle III.

**Alternatives considered**:
- *Force-close the modal via a resize listener when crossing the
  breakpoint*: rejected — extra JS/state for a rare interaction, no
  functional gain over "modal stays open and closable."

## Decision 3: Icon set for Profile / My wishlist / My library

**Decision**: Three new hand-authored inline SVG components colocated with
`HeaderNavIcons.tsx` (following the exact pattern of `HamburgerIcon` in
`HamburgerMenu.tsx` and `SearchIcon` in `HeaderSearchBox.tsx`): `viewBox="0
0 20 20"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={2}`,
rendered at `h-4 w-4` inside a single navigable element per destination.
Each destination is a `Link` (not a `Button`) styled with the same class
string `Button`'s `size="icon" variant="secondary"` produces — that string
is extracted into a shared `iconButtonClassName` helper exported from
`ui/Button.tsx` so `Button` and these `Link`s never drift apart, and so a
`<button>` never ends up nested inside an `<a>` (invalid HTML that would
also blur the accessible name/role each icon needs for FR-006/SC-004).
- Profile → a simple person/circle-and-shoulders outline
- My wishlist → a heart outline
- My library → a stacked-records/rows outline (distinct from the wishlist
  heart and profile person at a glance)

**Rationale**: Matches the clarified answer ("outline/stroke icons matching
the header's existing icon style") and requires no new dependency — every
existing header icon is already a small inline function component, not a
shared icon library import, so this is the path of least deviation.

**Alternatives considered**:
- *Icon library (e.g., lucide-react, heroicons)*: rejected — introduces a
  new dependency for three icons when the header already has an established
  zero-dependency inline-SVG convention; Constitution Principle III favors
  the simpler, already-proven approach.

## Decision 4: Avoiding duplication between `HamburgerMenu` and `HeaderNavIcons`

**Decision**: Extract the existing `NAV_LINKS` array (currently private to
`HamburgerMenu.tsx`) into a small shared module (`headerNavLinks.ts`)
exporting the `{ label, to }` list plus a well-known key per link (`profile`
/ `wishlist` / `library`) so `HeaderNavIcons` can map each key to its own
icon while both components consume the same destinations/labels/order.

**Rationale**: Constitution Principle IV (SOLID) and the "MUST NOT be
hand-repeated across files" rule in the UI Design System section both push
toward a single source of truth once a pattern (here, the 3 destinations)
is used in two places.

**Alternatives considered**:
- *Duplicate the link list in `HeaderNavIcons.tsx`*: rejected — two files
  would need to change in lockstep for any future destination/label/route
  change, exactly the duplication the constitution flags.

## Decision 5: Testing approach

**Decision**:
- Unit (Vitest + RTL): new `HeaderNavIcons.test.tsx` asserting the three
  icon buttons render with correct accessible names and `href`/navigation
  targets (mirroring the existing `HamburgerMenu.test.tsx` assertions);
  extend `HamburgerMenu.test.tsx` or add `AppHeader.test.tsx` to assert the
  hamburger trigger and icon-nav container carry the expected
  `hidden`/responsive classes so the "exactly one visible at a time" rule
  (FR-004) is enforced at the component level.
- E2E (Playwright): new `e2e/tests/header-responsive-nav.spec.ts` using
  `page.setViewportSize(...)` — following the exact pattern already used in
  `e2e/tests/caching-navigation.spec.ts` — to assert icons are visible and
  the hamburger is not at a wide viewport, and vice versa at a narrow
  viewport, then that both remain navigable to their real destinations.

**Rationale**: Matches Constitution Principle I (Test-First) and the
Development Workflow's mandatory e2e-for-frontend-PRs gate, reusing
established patterns rather than inventing new test infrastructure.

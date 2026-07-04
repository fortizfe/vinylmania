# Phase 0 Research: Release Preview Layout Redesign

All items in the Technical Context are already resolved from the existing codebase (this is a presentation-only redesign of existing components, not a new technical domain), so no NEEDS CLARIFICATION markers remain. This document records the concrete decisions for the handful of implementation-shaped questions the spec intentionally left to planning.

## 1. Hiding scrollbars while keeping content scrollable

**Decision**: Add a single reusable utility class (e.g. `.scrollbar-hidden`) defined once in `frontend/src/styles/global.css` using Tailwind v4's `@utility` directive, combining `scrollbar-width: none` (Firefox), `-ms-overflow-style: none` (legacy Edge), and a `::-webkit-scrollbar { display: none }` rule (Chrome/Safari/WebKit). Apply this class to every scroll container the spec requires to hide scrollbars: the thumbnail strip and the modal's own outer scroll container when rendering the preview.

**Rationale**: This is the standard, dependency-free cross-browser technique for hiding a scrollbar without disabling scroll (`overflow: auto`/`scroll` still functions; only the visual chrome is suppressed). Centralizing it as one utility (rather than repeating the three properties inline in multiple components) satisfies the Constitution's "reusable atomic components" and "no custom CSS without justification" rules — it's one small, documented, reused addition to the CSS-first `@theme`/utility layer, not a new stylesheet or per-component hack.

**Alternatives considered**:
- A JS-based custom-scrollbar library (e.g., `react-custom-scrollbars`) — rejected as a new dependency for a purely cosmetic need; violates Simplicity/YAGNI (Principle III) when a 3-line CSS utility does the job.
- Applying the CSS properties inline via `className` string concatenation in each component — rejected because the same 3-property combination would be repeated across at least 3 components (thumbnail strip, modal container, and potentially a future scroll area), which the Constitution explicitly requires to be extracted once it appears twice or more.

## 2. Scoping the modal's hidden scrollbar without changing the shared `Modal` component's default behavior

**Decision (revised at implementation time)**: The actual scrolling containers in `Modal.tsx` are ancestors of `children` — the `role="dialog"` wrapper (`max-h-[90vh] overflow-y-auto`) and the `Card` it renders (`h-full overflow-y-auto`) — not something `ReleasePreviewModal`'s own content can style from the child side (CSS/React give a child no way to reach up and restyle an ancestor it doesn't control). So `Modal.tsx` gains one small opt-in prop, `hideScrollbar?: boolean` (default `false`), which applies the `.scrollbar-hidden` utility (from decision 1) to both of those ancestor containers only when explicitly passed. Every existing call site keeps its default (`false`) and is therefore visually and behaviorally unchanged; `ReleasePreviewModal` is the only caller that passes `hideScrollbar`.

**Rationale**: Confirmed by clarification — the entire preview modal must hide scrollbars end-to-end, but without changing the shared component's *default* behavior for its other usages. On inspection, `Modal`'s scroll behavior is owned entirely by elements `Modal` itself renders (the dialog wrapper and `Card`), so achieving true end-to-end scrollbar hiding requires `Modal` to apply the class conditionally — a caller-side-only fix (as originally proposed in Phase 0) is not technically possible here. An opt-in, default-`false` prop is the minimal change that satisfies the clarification's actual constraint (no change to other usages) without requiring a caller-side workaround like DOM refs into an ancestor `Modal` doesn't expose.

**Alternatives considered**:
- Caller-side-only styling of `children` (the original Phase 0 proposal) — ruled out once implementation confirmed the scrollbars live on `Modal`-owned ancestor elements that `children` cannot style.
- Reaching into the DOM via a ref to add a class to Modal's ancestor elements — rejected as fragile and non-idiomatic React; `Modal` doesn't forward a ref to those elements, and doing so purely for a CSS class would be a worse violation of encapsulation than a typed, opt-in boolean prop.
- Changing `Modal`'s default behavior for everyone — rejected; directly contradicts the clarification.

## 3. Column/row composition for the two-column area below the gallery

**Decision**: Use a CSS grid (or two flex/grid children within the existing `grid grid-cols-1 lg:grid-cols-2` container already used by `ReleasePreviewModal`) where, on `lg:` and above, the key-details component occupies the left column and a new `ReleaseTracklistSection` component occupies the right column; both are non-scrolling (no `max-h`/`overflow` on either), consistent with FR-012 (whole-modal scroll, not per-column scroll). On narrow viewports the same components stack in source order (gallery → details → tracklist → additional info) since the grid collapses to `grid-cols-1`.

**Rationale**: Reuses the existing responsive breakpoint (`lg:`, Tailwind's 1024px) already established in the current `ReleasePreviewModal` grid, so no new breakpoint convention is introduced. Splitting the tracklist out of `ReleaseDetailsSection` into its own component satisfies Principle II (single-purpose, independently testable modules) and mirrors how `ReleaseImageGallery`/`ReleaseDetailsSection` are already separated.

**Alternatives considered**:
- Keeping the tracklist inline inside `ReleaseDetailsSection` (as it is today) and just repositioning it with CSS order — rejected because it would leave one component responsible for two independently-testable concerns (key details AND tracklist), harder to unit test in isolation, and diverging from the existing modularity pattern set by the gallery/details split.

## 4. "Remaining release information" section extraction

**Decision**: Extract the notes/identifiers/community-stats block (currently the tail end of `ReleaseDetailsSection`) into a new `ReleaseAdditionalInfoSection` component, rendered full-width below the two-column row.

**Rationale**: Matches FR-005/FR-006's requirement that this content be a distinct, independently-ordered section (not bundled with key details), and keeps each of the four spec-defined sections (gallery, key details, tracklist, remaining info) as one component with one reason to change (Principle II/IV).

**Alternatives considered**: None materially different — this follows directly from the spec's explicit 4-section structure.

## 5. Loading-state skeleton shape

**Decision**: Update the existing loading branch in `ReleasePreviewModal` to render skeleton blocks matching the new layout proportions: one full-width square skeleton (gallery), a two-column skeleton row (key details / tracklist), and a full-width skeleton block (remaining info) — reusing the existing `<Skeleton>` primitive, no new loading component.

**Rationale**: Directly required by FR-009 and the Constitution's "no layout shift" / "skeleton mirrors final content shape" rules.

**Alternatives considered**: A generic spinner — explicitly disallowed by the Constitution's Skeleton loading states rule.

## 6. Test and coverage strategy

**Decision**: Update the four existing unit test files (`ReleasePreviewModal`, `ReleaseImageGallery`, `ReleaseDetailsSection`, `addRecordFlow` integration) to assert the new structure, add two new unit test files for the two new components, and extend the existing (currently untracked) `e2e/tests/release-preview-gallery.spec.ts` to additionally assert: (a) desktop column order (details left, tracklist right), (b) mobile stacking order, and (c) absence of a visible scrollbar (via a computed-style check on `overflow`/`scrollbar-width`, or a visual/bounding-box check that content is reachable without a rendered scrollbar track).

**Rationale**: Satisfies Principle I (Test-First) and the Development Workflow gate requiring e2e coverage for any `frontend` change touching a user flow.

**Alternatives considered**: Relying on unit/component tests alone for the layout-order and scrollbar requirements — rejected; the Constitution explicitly forbids merging frontend changes on unit coverage alone when a user flow is affected, and layout/CSS behavior (grid order, scrollbar visibility) is best verified in a real browser rather than jsdom.

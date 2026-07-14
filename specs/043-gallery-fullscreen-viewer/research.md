# Phase 0 Research: Shared Image Gallery — Contained Size & Fullscreen Viewer

No `NEEDS CLARIFICATION` markers remain in the Technical Context (this is a
frontend-only presentational change to one existing, well-understood
component; language, dependencies, testing stack, and target platform all
match the existing `frontend/` app exactly). This research instead resolves
the two implementation-approach decisions the spec deliberately deferred to
planning, plus one root-cause investigation for each bug.

## Decision 1: Contained desktop size for the main image

**Decision**: Add a self-contained `lg:max-w-md` (28rem / 448px) plus
`mx-auto` to `ReleaseImageGallery`'s root `<div>`, active from the `lg`
breakpoint upward. Below `lg` (mobile/tablet), the component keeps its
current full-width behavior unchanged.

**Root cause**: The component's root `<div className="flex gap-3
aspect-square">` has no `max-w`/`max-h` of its own. Its rendered width is
whatever the parent grid column gives it. All three consuming pages use the
same grid: `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3` with the gallery
column set to `lg:col-span-2 xl:col-span-1`. Between the `lg` and `xl`
breakpoints (1024–1279px), the grid has exactly 2 columns and the gallery
spans **both** of them — i.e., the gallery is the full row width at that
range — before `xl` narrows it back down to 1 of 3 columns. Because the root
element is `aspect-square`, that full row width becomes the square's height
too, which is what reads as "almost the entire screen."

**Rationale**: Capping width directly on the shared component (rather than
adjusting each page's grid) fixes all three call sites at once, matches
spec FR-012 (identical behavior across pages), and doesn't require touching
`ReleaseDetailPage.tsx`/`RecordDetailPage.tsx`/`MasterReleaseDetailPage.tsx`
at all — their existing grid classes and testids are untouched. `28rem`
(`max-w-md`, an already-used Tailwind scale value in this codebase, e.g.
`Modal`'s own `md` size) is a reasonable "contained but still comfortably
browsable" size for a square cover-art viewer, satisfying spec SC-001
("never occupies a disproportionate share of the screen") without
introducing a bespoke `@theme` value (constitution: "No custom CSS without
justification").

**Alternatives considered**:
- *Adjusting the grid column span per page* — rejected: three separate
  edits instead of one, risks the three pages drifting out of sync again
  (the exact problem Principle II/shared-component intent guards against).
- *Capping only `max-h` instead of `max-w`* — rejected: since the container
  is `aspect-square`, width and height are coupled; capping either one caps
  both, but `max-w` is the more direct fix given the root cause is a
  *width* inheritance problem.
- *A fluid `clamp()`-based custom width* — rejected: would need a bespoke
  `@theme` variable or inline style for a single-value need; a plain
  Tailwind breakpoint utility (`lg:max-w-md`) is simpler and already
  idiomatic in this codebase (KISS).

## Decision 2: Capping the thumbnail column's height with hidden internal scroll

**Decision**: Add `min-h-0` to the thumbnail column's existing className
string (`scrollbar-hidden flex w-16 flex-col gap-2 overflow-y-auto` →
`... min-h-0 ...`). No other structural change.

**Root cause**: This is the well-known CSS flexbox sizing gotcha: a flex
item's default `min-height` is `auto`, which resolves to its **content's
intrinsic height**, not `0`. That default silently overrides
`overflow-y-auto` — the browser won't shrink a flex child below its content
size unless `min-height: 0` (Tailwind: `min-h-0`) is set explicitly. The
thumbnail column is already a flex item of the root `flex` container and
already has `overflow-y-auto` + `scrollbar-hidden`; it only needed the
`min-h-0` override to actually respect the parent's height instead of
growing to fit every thumbnail.

**Rationale**: This is a one-class, zero-risk fix — it changes nothing about
the column's existing width (`w-16`), gap, hidden-scrollbar behavior, or
selection-ring styling (all explicitly preserved per spec's "Fuera de
alcance"/out-of-scope notes), and it directly satisfies spec FR-002/FR-003
(capped height, hidden-scrollbar internal scroll) and SC-002/SC-003.
Combined with Decision 1's `aspect-square` root sizing, the thumbnail
column's available height is now both well-defined and enforced.

**Alternatives considered**:
- *Explicit fixed `max-h-*` value on the thumbnail column* — rejected: the
  available height should track the main image's rendered height (which
  itself now varies by viewport per Decision 1), not a hardcoded pixel
  value that would drift out of sync with the image size.
- *`overflow-hidden` with pagination/"show more" controls* — rejected as
  unnecessary complexity (YAGNI); the spec explicitly asks for scrollable
  containment, not pagination, and the existing `scrollbar-hidden` utility
  already provides the desired "scrollable but visually clean" pattern used
  elsewhere in the app (e.g. `Modal`).

## Decision 3: Fullscreen viewer implementation approach

**Decision**: Build a new dedicated component, `GalleryFullscreenViewer`,
rather than reusing `Modal` as-is. Extract two small pieces out of `Modal`
for shared reuse: a `CloseIcon` presentational component and a
`useEscapeKey(onClose, active)` hook. Both `Modal` and the new viewer
consume these two shared pieces; `Modal`'s own behavior is otherwise
unchanged.

**Rationale**: `Modal.tsx` wraps its `children` in a padded, `max-w-lg`/
`max-w-3xl`-capped (or `max-w-xs` side-panel) `<Card>` — the opposite of an
edge-to-edge lightbox. Retrofitting `Modal` with a new "fullscreen, no
padding, no Card" variant would mean branching most of its internals
(`backdropPositionClasses`, `centerSizeClasses`, the `<Card>` wrapper
itself) behind a new prop, which is more complex than a small, single-
purpose new component — violating Simplicity/YAGN (Principle III) in the
name of reuse. Extracting `CloseIcon` and the Escape-key-handling `useEffect`
(currently duplicated logic if left inline in both places) keeps the actual
duplication-prone pieces DRY (Principle IV, SOLID/Open-Closed) without
forcing an unrelated component to serve two visually incompatible purposes.
This mirrors the project's existing precedent of extracting small shared
pieces (e.g., `FormatFilter` → `SelectableListFilter` in spec 038) rather
than overloading one component with a mode flag.

**Alternatives considered**:
- *Add a `variant="fullscreen"` prop to `Modal`* — rejected: `Modal`'s
  `<Card>`-based layout, `position`/`size` props, and title bar don't apply
  to a lightbox; a variant flag would add conditional branches throughout
  the component for a fundamentally different visual contract (violates
  Principle IV's "abstractions MUST NOT leak implementation details" in
  reverse — it would leak the lightbox's needs into the generic Modal).
- *Use the browser's native Fullscreen API (`element.requestFullscreen()`)*
  — rejected: unrelated concern (OS-level fullscreen vs. an in-page overlay
  taking up the viewport); adds permission/browser-support edge cases the
  spec doesn't ask for, and doesn't match the "X to close" pattern (native
  fullscreen typically exits via Escape only, browser-controlled UI).
- *Third-party lightbox library* — rejected: the spec's requirements (thumb
  strip navigation, X + Escape + backdrop close, no zoom/pan) are simple
  enough to implement directly with existing atoms (`Button`), consistent
  with the project's "no new dependency for something this small" pattern
  (Principle III) and avoiding an unvetted external dependency.

## Decision 4: Making the main image clickable and keyboard-accessible

**Decision**: Wrap the main `<img>` in an unstyled `<button type="button">`,
mirroring the exact pattern the thumbnail buttons already use in the same
component. The `<img alt={alt}>` stays as-is inside the button.

**Rationale**: Native `<button>` elements are keyboard-activatable (Enter
and Space) with zero custom key-handling code, directly satisfying spec
FR-005/AC 11 without a bespoke `onKeyDown` handler (KISS). Because
accessible-name computation includes descendant `img[alt]` text, and
Testing Library's `getByRole` queries scan all matching elements regardless
of ancestry, wrapping the image in a button does not change the existing
`screen.getByRole('img', { name: alt })` query used by
`ReleaseImageGallery.test.tsx` — only the assertions that inspect
`mainImage.parentElement` need updating (the `<img>`'s parent becomes the
new `<button>` instead of the root `<div>`), which is expected test churn
already flagged in the spec's Assumptions/testing notes.

**Alternatives considered**:
- *`<div role="button" tabIndex={0} onKeyDown={...}>`* — rejected: requires
  manually reimplementing Enter/Space activation and focus styling that a
  native `<button>` provides for free; inconsistent with the thumbnails'
  existing `<button>` pattern in the same file.

## Decision 5: Selected-image and open/closed state ownership

**Decision**: Keep a single `selectedIndex` state (already present) in
`ReleaseImageGallery`, and add one sibling `isFullscreenOpen` boolean state
in the same component. Both the embedded thumbnail strip and the fullscreen
viewer's thumbnail strip call the same `setSelectedIndex`. No context,
store, or URL state is introduced.

**Rationale**: This directly satisfies the spec's edge case ("fullscreen
must open on the currently selected image, not always the primary one")
and FR-011 ("closing fullscreen preserves whatever was selected inside it")
for free — there is only one source of truth for "which image is showing,"
so there is nothing to synchronize between the two presentations. This is
the simplest design that satisfies the requirement (Principle III).

**Alternatives considered**:
- *Separate `fullscreenSelectedIndex` state, reconciled on close* — rejected:
  adds a synchronization step and a class of bugs (forgetting to sync) for
  no behavioral benefit, since the spec never requires the two presentations
  to show *different* images simultaneously.

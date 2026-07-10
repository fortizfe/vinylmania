# Phase 0 Research: UI Polish – Search Results & Dashboard Cards

All Technical Context fields were resolvable directly from the existing codebase
(no NEEDS CLARIFICATION markers). This document records the decisions behind
each of the four changes.

## 1. Search batch size (20 → 40)

- **Decision**: Change `PAGE_SIZE` in `frontend/src/pages/SearchResultsPage.tsx:19`
  from `20` to `40`. No other file needs to change.
- **Rationale**: `PAGE_SIZE` is threaded straight through to
  `useCatalogSearchInfinite(query, 'release', PAGE_SIZE, filters)` (line 57),
  then `discogsQueries.ts` → `discogsApi.ts` (`perPage` query param) →
  `backend/src/routes/discogs.ts` (`parsePageParams`) →
  `backend/src/discogs/discogsClient.ts` (`options.perPage ?? 50`). The backend
  already accepts an arbitrary `perPage` and defaults to 50 when unset, so 40
  is well within the already-supported range — no backend change needed.
- **Alternatives considered**: Making the batch size backend-configurable via
  an env var — rejected as unnecessary (YAGNI); the frontend constant is the
  single source of truth for this UI-driven decision, per Constitution
  Principle III.

## 2. Fixed-height search result cards + master-card content gap

- **Decision**: Apply a fixed height to the `Card` in `SearchResultCard.tsx`
  (e.g., `h-*`/`min-h-*` Tailwind utility, consistent across the grid, MAY vary
  per breakpoint via responsive variants like `h-80 sm:h-84`). Add a static
  "Multiple editions" `Badge` (reusing the existing `Badge` atomic component,
  see `ui/Badge.tsx` usage in the same file) rendered when `isGrouped` is true,
  in the same position where the format `Badge` / `ResultCardActions` render
  for release cards, so the two card variants consume equivalent vertical
  space.
- **Rationale**: `SearchResultCard.tsx:69,83` currently conditionally omits
  the format `Badge` and `ResultCardActions` for masters (`!isGrouped &&`),
  which is why master cards render shorter — confirmed via direct inspection.
  The `Card` wrapper (`ui/Card.tsx`) is a plain block with no height
  constraint, and the grid `<li>` wrappers in `SearchResultsPage.tsx` have no
  `h-full`/stretch forcing, so a per-grid fixed height on the `Card` itself
  (not relying on row-stretch) is the direct way to satisfy the clarified
  requirement ("fixed height across the whole grid," not just per-row).
  `SearchResultCardSkeleton.tsx` must be updated to the same fixed height so
  loading and populated states share sizing (constitution "No layout shift"
  rule).
- **Alternatives considered**: CSS Grid `align-items: stretch` +
  `h-full` on `Card` (row-relative only) — rejected per clarification, which
  explicitly chose grid-wide fixed height over row-relative equality. Making
  master cards taller by enlarging the cover image instead of adding a label —
  rejected because it would change image aspect ratio/visual weight
  inconsistently with release cards, whereas a label matches the existing
  format-badge slot.

## 3. Enhanced stacked-covers effect

- **Decision**: Increase the `translate-x-*`/`translate-y-*`/`rotate-*` offset
  values and/or add a subtle `shadow-sm` to the two ghost layers in
  `SearchResultCard.tsx:39-40` (currently `translate-x-2 translate-y-2 rotate-3`
  and `translate-x-1 translate-y-1 -rotate-2`), and/or strengthen the
  background-color contrast between the two ghost layers and the base card
  background so the layered silhouette is visible past the card edges without
  being clipped.
- **Rationale**: The effect already exists and is exclusive to
  `isGrouped` cards (`SearchResultCard.tsx:33-41`) — confirmed via inspection
  — but uses small offsets (`translate-x-2`/`translate-x-1` = 8px/4px) and only
  background-color contrast (no shadow) for depth, which is why it reads as
  "too subtle." Widening offsets and/or adding a shadow is a pure Tailwind
  utility change with no new component, consistent with the clarification that
  ruled out replacing the effect with a badge/counter (that's the separate,
  additive "Multiple editions" label from decision #2).
- **Alternatives considered**: Replacing translate/rotate offsets with a
  drop-shadow-only effect — rejected, offsets are what create the perceivable
  "stack of covers" silhouette; shadow alone would look more like a single
  elevated card. A count badge overlay — explicitly ruled out by the
  clarification session (kept separate from decision #2's label, and not a
  replacement for the visual stack).

## 4. Fixed-height RSS article cards with line-clamp

- **Decision**: Apply a fixed height (or `min-h-*`) to the `Card` in
  `FeedArticleCard.tsx:19`, and add `line-clamp-2` to both the title `h3`
  (line 44-46) and the excerpt `p` (line 47).
- **Rationale**: `FeedArticleCard.tsx` has no `line-clamp-*`/max-height on
  title or excerpt today, so height varies directly with text length —
  confirmed via inspection. The carousel wrapper in `FeedCarousel.tsx:92`
  (`<div className="w-72 shrink-0">`) is a flex child that stretches by
  default, but the `Card` inside doesn't consume that stretched height since
  it has no `h-full`; adding a fixed height to `Card` (plus `h-full` on it, so
  it also honors the flex-stretch from `FeedCarousel`) closes that gap.
  Tailwind v4's `line-clamp-2` utility handles multi-line truncation directly,
  matching the clarified 2-line/2-line limit — no custom CSS needed.
  `FeedArticleCardSkeleton.tsx` must match the same fixed height.
- **Alternatives considered**: Truncating with `overflow-hidden` + fixed
  height alone (no `line-clamp`) — rejected, since it would cut text
  mid-line without an ellipsis, a worse UX than the clarified line-clamp
  approach.

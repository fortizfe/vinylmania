# Research: Search Filter Refinements

**Feature**: 022-search-filter-refinements

This feature has no `NEEDS CLARIFICATION` markers remaining in `spec.md` (one
clarification was resolved interactively during `/speckit-clarify` and is recorded
in `spec.md`'s Clarifications section). The decisions below consolidate the
technical approach for the four areas that needed a concrete resolution before
design.

## Decision: Multi-format matching via one comma-joined request (verified AND semantics)

**Decision**: When a user selects multiple format values, the frontend joins them
into a single comma-separated string (e.g. `Vinyl,CD`) and sends it as the sole
value of the existing `format` query parameter, in one request — exactly the same
request shape feature 021 already established, unchanged in structure.

**Verified outcome (2026-07-07, task T014)**: This was originally expected to
produce OR semantics (match any selected format). Live verification against the
real Discogs API during implementation proved the opposite: `format=Vinyl` alone
returned 868 items, `format=CD` alone returned 1756 items, but the combined
`format=Vinyl,CD` returned only 14 items — each a release genuinely available in
*both* formats simultaneously (e.g. a Vinyl+CD box set reissue). This is AND
semantics, not OR. `spec.md` (User Story 1, Acceptance Scenario 3, FR-004,
SC-002, Edge Cases, Assumptions) was updated after this finding to describe the
verified, accepted behavior.

**Rationale for accepting AND semantics rather than switching to the per-value
merge fallback**: it keeps the single-request integration with Discogs'
`/database/search` intact (Constitution Principle II: no parallel/duplicate
search path, rate-limit-aware) and avoids the fallback's approximate-pagination
problem (see Alternatives below). The feature still delivers real, guided,
typo-free multi-value narrowing — just narrowing (AND) rather than widening (OR).

**Alternatives considered**:
- *One Discogs request per selected format value, merged client/server-side*:
  would guarantee true OR semantics, but multiplies upstream calls per search
  (rate-limit exposure) and requires approximate pagination logic across merged
  result sets (Discogs' own `pages`/`items` totals don't compose cleanly once
  results from separate queries are deduplicated) — rejected after the live
  verification, since the added complexity and rate-limit cost weren't judged
  worth it for a per-collector feature refinement; the single-request AND
  behavior was accepted instead.
- *Forward only the first selected value*: simplest, but doesn't use the other
  selected values at all — rejected, does not meet the explicit "selección
  múltiple" requirement in any meaningful way.

## Decision: Fixed format list is a static frontend constant

**Decision**: The ~33 canonical format names (from the image supplied with this
feature's request) are hardcoded as a `FORMAT_OPTIONS` constant in
`frontend/src/constants/formatOptions.ts`, not fetched from any endpoint.

**Rationale**: Consistent with feature 021's Assumptions — Discogs' documented API
has no endpoint to enumerate valid format values. The list is small, stable, and
domain-standard (it mirrors Discogs' own release-format vocabulary), so a static
constant satisfies Simplicity/YAGN (Constitution Principle III) without adding a
fetch/cache layer for data that essentially never changes.

**Alternatives considered**:
- *Fetch from a Discogs facets/enumeration endpoint*: no such endpoint exists in
  the documented Discogs `/database/search` API — rejected, not feasible.
- *Maintain the list backend-side and expose it via a new endpoint*: adds a new
  route and a network round-trip for data that's static and small enough to ship
  with the frontend bundle — rejected as unnecessary complexity (Principle III).

## Decision: Format picker presented as a modal multi-select, not an inline checklist

**Decision**: The Format field in `SearchFiltersControl` becomes a compact trigger
button (e.g. "Format" or "Format (2)" when values are selected) that opens the
existing `Modal` atom containing a scrollable list of `FORMAT_OPTIONS` checkboxes
(new `Checkbox` atom). Checking/unchecking updates the control's local pending
`format` selection immediately; the modal has no separate internal "apply" step —
the outer, already-existing "Apply filters" action remains the single point where
the search re-runs (FR-008 unchanged).

**Rationale**: ~33 options rendered inline inside the filter `Card` would make the
control's height vary drastically and break the "no layout shift" and "visual
lightness" rules (Constitution: UI Design System). A modal (already used elsewhere
in the app, already dark-mode-aware) keeps the filter control's footprint constant
regardless of selection count, and matches the general shape of the reference
image (a dedicated format-selection surface with checkboxes). Reusing the outer
Apply/Clear flow — rather than adding a second "apply" inside the modal — avoids a
second layer of pending state (Principle III).

**Alternatives considered**:
- *Inline checklist directly in the Card*: rejected — 33 checkboxes inline would
  dominate the results screen and cause layout shift as filters are opened/closed.
- *Native `<select multiple>`*: rejected — poor UX/accessibility for 33 options,
  inconsistent with the app's atomic-component design system, and doesn't match
  the reference image's checklist presentation.

## Decision: Artist and obsolete-format handling both resolved at the frontend URL-parsing layer

**Decision**: `useSearchQueryParams.ts` stops recognizing `artist` as a filter
param at all (removed from its `FILTER_PARAM_NAMES`), and its format-parsing step
drops any comma-separated value not present in `FORMAT_OPTIONS` before building
the in-memory filter state. The backend (`discogs.ts`, `discogsClient.ts`)
likewise stops recognizing `artist` in its own `FILTER_PARAM_NAMES`/
`SearchCatalogOptions`, but does not need format-value validation — it already
only ever receives values the frontend has filtered to the canonical list.

**Rationale**: This mirrors feature 021's existing pattern where
`useSearchQueryParams` already owns trimming/normalization of filter values
(single source of truth for what a "valid" filter value looks like on the URL
boundary). Removing `artist` from both layers' recognized-param lists is the
simplest way to guarantee FR-009 (old links with `artist` are silently ignored,
no error) — there's no special-case handling to write or test, the param is just
never read. Adding format-value validation on the backend as well would duplicate
logic the frontend already performs, violating Simplicity/YAGNI.

**Alternatives considered**:
- *Backend validates format values against a duplicated canonical list*: rejected
  — duplicates the frontend's list and validation logic for no behavioral gain,
  since the backend is never reached with an invalid value in normal operation.
- *Keep backend accepting `artist` but have the frontend just stop sending it*:
  rejected — doesn't satisfy FR-009 as robustly (a hand-crafted or old link could
  still reach the backend with `artist` set, and the intent is for the parameter
  to be fully retired, not just hidden in the UI).

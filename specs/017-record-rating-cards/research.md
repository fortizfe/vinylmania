# Phase 0 Research: Record Rating Badges on Search and Library Cards

The feature spec is product-complete, but the codebase and Discogs contracts leave a few implementation-shaped decisions to planning. This document resolves them.

## 1. Source of truth for rating on search-result cards

**Decision**: Extend the backend search flow so `/api/discogs/search` enriches each release-type result with an optional `communityRating` object fetched from Discogs' dedicated community release rating endpoint (`GET /releases/{release_id}/rating`), then return that additive field to the frontend.

**Rationale**: The current search contract in `backend/src/discogs/types.ts` and `frontend/src/services/discogsApi.ts` has no rating field, and the current search mapper ignores the raw search payload's partial `community` block because it contains `have` and `want`, not the exact average rating needed by the spec. Discogs documents a dedicated community-rating endpoint that returns the exact average and count, which matches the requested badge behavior without fetching the entire release payload for every card.

**Alternatives considered**:
- Fetch the full release for every search result and read `release.community.rating` from there. Rejected because it is heavier than necessary: the badge only needs average/count, not the full release document.
- Show a proxy metric such as `have`/`want` from search results instead of rating. Rejected because the spec explicitly asks for the rating value itself.
- Fetch rating client-side per card from the frontend. Rejected because it would scatter Discogs-coupled orchestration into the UI, duplicate caching concerns, and weaken testability compared with one typed backend contract.

## 2. How to keep search enrichment within Discogs limits

**Decision**: Perform search-result rating enrichment server-side with short-lived caching and graceful per-result degradation. The backend search request remains the only frontend call; the server fans out for rating lookups only for release-type results on the requested page, caches those rating responses, and omits `communityRating` on individual results whose rating lookup fails. Each per-release lookup is bounded by a 2-second timeout (spec SC-006, resolved during clarification); a lookup still pending past that point is treated identically to a failed lookup — the result is returned without `communityRating` rather than delaying the response.

**Rationale**: The default search page size is 20, so the upper bound becomes one search request plus up to 20 rating requests for a cold page. That stays inside Discogs' authenticated limit of 60 requests/minute for normal browsing while keeping the UI simple. Per-result degradation prevents one failed or slow rating lookup from converting the whole search page into an error state or a perceptibly delayed response, which better fits the feature's presentation-only nature. A fixed 2-second per-lookup timeout gives implementation and tests a concrete, deterministic bound instead of an open-ended "graceful degradation" claim.

**Alternatives considered**:
- Fail the whole search response if any rating enrichment fails. Rejected because it makes the browsing flow brittle and violates the spec's intent that rating is a secondary signal.
- Add a background prefetch or persistence layer for ratings. Rejected as unnecessary complexity for a read-only presentation enhancement.
- Use a single timeout for the whole fan-out batch rather than per-lookup. Rejected because one slow release would then either delay every other result in the batch or force cancelling lookups that would have otherwise finished within budget; a per-lookup timeout keeps each result's fate independent.

## 3. Source of truth for rating on library cards

**Decision**: Reuse the existing release community rating already embedded in the library entry's `release.community.rating` payload. No library API contract change is needed for rating sourcing.

**Rationale**: `frontend/src/services/libraryApi.ts` already models `Release.community.rating.average/count`, and library cards already receive a hydrated `release` object. Adding another backend fetch path for library cards would duplicate data already present.

**Alternatives considered**:
- Add a new library-specific rating field to `EnrichedLibraryEntry`. Rejected because it duplicates release metadata that the current contract already exposes.

## 4. Badge component and placement strategy

**Decision**: Introduce a shared frontend atomic component, `ReleaseRatingBadge`, rendered as an overlay inside a relatively positioned thumbnail wrapper and anchored to the upper-right corner for both search and library cards.

**Rationale**: The feature applies the same visual token to two card surfaces and the constitution requires shared atomic components once a visual pattern repeats. Rendering the badge inside the thumbnail zone keeps it visible during the first scan while preserving text rows and action controls.

**Alternatives considered**:
- Inline badge markup separately in each card. Rejected because it repeats visual logic and makes future tuning drift-prone.
- Put the badge in the text metadata row. Rejected because it competes with title, year, format, and truncation space.

## 5. Numeric display and visibility rules

**Decision**: The badge uses the raw rating value to determine its color band, but displays a compact one-decimal label (for example `4.2`). The badge is hidden when the rating is absent, non-numeric, outside 0-5, or has no supporting votes (`count <= 0`).

**Rationale**: One decimal keeps the rounded square visually compact and legible while preserving the relative signal users need. Hiding ratings with zero votes satisfies the spec's distinction between "no valid rating available" and a legitimately poor rating.

**Alternatives considered**:
- Display two decimals exactly as returned by Discogs. Rejected because values like `4.19` produce a wider badge that is harder to keep unobtrusive on dense grids.
- Show `0.0` for unrated releases. Rejected because it falsely communicates a low score rather than missing data.

## 6. Threshold policy and presentation helper

**Decision**: Centralize banding and display rules in a small pure helper (for example under `frontend/src/lib/releaseRating.ts`) that maps a validated average to one of three semantic bands: `low` (`0.00-2.50`), `medium` (`2.51-4.09`), and `high` (`4.10-5.00`).

**Rationale**: Both cards must use identical thresholds, label formatting, and hide/show rules. A pure helper gives deterministic unit coverage for the boundaries called out in the spec and keeps the badge component focused on rendering.

**Alternatives considered**:
- Recompute thresholds inline in each card. Rejected because it duplicates the most error-prone logic in the feature.

## 7. Loading, fallback, and observability behavior

**Decision**: Search and library skeleton cards keep their current shape, with an added placeholder block in the thumbnail corner only if needed to preserve visual balance. Partial rating enrichment failures log structured backend warnings including the release id and search route outcome, but cards without rating simply render without a badge.

**Rationale**: The feature should not create visible layout shift or turn a secondary metadata failure into a broken browsing screen. Logging the degraded path preserves production diagnosability while keeping the UI calm.

**Alternatives considered**:
- Show a textual fallback such as `N/A`. Rejected because it draws more attention than simply omitting the secondary accent.

## 8. Accessible band-color tokens (WCAG AA contrast, spec FR-013/SC-001)

**Decision**: Define the three band tokens in the frontend `@theme` block as `--color-rating-low: #DC2626` (Tailwind `red-600`) with white badge text, `--color-rating-medium: #FBBF24` (Tailwind `amber-400`) with near-black badge text, and `--color-rating-high: #15803D` (Tailwind `green-700`) with white badge text.

**Rationale**: Computed WCAG relative-luminance contrast for each pairing is `red-600`/white ≈ 4.83:1, `amber-400`/near-black ≈ 12.6:1, and `green-700`/white ≈ 5.02:1 — all meet the 4.5:1 AA text-contrast bar required by FR-013. For SC-001's band-to-band distinguishability, red and dark green sit close in raw luminance (a known red/green confusion pair for some forms of color-blindness), so hue separation and the badge's numeric value — not luminance contrast alone — are what keep the three bands distinguishable; FR-013 already guarantees the number itself is legible on every band, which is the color-independent fallback signal SC-001 relies on.

**Alternatives considered**:
- `green-600` (#16A34A) with white text. Rejected: contrast ≈ 3.3:1, fails the 4.5:1 AA bar.
- `amber-500`/`amber-600` with white text. Rejected: contrast ≈ 2.15:1 / 3.19:1, both fail AA; white text on mid-tone amber is a common contrast trap.
- Adding a non-color differentiator (icon or pattern) per band in addition to color. Rejected per the Q3 clarification answer — the numeric value already carries the band information independent of color, so an extra glyph would add visual weight without a corresponding accessibility gain, conflicting with FR-012's "secondary accent, not dominant element" requirement.
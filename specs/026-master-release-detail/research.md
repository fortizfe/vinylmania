# Research: Master Release Grouping & Detail Pages

**Feature**: [spec.md](./spec.md) | **Date**: 2026-07-08

No `NEEDS CLARIFICATION` markers remain in the Technical Context (the stack is fixed by the constitution and this feature adds no new external dependency). This document instead records the technical decisions needed to turn the spec's clarified behavior into an implementable design, each backed by the Discogs Database API documented in `docs/Database - Discogs API Documentation.pdf`.

## Decision 1: How search results become "grouped" (master vs. release)

**Decision**: Stop forcing `type=release` on the catalog search request. Call `GET /database/search` with the `type` param left unset, so Discogs' own catalog index returns each work exactly once — as a `type: "master"` hit when it has sibling versions, or a `type: "release"` hit when it doesn't. The backend filters the raw response down to `release` and `master` hits only, dropping `artist`/`label` hits itself.

**Rationale**: Discogs deliberately indexes each catalog work once for search purposes — a release that belongs to a master is not additionally returned as a standalone `release` hit next to its `master` hit. This means "grouping" is not something Vinylmania needs to compute (no client-side de-duplication by `master_id`); it only needs to stop suppressing the `master` type and start rendering it distinctly. This directly satisfies FR-001 without inventing new grouping logic (Assumptions).

**Correction (post-implementation, verified against the live API)**: The first implementation sent `type=release,master` on the assumption Discogs' `type` param accepts a comma-list. It does not — Discogs' API only documents (and only honors) a single `type` value; a comma-joined value is neither rejected nor parsed as multiple types, and Discogs falls back to returning **all** types unfiltered (including `artist`/`label`), which crashed `mapSearchResult`'s strict type enum in production (`DiscogsValidationError` → `500`). Fixed by leaving `type` unset entirely for a release-scoped search (equivalent in effect, since Discogs' unfiltered response already includes both `release` and `master` hits) and doing the `release`/`master` keep-filter defensively in `searchCatalog`, dropping any other raw type instead of letting it reach the mapper.

**Alternatives considered**:
- *Fetch `type=release` results and group client-side by each release's `master_id`*: rejected — the search hit for an individual release does not reliably expose `master_id` (only the release detail endpoint does), and this would require an extra detail lookup per result just to discover grouping, defeating the "minimize redundant Discogs requests" constitution principle (Principle II).
- *Issue two separate paginated queries (`type=release` and `type=master`) and merge*: rejected — breaks Discogs' own pagination/ranking and risks showing a release and its master as two separate cards for the same work.
- *`type=release,master` comma-list*: rejected after live verification — not honored by Discogs (see Correction above).

## Decision 2: Data model shape for a `master` search hit

**Decision**: Extend the existing `resultType` union (`'release' | 'artist'`) with `'master'`, and extend the raw search-result schema's `type` enum accordingly. A `master`-type hit is mapped using the same fields already extracted for a `release` hit (`id`, `title`, `thumb`/`cover_image`, `year`, `format`) — Discogs' master search hits carry their own representative `year`/`format`, so no extra per-card Discogs call is needed to populate those fields. If a field is absent on the hit, it is simply omitted from the card, exactly like today's release cards (spec Clarifications: "the master's own representative values as provided by the catalog").

**Rationale**: Reuses the existing mapper shape/pattern (`discogsMapper.mapSearchResult`) instead of introducing a parallel one, keeping Principle II's modularity intent and avoiding N+1 calls against a search page rendering up to 20 cards.

## Decision 3: Rating enrichment for a grouped (master) card

**Decision**: Extend `enrichWithRating` to also handle `resultType === 'master'`. For a master hit, resolve its main/key release id via a cached `GET /masters/{master_id}` lookup, then fetch that release's community rating via the existing `getReleaseRating(discogsReleaseId)` (already cached, already timeout-bounded at 2s, already degrades to "omit the badge" on failure). Both steps run inside the same `Promise.all` fan-out already used for per-page enrichment, so a slow/failed master rating lookup never blocks or delays the rest of the results grid.

**Rationale**: Discogs does not expose a master-level rating endpoint — ratings only exist per release (confirmed in the API doc: `Release Rating By User`, `Community Release Rating` are both scoped to `/releases/{release_id}`). The spec's clarified answer ("show the rating of the master's main/key release") is only reachable through this two-hop lookup. Caching the master lookup (see Decision 6) keeps the second hop cheap on repeat views of the same search.

**Alternatives considered**:
- *Never show a rating on master cards*: rejected by the spec clarification.
- *Average ratings across all versions*: rejected by the spec clarification, and would require fetching every version's rating (expensive, rate-limit risk).

## Decision 4: New catalog detail endpoints (backend)

**Decision**: Add two read-only, authenticated backend endpoints mirroring the existing `GET /api/discogs/releases/:discogsId` pattern:
- `GET /api/discogs/masters/:discogsId` → master detail (wraps Discogs `GET /masters/{master_id}`).
- `GET /api/discogs/masters/:discogsId/versions?page=&perPage=` → paginated version list (wraps Discogs `GET /masters/{master_id}/versions{?page,per_page}`), defaulting `perPage` to 10 to match FR-009 directly at the API boundary rather than paginating client-side.

**Rationale**: Discogs already provides master detail and a paginated versions listing; proxying them 1:1 (same auth/error/cache conventions as the existing release endpoint) satisfies FR-008/FR-009 with no new pagination logic to write or test.

## Decision 5: Master resource shape differs from Release — no forced reuse

**Decision**: Model `MasterRelease` as its own type (not a variant of `Release`). It shares some fields with `Release` (`title`, `year`, `artists`, `genres`, `styles`, `images`, `tracklist`) but has no `labels`, `formats`, `identifiers`, `community`, or `country` (those are per-version concepts on Discogs, not per-master). The master detail page reuses `ReleaseImageGallery` and `ReleaseTracklistSection` as-is (same shape) and gets a new, leaner details section for the master-only fields, instead of forcing `ReleaseDetailsSection`/`ReleaseAdditionalInfoSection` to accept a shape they don't match.

**Rationale**: Matches Principle IV (SOLID/Interface Segregation) — a component shouldn't accept a payload shape it doesn't fully use. Reusing the two components whose data actually is shared (images, tracklist) avoids duplication (Principle III) without forcing an artificial shared interface on the rest.

## Decision 6: Caching strategy for new endpoints

**Decision**: Reuse the existing `withCache` cache-aside helper (Redis, fail-soft, single-flight) for both new endpoints, at TTLs consistent with existing conventions:
- Master detail: 6 hours (same as `RELEASE_CACHE_TTL_SECONDS` — master metadata is effectively immutable once published, same rationale as release detail).
- Master versions page: 6 hours, keyed by `master_id:page:perPage` (new pressings are added to a master infrequently; matching the release-detail TTL avoids inventing a new cache-lifetime tier).

**Rationale**: Keeps the caching model uniform and auditable (one TTL policy per "how often does this class of data change" bucket, as already established for release/artist/search).

## Decision 7: Frontend routing and back-navigation

**Decision**: Add two new routes under the existing authenticated app shell:
- `/app/releases/:discogsId` — release detail page (catalog data, distinct from the existing `/app/library/records/:entryId`, which is a user's owned library entry).
- `/app/masters/:discogsId` — master release detail page.

Navigation into either page carries the originating path via React Router `Link` `state` (`{ from: <path> }`) rather than relying on browser history (`navigate(-1)`), matching the app's existing `BackLink`-with-fixed-`to`-prop convention already used by `RecordDetailPage`. Each detail page reads `location.state?.from` for its `BackLink`'s `to`, falling back to `/app/search` when absent (direct URL load, bookmark, or refresh — spec Clarifications). A release opened from within a master's version table receives `from` pointing at the master detail page's current URL (including its version-table page number), so back-from-release lands back on the same version-table page (Edge Cases).

**Rationale**: This is a page-to-page navigation model (no modal), so the existing fixed-destination `BackLink` pattern generalizes cleanly; using router `state` keeps the "state to return to" explicit and testable, rather than depending on ambient browser history which is unreliable (e.g. after a refresh) and inconsistent with how `RecordDetailPage` already works.

## Decision 8: Stacked-covers visual treatment

**Decision**: The grouped-card visual is a fixed 2-layer "shadow stack" behind the primary cover image (two smaller, slightly offset rounded rectangles peeking out from behind the top image, styled with the existing card border/shadow tokens), applied uniformly regardless of how many versions the master actually has (2 vs. 200 renders identically). It is a pure presentational variant of the existing card image block — no new data is needed to render it beyond knowing `resultType === 'master'`.

**Rationale**: Keeps the visual affordance simple and constant-cost (SC-002: recognizable "multiple editions" at a glance) without needing to fetch or count actual sibling releases just to decide how many layers to draw — that would require an extra Discogs call per card purely for a decorative detail.

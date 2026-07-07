# Phase 0 Research: Search Result Filters

All open questions from the spec's Technical Context were resolved during
`/speckit-clarify` (see `spec.md` → `## Clarifications`). This document
records the resulting decisions and the alternatives considered, plus a
handful of implementation-adjacent decisions needed to execute Phase 1.

## Decision: Reuse the existing `/database/search` integration, extended with filter params

**Rationale**: The backend already proxies catalog search through
`discogsClient.searchCatalog()` → `GET /database/search` (see
`backend/src/discogs/discogsClient.ts:158-194`), which is exactly the
endpoint documented in the supplied Discogs API PDF, including the
`artist`, `genre`, `style`, and `format` query parameters used for
filtering. No new endpoint or client is needed — `SearchCatalogOptions` and
the Discogs request `params` object are extended with four new optional
string fields.

**Alternatives considered**:
- Introduce a separate "filtered search" endpoint/client — rejected: violates
  spec FR-009 and Constitution Principle II (Discogs Integration-First &
  Modularity: reusable, non-duplicated integration modules).

## Decision: Filters submit via an explicit "Apply filters" action

**Rationale**: Confirmed in clarification session 2026-07-07. Firing a
Discogs request on every keystroke across four text fields would multiply
outbound Discogs calls well beyond the existing query-only search, working
against Constitution Principle II's rate-limit-aware requirement. An
explicit apply action (button, or Enter-to-submit within the filter panel)
keeps the request volume identical in shape to today's "type query, hit
enter/submit" pattern.

**Alternatives considered**:
- Live/debounced search as filters change — rejected per clarification (risk
  of excessive Discogs calls, unpredictable request timing).

## Decision: All four filters (Artist, Genre, Style, Format) are free text

**Rationale**: Confirmed in clarification session 2026-07-07, after
determining that Discogs' documented API (the supplied PDF) has no
endpoint to enumerate valid genres/styles/formats, and that Artist cannot
be enumerated at all (millions of values). Keeping all four fields free
text avoids introducing an unsupported "value list" integration and keeps
the fields consistent with how the existing search query box already
behaves (plain text, passed through to Discogs).

**Alternatives considered**:
- Constrained dropdowns sourced from a static/curated list — rejected: no
  documented Discogs endpoint backs this, and it was explicitly reversed in
  the final clarification exchange.
- Deriving dropdown options from the current result set (facet-style) —
  not selected; superseded once all four fields were confirmed free text.
- Artist as a searchable autocomplete — not selected; superseded by the
  "all four free text" confirmation.

## Decision: Filter state lives in the results screen URL

**Rationale**: `useSearchQueryParams` / `buildSearchPath`
(`frontend/src/hooks/useSearchQueryParams.ts`) already put `q` and `page` in
the URL so that reload/share/back-forward reproduce the same results (spec
FR-006/FR-007 require the same for filters). Extending the same hook with
`artist`/`genre`/`style`/`format` params keeps a single, consistent
mechanism for "state that must survive navigation" rather than introducing
component state or a separate persistence mechanism.

**Alternatives considered**:
- Component-local React state only — rejected: would not survive pagination
  navigation (`goToPage` does a full URL navigate today) or a page reload,
  failing FR-006/FR-007.

## Decision: Extend the Redis cache-aside key with active filter values

**Rationale**: `searchCatalog()` cache-keys on
`` `discogs:search:${resultType}:${query}:${page}:${perPage}` ``
(`backend/src/discogs/discogsClient.ts:169`). Without including the filter
values in this key, a filtered and an unfiltered search for the same query
would incorrectly share a cached response. The key must be extended to
include the (normalized, order-stable) filter values.

**Alternatives considered**:
- Bypass cache entirely when filters are active — rejected: unnecessarily
  loses the existing cache-aside benefit (Constitution Principle II:
  "reduce redundant Discogs requests") for a case (filtered search) that is
  exactly as cacheable as the unfiltered case.

## Decision: No new validation beyond trim-and-drop-empty

**Rationale**: Spec FR-010 requires trimming and treating whitespace-only
values as unset; beyond that, filter values are opaque strings forwarded to
Discogs as-is (matching how the search query itself is already handled —
`searchCatalog` only checks `query.trim()`, no further validation).
Discogs' own search is tolerant of non-matching filter values (returns zero
results rather than erroring), so no additional client- or server-side
validation is required.

**Alternatives considered**:
- Validate genre/style/format against a fixed enum — rejected: no such enum
  exists in this codebase or in the documented API; would contradict the
  "all four free text" decision above.

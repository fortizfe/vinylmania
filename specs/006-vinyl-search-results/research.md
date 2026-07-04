# Phase 0 Research: Vinyl Search Results — Cards, Actions & Pagination

All Technical Context fields were resolvable from the existing codebase and
the clarifications resolved during `/speckit-specify`. No `NEEDS
CLARIFICATION` markers remain. This document records the concrete decisions.

## 1. Pagination mechanism

- **Decision**: Reuse Discogs' own server-side pagination end to end. The
  backend's `searchCatalog(query, { resultType, page, perPage })` already
  accepts `page`/`perPage` and returns `{ pagination: { page, pages, items,
  perPage } }` — today's `/api/discogs/search` route simply doesn't forward
  those query params yet. Each UI "page" of results maps to one Discogs API
  page; navigating pages triggers a new search request rather than slicing an
  already-fetched larger set.
- **Rationale**: This is already-built, tested infrastructure (confirmed by
  reading `discogsClient.ts` and its existing contract test) — wiring it up
  is a small, additive change instead of building client-side pagination over
  a large fetched result set (which Discogs' API isn't designed to return in
  one call anyway — it's paginated remotely).
- **Alternatives considered**: Fetching a large page from Discogs (e.g. 200
  results) and paginating client-side (rejected — larger, slower initial
  fetch, and duplicates pagination logic Discogs already provides); a
  "load more" infinite-scroll pattern instead of discrete pages (rejected —
  the spec explicitly asks for a "listview"-like, page-based experience to
  avoid large scroll, and the clarified grid layout pairs naturally with
  discrete pages + Previous/Next, matching `LibraryListPage`'s existing
  pattern).
- **Default page size**: 20 results per page (`perPage=20`), matching
  `LibraryListPage`'s existing `pageSize` for visual/behavioral consistency
  across the app. A configurable page-size control is optional per the
  spec's Assumptions and is not required for this feature to be complete.

## 2. Artist / title parsing

- **Decision**: Parse the artist out of Discogs' combined `"Artist - Title"`
  search-result convention inside the backend's `mapSearchResult` (in
  `discogsMapper.ts`), adding a new optional `artist` field to
  `CatalogSearchResult`, and trimming the artist prefix from `title` when the
  split succeeds. When no `" - "` separator is found, `title` is left as the
  full original string and `artist` is omitted.
- **Rationale**: Confirmed via the raw Discogs search schema
  (`rawSearchResultSchema` in `discogsMapper.ts`) that the raw API response
  has no separate artist field for search results — only the combined
  `title` string. `discogsMapper.ts` is already the single place responsible
  for shaping Discogs' raw shapes into this app's domain types (it does the
  same job for full releases via `mapRelease`), so this is the correct,
  single-source-of-truth location rather than duplicating parsing logic in
  the frontend.
- **Alternatives considered**: Parsing on the frontend inside
  `SearchResultCard` (rejected — duplicates a Discogs-specific convention
  outside the layer that already owns Discogs response shaping, and every
  future consumer of search results would have to reimplement it); calling
  Discogs' full release lookup for every search result to get a structured
  artist array (rejected — one extra API call per result just to split a
  string, far too expensive for a results grid).

## 3. Preview details endpoint

- **Decision**: Add `GET /api/discogs/releases/:discogsId` to
  `backend/src/routes/discogs.ts`, calling the existing (already implemented,
  currently unused-by-any-route) `getRelease(discogsReleaseId)` from
  `discogsClient.ts` and returning the same `Release` shape already used
  inside `EnrichedLibraryEntry.release` for library entries. Requires
  authentication (`requireAuth`), matching `/api/discogs/search`'s existing
  security posture. Errors follow the exact existing convention used
  elsewhere in the codebase: `DiscogsNotFoundError` → 404
  `release_not_found` (same shape as the existing 404 in
  `routes/library.ts`), `DiscogsRateLimitError`/`DiscogsUnavailableError` →
  502 `catalog_unavailable`, anything else → 500 `internal_error`.
- **Rationale**: `getRelease()` already exists and is fully implemented
  (used internally when enriching library entries) — it was simply never
  exposed as its own route because nothing needed to preview a release
  before adding it. Reusing it is the smallest possible change; reusing the
  existing `Release` type means the frontend can reuse its existing
  rendering knowledge (the same fields `RecordDetailPage` already displays)
  for the new preview overlay.
- **Alternatives considered**: Building a separate, preview-specific,
  trimmed-down response shape (rejected — `Release` already has everything a
  preview needs, and a second shape would mean two mapping paths for the same
  underlying Discogs release data); letting the frontend call Discogs
  directly (rejected — violates the existing architecture where only the
  backend talks to Discogs, and would expose the Discogs token to the
  browser).

## 4. Preview presentation (overlay)

- **Decision**: Add a new generic `Modal` atomic component
  (`frontend/src/components/ui/Modal.tsx`) — a centered overlay on a
  semi-transparent backdrop, closable via a close button, backdrop click, or
  Escape key, with `role="dialog"` and `aria-modal="true"`. A
  `ReleasePreviewModal` component composes `Modal` with the actual release
  content (cover, title, artists, tracklist), reusing the same presentational
  approach `RecordDetailPage` already uses for a release's details.
- **Rationale**: No overlay/dialog primitive exists yet in
  `components/ui/`, but the constitution's atomic-component list already
  anticipates exactly this kind of addition (reusable, encapsulated
  components); a modal is the correct pattern for the resolved clarification
  ("preview without navigating away"). Keeping `Modal` generic (no
  release-specific knowledge) means it can be reused by any future feature
  needing an overlay, while `ReleasePreviewModal` stays the one place that
  knows how to render a `Release`.
- **Alternatives considered**: A third-party headless dialog library (e.g.
  Radix/Headless UI) (rejected — a single, simple modal doesn't justify a new
  dependency per Principle III; the existing atomic components in this app
  are all hand-built with Tailwind utilities only); an inline expanding
  panel within the grid instead of an overlay (rejected — the resolved
  clarification specifically asked for an overlay so the collector's grid
  position/scroll isn't disturbed).

## 5. Card actions ("botonera")

- **Decision**: Add `ResultCardActions.tsx`, a small component rendering
  exactly two icon buttons (add, preview) built on the existing `Button`
  atomic component (`variant="secondary"`, icon-only sizing), taking
  `onAdd`/`onPreview` callbacks and an `adding`/`added` state as props. Icons
  are small inline SVGs (no new icon-library dependency — see plan.md's
  Technical Context). `SearchResultCard` renders one `ResultCardActions`
  instance per result.
- **Rationale**: This directly matches the user's own suggestion ("considera
  si es oportuno crear un componente separado tipo botonera") and satisfies
  FR-005 (actions presented consistently across every card) by centralizing
  their markup/behavior in one place instead of repeating two buttons' worth
  of JSX inside every card.
- **Alternatives considered**: Inlining the two buttons directly inside
  `SearchResultCard` (rejected — the user's own suggestion is the better
  design here, and it keeps `SearchResultCard` focused on layout/data display
  rather than action wiring); a generic icon-library dependency for the two
  icons (rejected — see plan.md, Principle III).

## 6. Post-add feedback (no navigation)

- **Decision**: `AddRecordPage` no longer calls `navigate('/app')` after a
  successful add. Instead, the specific card that was added tracks an
  `added` boolean (alongside the existing per-card `addingId` busy state) and
  its `ResultCardActions` shows a confirmed/"added" visual state instead of
  the add button, while the rest of the grid and current page remain exactly
  as they were.
- **Rationale**: Directly implements the resolved clarification (Q1: stay on
  results after adding) and FR-012.
- **Alternatives considered**: A global toast/snackbar notification instead
  of a per-card state change (rejected — a per-card state is simpler, doesn't
  require introducing a new global notification system, and keeps the
  feedback co-located with the action that caused it, per Principle III).

## Outcome

All unknowns are resolved. No `NEEDS CLARIFICATION` markers remain. Proceeding
to Phase 1 design (data-model.md, contracts/, quickstart.md).

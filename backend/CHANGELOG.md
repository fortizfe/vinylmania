# Changelog

All notable changes to the Vinylmania backend are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/) independently
of the `frontend` package. Every entry below is already deployed — this project
has no `[Unreleased]` staging section, since Vercel deploys `main` on every
merge, so a changelog entry and its version bump land in the same PR.

## [0.13.1] - 2026-07-12

### Fixed

- Metal Storm's News category articles now show their band/album photo on the Dashboard, matching Metal Injection, MetalSucks, and Louder Sound. Metal Storm's feeds don't use the Media RSS extension as originally suspected — the News feed instead carries images via a non-standard `data-image-url` attribute on `<a class="ms-link">` anchors, using a relative path resolved against the source's feed URL. Reviews, Interviews, Articles, and Staff Picks categories carry no image data in their raw feeds at all, so they correctly continue to show the existing placeholder (spec 036).

## [0.13.0] - 2026-07-11

### Added

- MetalSucks (`https://feeds.feedburner.com/Metalsucks`) and Louder Sound (`https://www.loudersound.com/feeds.xml`) are now enabled Dashboard feed sources, merged into the existing "News" category alongside Metal Injection and subject to the same graceful per-source degradation as every other feed (feature 033).

### Changed

- `FeedSourceConfig` and `sourceStatuses` entries in `GET /api/feeds/dashboard` now carry a `priority` boolean flag, `true` for Metal Injection, MetalSucks, and Louder Sound and `false` for every other configured source. The flag only determines source-filter display order on the frontend — it has no effect on article ordering, card size, or prominence (feature 033).

## [0.12.0] - 2026-07-11

### Added

- `PATCH /api/auth/preferences` lets a signed-in user save an explicit theme preference (`"light"` or `"dark"`), persisted as a new optional `themePreference` field on their existing `users/{uid}` Firestore document — no new collection, and a preferences-only write never touches any other profile field (feature 031). `POST /api/auth/session` and `GET /api/auth/me` now include `themePreference` in their response when it has been set; it is simply absent for users who have never made an explicit choice.

## [0.11.0] - 2026-07-10

### Added

- The shared Discogs catalog HTTP client (`searchCatalog`, `getRelease`, `getMasterRelease`, `getMasterReleaseVersions`, `getArtist`) now automatically retries a transient failure (rate-limited/429 or unavailable/5xx/network) up to 2 times with increasing backoff before giving up, so a momentary Discogs hiccup no longer surfaces as a "catalog service busy" error during search or master release browsing — including the background library-enrichment path, which benefits transitively (feature 029). Non-transient failures (not found, invalid request, rejected credentials) are never retried. A new in-memory circuit breaker temporarily fails fast, app-wide, when failures spike broadly, so retries don't amplify load during a genuine outage. Community-rating enrichment keeps its existing fail-soft/short-timeout behavior untouched.
- 401/403 responses from the Discogs catalog client now map to `DiscogsAuthError` (previously indistinguishable from a generic unavailable failure), mirroring the existing collection-client classification.
- Structured logs now record how many attempts a catalog request took (`meta.attempts`) and a new `circuit_open` outcome, so recovered-after-retry and failed-after-exhaustion requests are distinguishable from operational logs.

## [0.10.0] - 2026-07-08

### Changed

- `GET /api/discogs/search` now orders each page's response so `master`-type results precede all other results, best-effort and per-page only — no additional Discogs requests are made to enforce ordering across pages (feature 027). Relative order within the masters group and within the rest of the results is unchanged; a page with no masters is unaffected.

## [0.9.0] - 2026-07-08

### Added

- `GET /api/discogs/masters/:discogsId` and `GET /api/discogs/masters/:discogsId/versions` (feature 026), returning a master release's detail and a paginated (10-per-page default) list of its release versions, following the same auth/error/caching conventions as the existing `/releases/:discogsId` endpoint.

### Changed

- `GET /api/discogs/search` no longer restricts a release-scoped search to Discogs `type=release`; the outbound `type` filter is now left unset (Discogs' `type` param only documents a single value, not a comma-list) and the response is filtered to `release`/`master` hits on our side, so releases that belong to a master release group are returned as a single `master`-type result instead of one `release`-type hit per version (feature 026). `CatalogSearchResult.resultType` gains a `'master'` value. A `master` result's `communityRating`, when present, reflects its main/key release's rating (Discogs has no master-level rating endpoint).

## [0.8.0] - 2026-07-08

### Added

- Five new Metal Storm feed sources for the Dashboard (feature 025): News, Reviews, Interviews, Articles, and Staff Picks, each fetched from its own direct RSS/XML endpoint (`metalstorm.net/rss/*.xml`). These replace the previous single, disabled `metal-storm` config entry that pointed at Metal Storm's Cloudflare-protected feed-listing page.

### Changed

- Each Dashboard category now returns up to the 10 most recent articles (previously 3-5), sorted by publish date descending. When more than one feed source shares the same category label (e.g. Metal Injection's and Metal Storm's "News"), their articles are combined into a single category entry capped at 10 combined, not 10 per source.

## [0.7.0] - 2026-07-07

### Changed

- `GET /api/discogs/search` no longer recognizes the `artist` filter query
  param (feature 022): the classification is MINOR, not MAJOR, because
  requests that still send `artist` are not rejected — the value is simply
  ignored (no error), so no existing consumer's requests start failing. The
  Redis cache-aside key for search results no longer includes an `artist`
  segment.
- The `format` filter query param now supports a comma-joined multi-value
  string (e.g. `format=Vinyl,CD`) forwarded verbatim, unchanged, to the
  underlying Discogs `GET /database/search` request in a single call (feature
  022). Verified against the live Discogs API during implementation: this
  produces AND-matching (releases available in all listed formats
  simultaneously), not OR-matching — see `specs/022-search-filter-refinements/research.md`.

## [0.6.0] - 2026-07-07

### Added

- `GET /api/discogs/search` now accepts four optional filter query params —
  `artist`, `genre`, `style`, `format` — forwarded, unchanged and trimmed, to
  the underlying Discogs `GET /database/search` request as additional search
  criteria (feature 021). Blank/whitespace-only values are treated as unset
  and excluded from the outbound request. The Redis cache-aside key for
  search results now includes the active filter values so filtered and
  unfiltered searches for the same query never collide in the cache.

## [0.5.0] - 2026-07-06

### Added

- `GET /api/discogs/search` now additively enriches each release-type result
  with an optional `communityRating: { average, count }` block (feature 017),
  fetched from Discogs' `GET /releases/{id}/rating` endpoint and cached for
  30 minutes. Enrichment runs per-release, in parallel, with a 2-second
  timeout per lookup; a lookup that fails, times out, or resolves with zero
  votes simply omits `communityRating` from that result — the base search
  response is never blocked, delayed past the timeout budget, or failed as a
  whole because of a rating-enrichment problem. Existing consumers that
  ignore unknown fields are unaffected.

### Changed

- `LogOutcome` gained an `omitted` value for structured logging of per-result
  rating-enrichment degradation.

## [0.4.0] - 2026-07-06

### Added

- Library is now synchronized with the linked user's Discogs collection
  (feature 016). `GET /api/library` triggers a sync-on-read against the
  Discogs collection API (OAuth-signed, throttled by a 5-minute Redis marker;
  `?refresh=true` forces an immediate re-sync). On first sync the existing
  Firestore library entries are union-merged into the Discogs collection and
  pre-016 `condition`/`notes` values are migrated to the matching Discogs
  custom fields per-entry (media condition maps to the Discogs grading
  vocabulary; anything unmappable is appended verbatim to notes). Subsequent
  syncs treat Discogs as the sole source of truth.
- New `GET /api/library/:id` enriches the entry with fresh per-copy data
  fetched from the Discogs collection instance.
- `PATCH /api/library/:id` writes one per-copy field at a time (rating via
  the instance endpoint, media/sleeve condition and notes via the custom-fields
  endpoint). Each write is confirmed by Discogs before the response is sent.
- New `backend/src/discogs/collection/` module: `collectionClient.ts`
  (OAuth-signed Discogs collection client), `collectionTypes.ts`, and
  `conditionGrading.ts` (closed Discogs grading vocabulary + legacy mapping).
- `invalidateCache(key)` helper in `cacheAside.ts`.
- Structured logging for all sync outcomes: `sync_completed`,
  `first_sync_migrated`, `entry_added`, `entry_removed`, `entry_removed`,
  auth failures, and rate-limit metadata.

### Changed

- **BREAKING**: `POST /api/library` body now accepts only
  `{ discogsReleaseId: number }`. The previously accepted `condition` and
  `notes` fields are rejected with `400 invalid_request`.
- **BREAKING**: `PATCH /api/library/:id` body is now
  `{ rating?, mediaCondition?, sleeveCondition?, notes? }`. The previous
  `{ condition, notes }` shape is rejected with `400 invalid_request`.
- **BREAKING**: All library entry responses now include a `discogs` object
  (`instanceId`, `folderId`, `rating`, `mediaCondition`, `sleeveCondition`,
  `notes`, `editable`) in place of the previous top-level `condition` and
  `notes` fields.
- All library endpoints now require an active Discogs connection. Without one
  they return `409 discogs_not_linked`; revoked credentials return
  `401 discogs_link_invalid`.
- `LibraryEntry` Firestore documents gain `discogsInstanceId` and
  `discogsFolderId`; the legacy `condition` and `notes` fields are deleted
  per-entry after confirmed migration (first sync only).
- `discogsConnections/{uid}` gains `initialLibrarySyncAt` to track first-sync
  completion; absent ⇒ next sync runs in union-merge mode.

### Migration

Existing library entries that carry `condition`/`notes` will be migrated
automatically on first library load by each user after this deployment.
No manual data-migration step is required; the migration is per-entry and
resumable (a failure on one entry retries on the next load; the entry retains
its legacy fields until the Discogs write succeeds).

## [0.3.0] - 2026-07-06

### Added

- Discogs account linking via OAuth 1.0a (feature 015): new authenticated
  endpoints `POST /api/discogs/oauth/request`, `POST /api/discogs/oauth/complete`,
  `GET /api/discogs/oauth/status`, and `DELETE /api/discogs/oauth/connection`.
  The flow uses Discogs' PLAINTEXT signature over HTTPS, verifies the linked
  identity against `/oauth/identity`, and persists at most one connection per
  user in the new `discogsConnections/{uid}` Firestore collection (pending
  attempts live in `discogsOAuthRequests/{oauthToken}` with a 15-minute
  validity window). User access tokens never leave the backend; the app's
  consumer key/secret are read exclusively from environment variables
  (`DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET`,
  `DISCOGS_OAUTH_CALLBACK_URL`). Linking lifecycle events are logged as
  structured `link_started` / `link_completed` / `link_failed` /
  `disconnected` outcomes.

## [0.2.0] - 2026-07-04

### Added

- Widened the Discogs `Release` model with `releaseDate`, `notes`,
  `identifiers`, and `community` statistics (have/want counts, rating),
  mapped from the Discogs `/releases/{id}` response and returned from
  `GET /api/discogs/releases/:discogsId`.

## [0.1.0] - 2026-07-04

### Added

- Redis (via ioredis) response caching for the Discogs catalog client
  (`searchCatalog`, `getRelease`, `getArtist`), including the per-entry
  release lookups made during library-list enrichment. Falls back to
  fetching directly from Discogs if Redis is unconfigured or unavailable, so
  a cache outage never fails a request.

## [0.0.1] - 2026-07-04

### Added

- Discogs catalog API client and vinyl data model.
- Vinyl library CRUD endpoints with Discogs metadata enrichment.

### Changed

- Split Vercel deployment into a dedicated backend project, separate from the
  frontend.

### Fixed

- Removed an invalid pinned runtime from the backend's `vercel.json`.

# Changelog

All notable changes to the Vinylmania backend are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/) independently
of the `frontend` package. Every entry below is already deployed — this project
has no `[Unreleased]` staging section, since Vercel deploys `main` on every
merge, so a changelog entry and its version bump land in the same PR.

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

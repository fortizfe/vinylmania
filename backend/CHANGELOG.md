# Changelog

All notable changes to the Vinylmania backend are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/) independently
of the `frontend` package. Every entry below is already deployed — this project
has no `[Unreleased]` staging section, since Vercel deploys `main` on every
merge, so a changelog entry and its version bump land in the same PR.

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

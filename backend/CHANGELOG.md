# Changelog

All notable changes to the Vinylmania backend are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/) independently
of the `frontend` package. Every entry below is already deployed — this project
has no `[Unreleased]` staging section, since Vercel deploys `main` on every
merge, so a changelog entry and its version bump land in the same PR.

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

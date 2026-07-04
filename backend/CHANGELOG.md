# Changelog

All notable changes to the Vinylmania backend are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/) independently
of the `frontend` package.

## [Unreleased]

### Added

- Redis (via ioredis) response caching for the Discogs catalog client
  (`searchCatalog`, `getRelease`, `getArtist`), including the per-entry
  release lookups made during library-list enrichment. Falls back to
  fetching directly from Discogs if Redis is unconfigured or unavailable, so
  a cache outage never fails a request.

## [1.0.0] - 2026-07-04

### Added

- Discogs catalog API client and vinyl data model.
- Vinyl library CRUD endpoints with Discogs metadata enrichment.

### Changed

- Split Vercel deployment into a dedicated backend project, separate from the
  frontend.

### Fixed

- Removed an invalid pinned runtime from the backend's `vercel.json`.

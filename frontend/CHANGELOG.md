# Changelog

All notable changes to the Vinylmania frontend are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/) independently
of the `backend` package.

## [Unreleased]

## [1.0.0] - 2026-07-04

### Added

- Landing page with Google Sign-In authentication.
- Discogs-backed vinyl search with card-based, paginated results and add/preview
  actions.
- Vinyl library management UI (add/view records from search results).
- App navigation with hamburger menu and dashboard.
- End-to-end (Playwright) test coverage for authentication flows, running
  against Firebase emulators without a real Google Sign-In.

### Changed

- Migrated the entire UI to a Tailwind CSS v4 design system (CSS-first theme,
  reusable `Card`/`Button`/etc. components, skeleton loading states, dark mode).
- Split Vercel deployment into a dedicated frontend project, separate from the
  backend.

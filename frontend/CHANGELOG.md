# Changelog

All notable changes to the Vinylmania frontend are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/) independently
of the `backend` package.

## [Unreleased]

### Changed

- Redesigned the record detail view into a responsive four-block layout
  (cover image, disc information, your copy, tracklist) that reflows between
  a single stacked column and a two-column layout based on available width.
- Replaced the "Your copy" Edit/Save/Cancel form with per-field inline
  editing: clicking/tapping the condition or notes value edits it in place,
  autosaves on blur/confirm, shows a brief save confirmation, and reverts on
  Escape without saving.
- Expanded the disc information block to show release year, format, and
  genre alongside the existing title and artist(s).

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

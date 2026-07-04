# Changelog

All notable changes to the Vinylmania frontend are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/) independently
of the `backend` package. Every entry below is already deployed — this project
has no `[Unreleased]` staging section, since Vercel deploys `main` on every
merge, so a changelog entry and its version bump land in the same PR.

## [0.4.0] - 2026-07-04

### Changed

- Redesigned the release preview popup's layout: the image gallery (cover
  plus vertical thumbnail carousel) now spans the full width of the popup in
  a square format; key release details (title, artist, genres, styles,
  release date, label) and the tracklist now sit side by side directly below
  it; notes, identifiers, and community stats moved into their own section
  below that. On mobile, the sections stack in the same reading order:
  gallery, key details, tracklist, then the remaining details.
- Hid the scrollbar on the thumbnail carousel and on the preview popup itself
  (content remains fully scrollable) for a cleaner, more modern appearance;
  other popups/modals in the app are unaffected.

## [0.3.0] - 2026-07-04

### Changed

- Redesigned the release preview popup (opened from a search result card):
  it now shows a full release-details section (label/catalogue number,
  country, release date, genres, styles, notes, identifiers, and community
  stats) above the tracklist, in a layout that splits into two columns on
  wide viewports and stacks into one column on mobile.
- Replaced the popup's single static cover image with an image gallery: a
  primary image plus a vertical, clickable thumbnail list built from every
  image Discogs returns for the release.

## [0.2.0] - 2026-07-04

### Added

- Client-side state caching for library and catalog reads using TanStack
  Query: revisiting the library list, a record's detail page, or a repeated
  Discogs search now renders instantly from cache instead of re-fetching, and
  a user's own edits/adds/removes invalidate the relevant cached data so
  changes are always reflected immediately.

## [0.1.0] - 2026-07-04

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

## [0.0.1] - 2026-07-04

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

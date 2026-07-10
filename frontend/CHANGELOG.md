# Changelog

All notable changes to the Vinylmania frontend are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/) independently
of the `backend` package. Every entry below is already deployed — this project
has no `[Unreleased]` staging section, since Vercel deploys `main` on every
merge, so a changelog entry and its version bump land in the same PR.

## [0.17.1] - 2026-07-09

### Changed

- Search results now load in batches of 40 instead of 20, so infinite scroll feels smoother with fewer loading pauses (feature 028).
- Search result cards (both master and release) now render at a consistent fixed height across the entire results grid; master cards show a "Multiple editions" label in place of the format badge and add-to-library action they omit, so the two card types match in footprint (feature 028).
- The stacked-covers visual effect on master (grouped) result cards is more pronounced — larger offsets and added shadow depth — so grouped results are clearly distinguishable from standalone releases at a glance (feature 028).
- Dashboard RSS feed article cards now render at a consistent fixed height within each carousel; titles and excerpts are clamped to 2 lines each instead of varying the card's height with content length (feature 028).

## [0.17.0] - 2026-07-08

### Added

- Search results now load via infinite scroll instead of Previous/Next pagination (feature 027): an initial batch of 20 results loads on search, and scrolling near the bottom automatically fetches and appends the next batch, with a loading indicator while fetching, a clear "no more results" message once exhausted, and an error message with a retry action if a batch fails to load. Changing the search query or a filter resets the list and restarts from the first batch.

### Changed

- The app header is now fixed (sticky) to the top of the viewport on every page, remaining visible and interactive at all scroll positions instead of scrolling away with page content (feature 027).
- Search result cards for master releases no longer show a format badge; standalone release cards are unaffected (feature 027).

## [0.16.0] - 2026-07-08

### Added

- Dedicated release and master release detail pages (`/app/releases/:discogsId`, `/app/masters/:discogsId`), reachable by clicking any search result (feature 026). The release detail page shows full catalog information plus an "Add to library" action; the master release detail page shows the same for the master plus a paginated (10-per-page) table of its release versions, each row linking to its own release detail page. Both pages provide a back action consistent with the rest of the app, returning to the exact prior search (query/filters/page) or master version-table page.
- Search results that belong to the same master release group now render as a single grouped card with a stacked-covers visual, distinguishing it from a standalone release card.

### Changed

- Clicking a search result card now navigates to its detail page instead of opening a quick-look preview.

### Removed

- The quick-look preview modal (`ReleasePreviewModal`) and its "Preview details" card action have been removed; the new detail pages are now the only way to see a search result's full information.

## [0.15.0] - 2026-07-08

### Changed

- The Dashboard no longer shows a "Dashboard" page heading — it opens straight into the category filter bar and content (feature 025).
- Each Dashboard category's articles now render as a horizontally-scrollable carousel (up to the 10 most recent, newest first) with keyboard-operable previous/next arrow controls, replacing the previous fixed grid layout. Individual article cards keep their existing appearance unchanged.

## [0.14.0] - 2026-07-08

### Changed

- The search filter bar has been reorganized to make Format the primary filter (feature 023): it now renders first, ahead of Genre and Style, and its trigger label live-updates to show the currently selected value(s) as they're chosen — a single value's name, a comma-separated list when it fits, or a "first (+N)" abbreviated form when it doesn't — all before "Apply filters" is clicked.
- Genre and Style now render at a more compact, fixed width, giving Format a larger share of the filter bar's horizontal space.
- The "Apply filters" and "Clear filters" actions are now icon-only, with no visible text label; each keeps a distinct, screen-reader-identifiable accessible name via `aria-label`.
- Internally, the filter bar's Format, Genre/Style, and Apply/Clear controls were split into independent, reusable components (`FormatFilter`, `TextFilterField`, `FilterActions`) under `src/components/filters/`, so future filters can be added without modifying existing ones.

## [0.13.0] - 2026-07-07

### Changed

- The search filter control's Artist field has been removed entirely (feature
  022); the main search query box is unaffected and continues to support
  searching by artist name as free text. A results link created before this
  change that still carries an `artist` value loads normally, with the value
  silently ignored.
- The Format filter is no longer free text: it is now a fixed, multi-select
  checklist of ~33 standard Discogs format names (e.g. Vinyl, CD, Cassette),
  opened from a compact trigger button. Selecting more than one format value
  narrows results to releases available in all of the selected formats
  simultaneously (verified against live Discogs data — this is AND matching,
  not OR). A results link carrying a format value no longer in the fixed list
  loads normally, with the unrecognized value silently dropped while other
  valid values remain applied.

## [0.12.0] - 2026-07-07

### Added

- The search results screen now has a filter control with four free-text
  fields — Artist, Genre, Style, and Format — submitted via an explicit
  "Apply filters" action (feature 021). Any combination of filters can be
  active at once, filters persist across pagination and in the results URL
  (so reloading or sharing a filtered URL reproduces the same results), and
  a "Clear filters" action resets to the unfiltered view in one step. A
  filtered search with no matches shows a message naming the active
  filters instead of the generic no-results message.

## [0.11.0] - 2026-07-07

### Added

- Three navigation destinations (Profile, My wishlist, My library) now
  render as separate, individually clickable flat outline icons on the
  right side of the header at viewport widths of 768px and above (feature
  020).

### Changed

- The hamburger menu is now shown only below the 768px breakpoint; at
  768px and above it is replaced by the new header nav icons (feature
  020). The menu's own destinations, links, and open/close behavior are
  unchanged below that breakpoint.

## [0.10.0] - 2026-07-07

### Changed

- Search-result and library cards now always show a rating badge (feature
  019). Releases with no community rating, an invalid rating, or a failed
  rating lookup show a dash ("-") on a soft gray background instead of
  leaving an empty gap where the badge would sit. Rated releases keep their
  existing numeric value and color band unchanged.

## [0.9.0] - 2026-07-06

### Added

- A search textbox is now always visible, centered in the app header, on
  every authenticated page (feature 018). Submitting a query navigates to a
  new `/app/search` results page showing matching Discogs catalog records as
  cards, with the same add-to-library, preview, and pagination behavior the
  former "Add a record" page had.

### Changed

- The header search box resets to empty whenever you navigate away from the
  search results page, so it doesn't carry a stale query onto unrelated
  pages.

### Removed

- The standalone "Add a record" page and its `/app/library/add` route are
  retired; searching is now reached from the header on any page instead.
- The "Add a record" link on the "My Library" page is removed, since the
  header search box replaces it.

## [0.8.0] - 2026-07-06

### Added

- Search-result and library cards now show a compact rounded-square rating
  badge in the thumbnail's upper-right corner whenever a release has a valid
  community rating (feature 017). The badge's background communicates the
  rating band — red for 0.00–2.50, yellow for 2.51–4.09, green for
  4.10–5.00 — and its text meets WCAG AA contrast (>=4.5:1) against all three
  bands. Cards with no valid, votable rating simply omit the badge; the
  overlay is purely presentational and never blocks add/preview/open-record
  interactions or shifts the surrounding layout.
- New `ReleaseRatingBadge` atomic component
  (`src/components/ui/ReleaseRatingBadge.tsx`) and a shared
  `src/lib/releaseRating.ts` helper (visibility rules, one-decimal
  formatting, band selection) reused by both `SearchResultCard` and
  `RecordCard`.
- New `--color-rating-low` / `--color-rating-medium` / `--color-rating-high`
  theme tokens in `src/styles/global.css`.

## [0.7.0] - 2026-07-06

### Added

- Library list page now synchronizes with the linked user's Discogs collection
  on load (feature 016). A **Refresh** button forces an immediate re-sync.
  Unlinked users see a gate card explaining they must link their Discogs
  account from their profile; users whose stored link becomes invalid see a
  "re-link your account" variant.
- Record detail page's **Your copy** panel is rebuilt around the Discogs
  per-copy data: a 5-star rating control (`StarRating`), media condition and
  sleeve condition dropdowns (exact Discogs grading vocabulary), and an
  inline-editable notes field. Each field autosaves on change. Controls are
  disabled with an explanatory hint when the matching Discogs custom field
  has been deleted by the user on discogs.com.
- New `StarRating` component (`src/components/ui/StarRating.tsx`): atomic
  5-star rating control, keyboard-accessible, dark-mode-aware, tapping the
  current value clears to 0.
- New `LibraryLinkRequired` component (`src/components/LibraryLinkRequired.tsx`)
  with two variants: `not-linked` (never connected) and `relink`
  (credentials revoked), both with a CTA to `/app/profile`.
- Add-record page surfaces Discogs gate errors (`discogs_not_linked`,
  `discogs_link_invalid`) with a link to the profile instead of a generic
  failure message.

### Changed

- **BREAKING**: `EnrichedLibraryEntry` no longer carries top-level
  `condition` or `notes` fields. They are replaced by a `discogs` object
  matching `EntryDiscogsData` (per the backend 0.4.0 contract).
- `useUpdateLibraryEntry` now invalidates all library queries on success
  (previously it only updated the single detail query in cache).
- Add-record flow sends only `{ discogsReleaseId }` — `condition` and `notes`
  are no longer accepted and the form no longer has those fields.

### Removed

- Legacy `CONDITION_OPTIONS` constant and free-text condition editing from
  `MyCopySection`. The component now uses the Discogs grading vocabulary
  exclusively.

## [0.6.0] - 2026-07-06

### Added

- Profile section now hosts a "Discogs" connection card (feature 015): link
  your Vinylmania account with your Discogs account through Discogs' own
  authorization page, see the linked Discogs username and link date at a
  glance, and disconnect with an inline confirmation (two interactions).
  A new `/app/profile/discogs/callback` route completes the return leg from
  Discogs and reports the outcome (linked, not completed, expired, or error)
  as a dismissible message on the profile. The card renders from stored
  state with a skeleton while loading, supports dark mode, and never shifts
  layout between states.

## [0.5.0] - 2026-07-05

### Changed

- Redesigned the record detail page to match the release preview's layout:
  a full-width square cover gallery with browsable thumbnails, key release
  details (title, artist, format, genres, styles, release date, label) and
  the tracklist side by side directly below it, and notes, identifiers, and
  community stats in their own section below that — all inside a single
  bordered container instead of several separate cards. On mobile, the
  sections stack in the same order: gallery, key details, my copy, tracklist,
  then the remaining details.
- Moved "Your copy" (condition and notes, inline-editable) into its own
  `MyCopySection` component, positioned directly below the key release
  details in the left column; all existing inline-edit behavior (autosave,
  Escape to cancel, save confirmation, editable-field affordance) and the
  "Remove from library" action are unchanged.
- Added the format field (e.g. "Vinyl (12\")") to the shared key-details
  presentation used by both the record detail page and the release preview,
  so no previously-visible information is lost by this redesign.

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

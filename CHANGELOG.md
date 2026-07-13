# Changelog

All notable changes to the Vinylmania project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/). Every
entry below is already deployed — this project has no `[Unreleased]` staging
section, since Vercel deploys `main` on every merge, so a changelog entry and
its version bump land in the same PR (or, from the unified scheme onward, are
generated automatically by CI as part of that same merge to `main`).

## Unified versioning

Starting at `0.22.1`, a single version applies to the whole project
(`backend` + `frontend`, in lockstep), computed automatically by CI from
Conventional Commits (see the project constitution's Development Workflow).
Entries in this section are added automatically by CI, newest first, above
the historical section below.

## [0.24.0] - 2026-07-13

### Added

- smooth Discogs rate limiting and reduce redundant calls (feature 040) ([e41005b])

### Fixed

- drop stale pinned-version assertion in lockstep test ([92770ba])

## [0.23.0] - 2026-07-13

### Added

- rebuild theme with warm-neutral palette and dual accent (feature 039) ([3ec93bd])
- rebuild filters as a shared collapsible component with selectable lists (feature 038) ([d2ca45d])

## Historical merged entries (backend + frontend, pre-unification)

Prior to `0.22.1`, `backend` and `frontend` each kept an independent
`CHANGELOG.md` and version number (both files are preserved as frozen
historical archives at `backend/CHANGELOG.md` and `frontend/CHANGELOG.md`).
The entries below merge that combined history chronologically by each
entry's original date; every heading keeps its entry's real historical
version and states which package it came from — none of these versions are
retroactively renumbered into the unified scheme. Where multiple entries
share a date, they are ordered by the feature/spec number they implemented
(newest first); the handful of entries that predate feature numbering are
grouped by package, frontend before backend, since no finer chronological
signal exists for that initial backfill (see `research.md`).

## [0.22.1] - 2026-07-12 (frontend)

### Fixed

- The authenticated header's "Sign out" control moved into the existing hamburger menu below the `md:` breakpoint instead of always rendering in the header row, fixing a real layout overlap where it intercepted clicks on the search button at narrow (~375px) viewports; it remains unchanged in the header at `md:`+. Fixed a related overlap between the search submit button and the hamburger button, caused by the search input's flex wrapper not being allowed to shrink below its browser-default width. Fixed a bug where search-result card titles/artists could render at zero height on mobile once the results grid became single-column, by scoping the cards' fixed height to `sm:`+ and letting mobile cards size to their natural content height (spec 036).
- Nine stale/broken Playwright e2e tests (a heading assertion for UI that no longer exists, an ambiguous locator matching two elements, and a test fixture missing fields the real API always sends) were corrected to reflect the app's current behavior, restoring the e2e suite as a reliable quality gate (spec 036).
- `ReleaseAdditionalInfoSection` no longer crashes the page render if `identifiers` is unexpectedly missing from an API response (spec 036).

## [0.13.1] - 2026-07-12 (backend)

### Fixed

- Metal Storm's News category articles now show their band/album photo on the Dashboard, matching Metal Injection, MetalSucks, and Louder Sound. Metal Storm's feeds don't use the Media RSS extension as originally suspected — the News feed instead carries images via a non-standard `data-image-url` attribute on `<a class="ms-link">` anchors, using a relative path resolved against the source's feed URL. Reviews, Interviews, Articles, and Staff Picks categories carry no image data in their raw feeds at all, so they correctly continue to show the existing placeholder (spec 036).

## [0.22.0] - 2026-07-12 (frontend)

### Changed

- Every screen except the Dashboard (already conformant) now has a purpose-built desktop composition that uses the available horizontal space — multi-column grids on Landing, Search results, and My library; a three-panel layout on the record/release/master-release detail pages; and side-by-side panels on Profile — instead of a single centered column with unused space on wide monitors (spec 035).
- Every interactive control across those screens and the authenticated app header (buttons, links acting as buttons, filter chips, inputs, icon buttons, the hamburger menu's nav rows, and the Master Versions table's pagination) now measures at least 44×44 CSS px on mobile-width viewports, meeting WCAG 2.5.5. The fix is centralized in the shared `Button`, `Input`, `Checkbox`, `ThemeToggle`, `StarRating`, and `BackLink` components (spec 035).
- The Master Versions table on the master-release detail page now renders as a stacked card list below the `md:` breakpoint instead of a horizontally-scrollable table, eliminating horizontal scroll on mobile (spec 035).
- `LibraryLinkRequired`'s "Go to your profile" link now reuses the shared `Button` styling helper instead of duplicating it by hand (spec 035).

## [0.21.0] - 2026-07-11 (frontend)

### Changed

- Adopted the new Vinylmania brand mark across the app: a circular "VM" icon paired with an "VINYLMANIA" wordmark in the Anton display font, replacing the previous plain-text label. The authenticated header shows the icon alone below the `md:` breakpoint and the full icon+wordmark lockup at `md:`+ (fixed size, never scaling on wider viewports); the landing page's sticky header uses the same lockup, and the hero uses the larger stacked "general logo" with a distressed/grunge wordmark treatment. All placements track the app's existing light/dark theme with no flash of the wrong variant (feature 034).
- Replaced the browser-tab favicon with the new circular "VM" icon.

## [0.20.0] - 2026-07-11 (frontend)

### Changed

- The news Dashboard has been redesigned for usability: on desktop-width windows, articles now render in a responsive multi-column grid (up to 5 columns, capped for readability on ultra-wide monitors) instead of per-category horizontal carousels, with a sticky category+source filter bar. On mobile, the same grid collapses to a single scrollable column with a more compact card layout and 44×44px-minimum touch targets on every filter control (feature 033).
- A new source filter lets users narrow the Dashboard down to a single news source, combinable with the existing category filter; every configured source is listed, with Metal Injection, MetalSucks, and Louder Sound always shown first. Combined filters producing zero results now show a clear empty-state message (feature 033).
- Articles from the new MetalSucks and Louder Sound sources appear alongside Metal Injection with identical card size/prominence to any other source, distinguished only by their source badge (feature 033).

### Removed

- The horizontal-scroll carousel and per-category section layout (introduced in feature 025) have been removed in favor of the new responsive grid.

## [0.13.0] - 2026-07-11 (backend)

### Added

- MetalSucks (`https://feeds.feedburner.com/Metalsucks`) and Louder Sound (`https://www.loudersound.com/feeds.xml`) are now enabled Dashboard feed sources, merged into the existing "News" category alongside Metal Injection and subject to the same graceful per-source degradation as every other feed (feature 033).

### Changed

- `FeedSourceConfig` and `sourceStatuses` entries in `GET /api/feeds/dashboard` now carry a `priority` boolean flag, `true` for Metal Injection, MetalSucks, and Louder Sound and `false` for every other configured source. The flag only determines source-filter display order on the frontend — it has no effect on article ordering, card size, or prominence (feature 033).

## [0.19.0] - 2026-07-11 (frontend)

### Changed

- The landing page has been refreshed: it now scrolls through a hero and three sections highlighting the app's core pillars — the Discogs-backed catalog, personal ratings, and curated rock/metal news — each with an icon and short description. The "Sign in with Google" action now lives in a persistent (sticky) header, together with the Vinylmania wordmark, so it stays reachable at every scroll position and viewport size (feature 032).
- In dark mode, the landing page uses a new, darker rock/metal-inflected surface and accent palette layered on top of the existing design tokens; light mode reuses the existing tokens (feature 032).
- The app-wide primary color (`--color-primary`) was darkened slightly (from `#6366f1` to `#4f46e5`) so white text on primary-colored buttons meets the WCAG 2.1 AA 4.5:1 contrast minimum; this affects every primary button across the app, not just the landing page (feature 032).

## [0.18.0] - 2026-07-11 (frontend)

### Added

- A new "Preferences" section on the Profile page, whose first control is a modern sun (blue sky + clouds) / moon (night sky + stars) toggle for switching the whole app between light and dark mode instantly (feature 031). The chosen theme is saved to the signed-in user's account and applied automatically — with no visible flash — the next time they open the app on any device; users who never make an explicit choice keep following their operating system's setting. If saving the preference ultimately fails after a few retries, a dismissible notice lets the user know it may not have persisted, without blocking further use of the toggle.

### Changed

- Dark mode's neutral background, border, and surface colors are one step darker and more consistent across the app (cards, headers, skeletons, badges, and other UI), improving legibility while keeping text and interactive elements within WCAG 2.1 AA contrast (feature 031).

## [0.12.0] - 2026-07-11 (backend)

### Added

- `PATCH /api/auth/preferences` lets a signed-in user save an explicit theme preference (`"light"` or `"dark"`), persisted as a new optional `themePreference` field on their existing `users/{uid}` Firestore document — no new collection, and a preferences-only write never touches any other profile field (feature 031). `POST /api/auth/session` and `GET /api/auth/me` now include `themePreference` in their response when it has been set; it is simply absent for users who have never made an explicit choice.

## [0.11.0] - 2026-07-10 (backend)

### Added

- The shared Discogs catalog HTTP client (`searchCatalog`, `getRelease`, `getMasterRelease`, `getMasterReleaseVersions`, `getArtist`) now automatically retries a transient failure (rate-limited/429 or unavailable/5xx/network) up to 2 times with increasing backoff before giving up, so a momentary Discogs hiccup no longer surfaces as a "catalog service busy" error during search or master release browsing — including the background library-enrichment path, which benefits transitively (feature 029). Non-transient failures (not found, invalid request, rejected credentials) are never retried. A new in-memory circuit breaker temporarily fails fast, app-wide, when failures spike broadly, so retries don't amplify load during a genuine outage. Community-rating enrichment keeps its existing fail-soft/short-timeout behavior untouched.
- 401/403 responses from the Discogs catalog client now map to `DiscogsAuthError` (previously indistinguishable from a generic unavailable failure), mirroring the existing collection-client classification.
- Structured logs now record how many attempts a catalog request took (`meta.attempts`) and a new `circuit_open` outcome, so recovered-after-retry and failed-after-exhaustion requests are distinguishable from operational logs.

## [0.17.1] - 2026-07-09 (frontend)

### Changed

- Search results now load in batches of 40 instead of 20, so infinite scroll feels smoother with fewer loading pauses (feature 028).
- Search result cards (both master and release) now render at a consistent fixed height across the entire results grid; master cards show a "Multiple editions" label in place of the format badge and add-to-library action they omit, so the two card types match in footprint (feature 028).
- The stacked-covers visual effect on master (grouped) result cards is more pronounced — larger offsets and added shadow depth — so grouped results are clearly distinguishable from standalone releases at a glance (feature 028).
- Dashboard RSS feed article cards now render at a consistent fixed height within each carousel; titles and excerpts are clamped to 2 lines each instead of varying the card's height with content length (feature 028).

## [0.17.0] - 2026-07-08 (frontend)

### Added

- Search results now load via infinite scroll instead of Previous/Next pagination (feature 027): an initial batch of 20 results loads on search, and scrolling near the bottom automatically fetches and appends the next batch, with a loading indicator while fetching, a clear "no more results" message once exhausted, and an error message with a retry action if a batch fails to load. Changing the search query or a filter resets the list and restarts from the first batch.

### Changed

- The app header is now fixed (sticky) to the top of the viewport on every page, remaining visible and interactive at all scroll positions instead of scrolling away with page content (feature 027).
- Search result cards for master releases no longer show a format badge; standalone release cards are unaffected (feature 027).

## [0.10.0] - 2026-07-08 (backend)

### Changed

- `GET /api/discogs/search` now orders each page's response so `master`-type results precede all other results, best-effort and per-page only — no additional Discogs requests are made to enforce ordering across pages (feature 027). Relative order within the masters group and within the rest of the results is unchanged; a page with no masters is unaffected.

## [0.16.0] - 2026-07-08 (frontend)

### Added

- Dedicated release and master release detail pages (`/app/releases/:discogsId`, `/app/masters/:discogsId`), reachable by clicking any search result (feature 026). The release detail page shows full catalog information plus an "Add to library" action; the master release detail page shows the same for the master plus a paginated (10-per-page) table of its release versions, each row linking to its own release detail page. Both pages provide a back action consistent with the rest of the app, returning to the exact prior search (query/filters/page) or master version-table page.
- Search results that belong to the same master release group now render as a single grouped card with a stacked-covers visual, distinguishing it from a standalone release card.

### Changed

- Clicking a search result card now navigates to its detail page instead of opening a quick-look preview.

### Removed

- The quick-look preview modal (`ReleasePreviewModal`) and its "Preview details" card action have been removed; the new detail pages are now the only way to see a search result's full information.

## [0.9.0] - 2026-07-08 (backend)

### Added

- `GET /api/discogs/masters/:discogsId` and `GET /api/discogs/masters/:discogsId/versions` (feature 026), returning a master release's detail and a paginated (10-per-page default) list of its release versions, following the same auth/error/caching conventions as the existing `/releases/:discogsId` endpoint.

### Changed

- `GET /api/discogs/search` no longer restricts a release-scoped search to Discogs `type=release`; the outbound `type` filter is now left unset (Discogs' `type` param only documents a single value, not a comma-list) and the response is filtered to `release`/`master` hits on our side, so releases that belong to a master release group are returned as a single `master`-type result instead of one `release`-type hit per version (feature 026). `CatalogSearchResult.resultType` gains a `'master'` value. A `master` result's `communityRating`, when present, reflects its main/key release's rating (Discogs has no master-level rating endpoint).

## [0.15.0] - 2026-07-08 (frontend)

### Changed

- The Dashboard no longer shows a "Dashboard" page heading — it opens straight into the category filter bar and content (feature 025).
- Each Dashboard category's articles now render as a horizontally-scrollable carousel (up to the 10 most recent, newest first) with keyboard-operable previous/next arrow controls, replacing the previous fixed grid layout. Individual article cards keep their existing appearance unchanged.

## [0.8.0] - 2026-07-08 (backend)

### Added

- Five new Metal Storm feed sources for the Dashboard (feature 025): News, Reviews, Interviews, Articles, and Staff Picks, each fetched from its own direct RSS/XML endpoint (`metalstorm.net/rss/*.xml`). These replace the previous single, disabled `metal-storm` config entry that pointed at Metal Storm's Cloudflare-protected feed-listing page.

### Changed

- Each Dashboard category now returns up to the 10 most recent articles (previously 3-5), sorted by publish date descending. When more than one feed source shares the same category label (e.g. Metal Injection's and Metal Storm's "News"), their articles are combined into a single category entry capped at 10 combined, not 10 per source.

## [0.14.0] - 2026-07-08 (frontend)

### Changed

- The search filter bar has been reorganized to make Format the primary filter (feature 023): it now renders first, ahead of Genre and Style, and its trigger label live-updates to show the currently selected value(s) as they're chosen — a single value's name, a comma-separated list when it fits, or a "first (+N)" abbreviated form when it doesn't — all before "Apply filters" is clicked.
- Genre and Style now render at a more compact, fixed width, giving Format a larger share of the filter bar's horizontal space.
- The "Apply filters" and "Clear filters" actions are now icon-only, with no visible text label; each keeps a distinct, screen-reader-identifiable accessible name via `aria-label`.
- Internally, the filter bar's Format, Genre/Style, and Apply/Clear controls were split into independent, reusable components (`FormatFilter`, `TextFilterField`, `FilterActions`) under `src/components/filters/`, so future filters can be added without modifying existing ones.

## [0.13.0] - 2026-07-07 (frontend)

### Changed

- The search filter control's Artist field has been removed entirely (feature 022); the main search query box is unaffected and continues to support searching by artist name as free text. A results link created before this change that still carries an `artist` value loads normally, with the value silently ignored.
- The Format filter is no longer free text: it is now a fixed, multi-select checklist of ~33 standard Discogs format names (e.g. Vinyl, CD, Cassette), opened from a compact trigger button. Selecting more than one format value narrows results to releases available in all of the selected formats simultaneously (verified against live Discogs data — this is AND matching, not OR). A results link carrying a format value no longer in the fixed list loads normally, with the unrecognized value silently dropped while other valid values remain applied.

## [0.7.0] - 2026-07-07 (backend)

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

## [0.12.0] - 2026-07-07 (frontend)

### Added

- The search results screen now has a filter control with four free-text fields — Artist, Genre, Style, and Format — submitted via an explicit "Apply filters" action (feature 021). Any combination of filters can be active at once, filters persist across pagination and in the results URL (so reloading or sharing a filtered URL reproduces the same results), and a "Clear filters" action resets to the unfiltered view in one step. A filtered search with no matches shows a message naming the active filters instead of the generic no-results message.

## [0.6.0] - 2026-07-07 (backend)

### Added

- `GET /api/discogs/search` now accepts four optional filter query params —
  `artist`, `genre`, `style`, `format` — forwarded, unchanged and trimmed, to
  the underlying Discogs `GET /database/search` request as additional search
  criteria (feature 021). Blank/whitespace-only values are treated as unset
  and excluded from the outbound request. The Redis cache-aside key for
  search results now includes the active filter values so filtered and
  unfiltered searches for the same query never collide in the cache.

## [0.11.0] - 2026-07-07 (frontend)

### Added

- Three navigation destinations (Profile, My wishlist, My library) now render as separate, individually clickable flat outline icons on the right side of the header at viewport widths of 768px and above (feature 020).

### Changed

- The hamburger menu is now shown only below the 768px breakpoint; at 768px and above it is replaced by the new header nav icons (feature 020). The menu's own destinations, links, and open/close behavior are unchanged below that breakpoint.

## [0.10.0] - 2026-07-07 (frontend)

### Changed

- Search-result and library cards now always show a rating badge (feature 019). Releases with no community rating, an invalid rating, or a failed rating lookup show a dash ("-") on a soft gray background instead of leaving an empty gap where the badge would sit. Rated releases keep their existing numeric value and color band unchanged.

## [0.9.0] - 2026-07-06 (frontend)

### Added

- A search textbox is now always visible, centered in the app header, on every authenticated page (feature 018). Submitting a query navigates to a new `/app/search` results page showing matching Discogs catalog records as cards, with the same add-to-library, preview, and pagination behavior the former "Add a record" page had.

### Changed

- The header search box resets to empty whenever you navigate away from the search results page, so it doesn't carry a stale query onto unrelated pages.

### Removed

- The standalone "Add a record" page and its `/app/library/add` route are retired; searching is now reached from the header on any page instead.
- The "Add a record" link on the "My Library" page is removed, since the header search box replaces it.

## [0.8.0] - 2026-07-06 (frontend)

### Added

- Search-result and library cards now show a compact rounded-square rating badge in the thumbnail's upper-right corner whenever a release has a valid community rating (feature 017). The badge's background communicates the rating band — red for 0.00–2.50, yellow for 2.51–4.09, green for 4.10–5.00 — and its text meets WCAG AA contrast (>=4.5:1) against all three bands. Cards with no valid, votable rating simply omit the badge; the overlay is purely presentational and never blocks add/preview/open-record interactions or shifts the surrounding layout.
- New `ReleaseRatingBadge` atomic component (`src/components/ui/ReleaseRatingBadge.tsx`) and a shared `src/lib/releaseRating.ts` helper (visibility rules, one-decimal formatting, band selection) reused by both `SearchResultCard` and `RecordCard`.
- New `--color-rating-low` / `--color-rating-medium` / `--color-rating-high` theme tokens in `src/styles/global.css`.

## [0.5.0] - 2026-07-06 (backend)

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

- `LogOutcome` gained an `omitted` value for structured logging of per-result rating-enrichment degradation.

## [0.7.0] - 2026-07-06 (frontend)

### Added

- Library list page now synchronizes with the linked user's Discogs collection on load (feature 016). A **Refresh** button forces an immediate re-sync. Unlinked users see a gate card explaining they must link their Discogs account from their profile; users whose stored link becomes invalid see a "re-link your account" variant.
- Record detail page's **Your copy** panel is rebuilt around the Discogs per-copy data: a 5-star rating control (`StarRating`), media condition and sleeve condition dropdowns (exact Discogs grading vocabulary), and an inline-editable notes field. Each field autosaves on change. Controls are disabled with an explanatory hint when the matching Discogs custom field has been deleted by the user on discogs.com.
- New `StarRating` component (`src/components/ui/StarRating.tsx`): atomic 5-star rating control, keyboard-accessible, dark-mode-aware, tapping the current value clears to 0.
- New `LibraryLinkRequired` component (`src/components/LibraryLinkRequired.tsx`) with two variants: `not-linked` (never connected) and `relink` (credentials revoked), both with a CTA to `/app/profile`.
- Add-record page surfaces Discogs gate errors (`discogs_not_linked`, `discogs_link_invalid`) with a link to the profile instead of a generic failure message.

### Changed

- **BREAKING**: `EnrichedLibraryEntry` no longer carries top-level `condition` or `notes` fields. They are replaced by a `discogs` object matching `EntryDiscogsData` (per the backend 0.4.0 contract).
- `useUpdateLibraryEntry` now invalidates all library queries on success (previously it only updated the single detail query in cache).
- Add-record flow sends only `{ discogsReleaseId }` — `condition` and `notes` are no longer accepted and the form no longer has those fields.

### Removed

- Legacy `CONDITION_OPTIONS` constant and free-text condition editing from `MyCopySection`. The component now uses the Discogs grading vocabulary exclusively.

## [0.4.0] - 2026-07-06 (backend)

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
- New `GET /api/library/:id` enriches the entry with fresh per-copy data fetched from the Discogs collection instance.
- `PATCH /api/library/:id` writes one per-copy field at a time (rating via the instance endpoint, media/sleeve condition and notes via the custom-fields endpoint). Each write is confirmed by Discogs before the response is sent.
- New `backend/src/discogs/collection/` module: `collectionClient.ts` (OAuth-signed Discogs collection client), `collectionTypes.ts`, and `conditionGrading.ts` (closed Discogs grading vocabulary + legacy mapping).
- `invalidateCache(key)` helper in `cacheAside.ts`.
- Structured logging for all sync outcomes: `sync_completed`, `first_sync_migrated`, `entry_added`, `entry_removed`, `entry_removed`, auth failures, and rate-limit metadata.

### Changed

- **BREAKING**: `POST /api/library` body now accepts only `{ discogsReleaseId: number }`. The previously accepted `condition` and `notes` fields are rejected with `400 invalid_request`.
- **BREAKING**: `PATCH /api/library/:id` body is now `{ rating?, mediaCondition?, sleeveCondition?, notes? }`. The previous `{ condition, notes }` shape is rejected with `400 invalid_request`.
- **BREAKING**: All library entry responses now include a `discogs` object (`instanceId`, `folderId`, `rating`, `mediaCondition`, `sleeveCondition`, `notes`, `editable`) in place of the previous top-level `condition` and `notes` fields.
- All library endpoints now require an active Discogs connection. Without one they return `409 discogs_not_linked`; revoked credentials return `401 discogs_link_invalid`.
- `LibraryEntry` Firestore documents gain `discogsInstanceId` and `discogsFolderId`; the legacy `condition` and `notes` fields are deleted per-entry after confirmed migration (first sync only).
- `discogsConnections/{uid}` gains `initialLibrarySyncAt` to track first-sync completion; absent ⇒ next sync runs in union-merge mode.

### Migration

Existing library entries that carry `condition`/`notes` will be migrated
automatically on first library load by each user after this deployment.
No manual data-migration step is required; the migration is per-entry and
resumable (a failure on one entry retries on the next load; the entry retains
its legacy fields until the Discogs write succeeds).

## [0.6.0] - 2026-07-06 (frontend)

### Added

- Profile section now hosts a "Discogs" connection card (feature 015): link your Vinylmania account with your Discogs account through Discogs' own authorization page, see the linked Discogs username and link date at a glance, and disconnect with an inline confirmation (two interactions). A new `/app/profile/discogs/callback` route completes the return leg from Discogs and reports the outcome (linked, not completed, expired, or error) as a dismissible message on the profile. The card renders from stored state with a skeleton while loading, supports dark mode, and never shifts layout between states.

## [0.3.0] - 2026-07-06 (backend)

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

## [0.5.0] - 2026-07-05 (frontend)

### Changed

- Redesigned the record detail page to match the release preview's layout: a full-width square cover gallery with browsable thumbnails, key release details (title, artist, format, genres, styles, release date, label) and the tracklist side by side directly below it, and notes, identifiers, and community stats in their own section below that — all inside a single bordered container instead of several separate cards. On mobile, the sections stack in the same order: gallery, key details, my copy, tracklist, then the remaining details.
- Moved "Your copy" (condition and notes, inline-editable) into its own `MyCopySection` component, positioned directly below the key release details in the left column; all existing inline-edit behavior (autosave, Escape to cancel, save confirmation, editable-field affordance) and the "Remove from library" action are unchanged.
- Added the format field (e.g. "Vinyl (12\")") to the shared key-details presentation used by both the record detail page and the release preview, so no previously-visible information is lost by this redesign.

## [0.4.0] - 2026-07-04 (frontend)

### Changed

- Redesigned the release preview popup's layout: the image gallery (cover plus vertical thumbnail carousel) now spans the full width of the popup in a square format; key release details (title, artist, genres, styles, release date, label) and the tracklist now sit side by side directly below it; notes, identifiers, and community stats moved into their own section below that. On mobile, the sections stack in the same reading order: gallery, key details, tracklist, then the remaining details.
- Hid the scrollbar on the thumbnail carousel and on the preview popup itself (content remains fully scrollable) for a cleaner, more modern appearance; other popups/modals in the app are unaffected.

## [0.3.0] - 2026-07-04 (frontend)

### Changed

- Redesigned the release preview popup (opened from a search result card): it now shows a full release-details section (label/catalogue number, country, release date, genres, styles, notes, identifiers, and community stats) above the tracklist, in a layout that splits into two columns on wide viewports and stacks into one column on mobile.
- Replaced the popup's single static cover image with an image gallery: a primary image plus a vertical, clickable thumbnail list built from every image Discogs returns for the release.

## [0.2.0] - 2026-07-04 (frontend)

### Added

- Client-side state caching for library and catalog reads using TanStack Query: revisiting the library list, a record's detail page, or a repeated Discogs search now renders instantly from cache instead of re-fetching, and a user's own edits/adds/removes invalidate the relevant cached data so changes are always reflected immediately.

## [0.1.0] - 2026-07-04 (frontend)

### Changed

- Redesigned the record detail view into a responsive four-block layout (cover image, disc information, your copy, tracklist) that reflows between a single stacked column and a two-column layout based on available width.
- Replaced the "Your copy" Edit/Save/Cancel form with per-field inline editing: clicking/tapping the condition or notes value edits it in place, autosaves on blur/confirm, shows a brief save confirmation, and reverts on Escape without saving.
- Expanded the disc information block to show release year, format, and genre alongside the existing title and artist(s).

## [0.0.1] - 2026-07-04 (frontend)

### Added

- Landing page with Google Sign-In authentication.
- Discogs-backed vinyl search with card-based, paginated results and add/preview actions.
- Vinyl library management UI (add/view records from search results).
- App navigation with hamburger menu and dashboard.
- End-to-end (Playwright) test coverage for authentication flows, running against Firebase emulators without a real Google Sign-In.

### Changed

- Migrated the entire UI to a Tailwind CSS v4 design system (CSS-first theme, reusable `Card`/`Button`/etc. components, skeleton loading states, dark mode).
- Split Vercel deployment into a dedicated frontend project, separate from the backend.

## [0.2.0] - 2026-07-04 (backend)

### Added

- Widened the Discogs `Release` model with `releaseDate`, `notes`, `identifiers`, and `community` statistics (have/want counts, rating), mapped from the Discogs `/releases/{id}` response and returned from `GET /api/discogs/releases/:discogsId`.

## [0.1.0] - 2026-07-04 (backend)

### Added

- Redis (via ioredis) response caching for the Discogs catalog client (`searchCatalog`, `getRelease`, `getArtist`), including the per-entry release lookups made during library-list enrichment. Falls back to fetching directly from Discogs if Redis is unconfigured or unavailable, so a cache outage never fails a request.

## [0.0.1] - 2026-07-04 (backend)

### Added

- Discogs catalog API client and vinyl data model.
- Vinyl library CRUD endpoints with Discogs metadata enrichment.

### Changed

- Split Vercel deployment into a dedicated backend project, separate from the frontend.

### Fixed

- Removed an invalid pinned runtime from the backend's `vercel.json`.

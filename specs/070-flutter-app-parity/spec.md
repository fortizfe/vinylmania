# 070 — Flutter app: functional parity with the web app

**Branch**: `feat/flutter-app-parity` · **Clients**: `flutter_app/` (Android, iOS, macOS) · **Backend**: small auth change (see `contracts/native-oauth-api.md`)

## Goal

A signed-in collector can do on the native app everything they can do on the web
(`frontend/`), against the **same backend API** (constitution §IX: one API, two
clients). No business rule is re-implemented in Dart; the app renders what the
backend returns.

## Users stories (one per web screen, same behaviour as the web unless noted)

Each story lists the web source it mirrors. "Gate" = the shared Discogs gate:
backend error `discogs_not_linked` → "link your Discogs account" card with a
button to Profile; `discogs_link_invalid` → "re-link" card with the same button.

| # | Story | Web source | Endpoints |
|---|---|---|---|
| US1 | **Sign in / out.** Signed-out users see a sign-in screen (wordmark, tagline, three pillar lines, "Continue with Google"). Google sign-in opens the system auth browser and returns to the app signed in. Denied/expired/failed attempts show the web's friendly messages. Sign out from Profile. The session survives app restarts; any 401 (except `discogs_link_invalid`) signs out and returns to sign-in. | `LandingPage`, `LoginCallbackPage`, `AuthContext`, `apiClient.ts` | `GET /api/auth/google/authorize`, `POST /api/auth/google/complete`, `GET /api/auth/me`, `DELETE /api/auth/session` |
| US2 | **News dashboard.** Articles grouped by category; source filter chips (priority sources first) switching to a single source's feed; per-source "temporarily unavailable" notice; whole-surface notice when every source is down. Tapping an article opens it in the system browser. | `DashboardPage`, `FeedArticleBoard`, `FeedSourceFilterBar` | `GET /api/feeds/dashboard`, `GET /api/feeds/sources/:sourceId` |
| US3 | **Search with suggestions.** A search field (Search tab on compact, ⌘/Ctrl+K on desktop) shows debounced (300 ms, ≥ 2 chars) suggestions; picking a release/master opens its detail, an artist opens full results for that name; submitting opens results. | `HeaderSearchBox`, `HeaderSuggestionPanel` | `GET /api/discogs/suggest` |
| US4 | **Search results.** Infinite-scroll results (20/page), genre/style/format filters (multi-select, clear all), grid/list toggle, community rating badge, per-result "Add to library" / "Add to wishlist" with gate handling. Releases open release detail, masters open master detail. | `SearchResultsPage`, `FiltersControl`, `SearchResultCard`, `SearchResultListRow`, `ResultCardActions` | `GET /api/discogs/search`, `POST /api/library`, `POST /api/wantlist` |
| US5 | **Release detail.** Image gallery + full-screen zoomable viewer, details, community rating card (and personal rating when the release is in the wishlist), streaming links (Apple Music), tracklist, notes & identifiers. Actions: add to library (shows the "couldn't remove from wishlist" notice on `wantlistRemoval: failed`), add to wishlist ("already in your library" note). Not-found and relink states. | `ReleaseDetailPage`, `RecordDetailLayout`, `RatingCard`, `RecordDetailActions`, `ReleaseImageGallery`, `GalleryFullscreenViewer`, `StreamingLinksSection` | `GET /api/discogs/releases/:id`, `GET /api/wantlist/:releaseId`, `PATCH /api/wantlist/:releaseId`, `POST /api/library`, `POST /api/wantlist`, `GET /api/streaming/links` |
| US6 | **Master release detail.** Gallery, details, tracklist, streaming links, paginated versions list (tap → release detail). Relink state. | `MasterReleaseDetailPage`, `MasterVersionsTable` | `GET /api/discogs/masters/:id`, `GET /api/discogs/masters/:id/versions` |
| US7 | **Library.** Infinite scroll (20/page), six sort options, genre/style/format filters, grid/list toggle, Refresh (sync from Discogs, error notice), screen-reader announcements on sort/filter/batch change, gate. | `LibraryListPage`, `LibraryToolbar`, `RecordCard`, `RecordListRow` | `GET /api/library` (`page,pageSize,refresh,sort,dir,genre,style,format`) |
| US8 | **Record detail (my copy).** Release detail blocks plus "My copy": personal rating (stars), media/sleeve condition pickers, notes — each autosaves field by field; fields the backend flags non-editable are read-only. "Remove from library" with confirmation. | `RecordDetailPage`, `MyCopySection`, `InlineEditableField` | `GET/PATCH/DELETE /api/library/:id` |
| US9 | **Wishlist.** Paginated grid (20/page, next/previous), Refresh, remove with confirmation dialog, community rating badge, gate, empty state. Tap → release detail. | `WishlistPage`, `WantlistCard`, `RemoveFromWantlistDialog` | `GET /api/wantlist`, `DELETE /api/wantlist/:releaseId` |
| US10 | **Collection stats & valuation.** Totals, breakdowns (decade/genre/style/label with "others"), top artists, growth chart; progressive valuation (cursor loop with progress, partial/complete/unavailable, seller-settings notice, retry all / retry failed), most valuable records, per-disc breakdown sheet. Gate. | `CollectionStatsPage`, `components/stats/*`, `components/valuation/*`, `collectionStatsQueries.ts` | `GET /api/collection-stats/statistics`, `GET /api/collection-stats/valuation` |
| US11 | **Profile & settings.** Appearance (light / dark / follow system — see defaults), synced to the account; save-failure banner. Discogs connection card: status, link, disconnect with confirm, relink; link outcome banner (linked / denied / expired / error). Sign out. | `ProfilePage`, `DiscogsConnectionCard`, `DiscogsRelinkNotice`, `ThemeToggle` | `PATCH /api/auth/preferences`, `GET /api/discogs/oauth/status`, `POST /api/discogs/oauth/request`, `POST /api/discogs/oauth/complete`, `DELETE /api/discogs/oauth/connection` |

Cross-cutting, every screen (constitution §X, §XI, "Native clients"): skeleton
loading matching the final shape (no spinners), empty and error states with a
real Retry, zero layout shift between states, light + dark themes, purpose-built
compact (< 840 px) and expanded (≥ 840 px) layouts, 44×44 / 48×48 targets,
semantic labels, 200 % text scale, reduced motion.

## Defaults adopted (no question needed)

- **Appearance**: the backend stores only `light | dark`. Until the user picks
  one, the app follows the system setting (same as the web without a stored
  value). The toggle is a two-state switch like the web.
- **Back navigation** is the native stack (back button / swipe / system back),
  not the web's `from` state.
- **Locale for streaming links** = device locale (`toLanguageTag()`), the
  native equivalent of `navigator.language`.
- **Pagination sizes, sort options, filter option lists and condition lists**
  are the web's, verbatim.
- **Sign-in on Android/iOS/macOS only** in this feature (see Out of scope).

## Not ported (with reason)

| Web element | Decision |
|---|---|
| Marketing landing page (hero, scroll sections) | Replaced by a single sign-in screen with the same copy condensed — an app store listing does the marketing. |
| `VinylmaniaGrungeFilter` SVG texture on the wordmark | Web-only SVG filter; the native wordmark is plain Anton. |
| `/login/callback`, `/app/profile/discogs/callback` pages | Replaced by the in-place OAuth session (`flutter_web_auth_2` returns the callback URL to the awaiting call). |
| `/__dev/nested-overlay` harness | Dev-only test page. |
| Hamburger menu / header nav icons | Replaced by `NavigationBar` (compact) / `NavigationRail` (expanded). |
| Shareable URLs (query params as state) | No universal links in this feature; screen state lives in route params in-app only. |
| Scroll-padding / floating capsule tweaks | Web layout details with no native equivalent. |

## Out of scope (YAGNI — add when…)

- **Windows / Linux sign-in** (loopback redirect) — add when a desktop release beyond macOS is planned; backend needs one more allowed redirect target.
- **Grid/list preference persisted across restarts** — kept in memory per app run; add `shared_preferences` when users ask for it.
- **Universal / App Links for `https://` web URLs** — add when sharing links from web to app matters.
- **Offline cache** — add when there is a real offline use case; today every screen needs live Discogs data.
- **Push notifications, widgets, store release & signing** — separate features.

# 070 — Plan: Flutter app parity

Binding: `CONSTITUTION.md` §I, III, IV, IX, X, XI, XII and the "Native clients" stack
entry, plus the `flutter-architecture`, `flutter-design` and `flutter-platforms` skills.
This plan names files and signatures. Implementers don't redesign; open questions
come back here.

## 1. Key decisions

| Topic | Decision |
|---|---|
| Session | Same opaque Bearer token as the web (`sessionToken` from `/api/auth/google/complete`), stored with `flutter_secure_storage` behind `SessionStorage`. No cookies. |
| Google sign-in | `flutter_web_auth_2` opens `GET {API}/api/auth/google/authorize?client=native&code_challenge=<S256>` in the system auth session (ASWebAuthenticationSession on iOS/macOS, Custom Tab on Android). Google → backend relay `/api/auth/google/native/callback` → `vinylmania://auth/callback?code&state`. The app posts `/complete` with `codeVerifier`. See `contracts/native-oauth-api.md`. |
| Discogs link | `POST /api/discogs/oauth/request {client:"native"}` → open `authorizeUrl` in the same auth session → backend relay → `vinylmania://discogs/callback?oauth_token&oauth_verifier` → existing `POST /complete` with Bearer. |
| Platforms | Android, iOS, macOS (custom scheme `vinylmania`). Windows/Linux build but sign-in is out of scope (loopback redirect later). |
| Material import | Keep the scaffold's decoupled `package:material_ui/material_ui.dart` (and `cupertino_ui` only if a `.adaptive` widget needs it). |
| Navigation | `go_router` with **one `ShellRoute`** (single stack, like the web's history). Tabs `go`, details `push`. No `StatefulShellRoute`: the web doesn't keep per-tab state either. |
| State | `provider` + `ChangeNotifier` ViewModels. Repositories that are mutated from several screens (`LibraryRepository`, `WantlistRepository`) extend `ChangeNotifier` and notify after a mutation; list ViewModels listen and reload. No other cache. |
| Layout | Every feature screen = `XxxScreen` picking `XxxCompactLayout` (< 840) or `XxxExpandedLayout` (≥ 840) on `MediaQuery.sizeOf(context).width`. |

## 2. Packages (owned by WP-platform in `pubspec.yaml`)

| Package | Why |
|---|---|
| `provider`, `go_router`, `http`, `flutter_secure_storage`, `flutter_web_auth_2` | Approved list (`flutter-architecture`). |
| `url_launcher` (**new**) | Opening articles, the Discogs page and Apple Music links in the system browser/app. The SDK can't open URLs. The web's `<a target=_blank>` equivalent. |
| `crypto` (**new**, dart-lang) | SHA-256 for PKCE S256. Not in the Dart SDK. |
| `intl` (**new direct**, already transitive) | Currency (`NumberFormat.simpleCurrency(name:)`) and dates, as the web's `Intl.*`. |
| dev: `flutter_test`, `flutter_lints` (present), `fake_async` (**new direct dev**, already transitive) | Timer-driven VM tests (debounce, valuation backoff). |

Rejected: `cached_network_image` (`Image.network` covers it), `fl_chart` (one line chart → `CustomPainter`), `shared_preferences` (view-mode persistence cut), `freezed`/`json_serializable` (hand-written `fromJson`), `photo_view` (`InteractiveViewer`), `google_fonts` (bundle Anton, no runtime fetch).

Fonts/assets (pubspec, WP-platform): `assets/fonts/Anton-Regular.ttf` + `assets/fonts/OFL.txt` (Google Fonts, OFL), family `Anton`.

## 3. Folder layout and ownership

Follows `flutter-architecture`. One refinement: `domain/models/` is grouped
into one subfolder per backend domain. That gives each work package disjoint
paths and changes no dependency rule. **Owner** = the work package in
`tasks.md`. A file is edited only by its owner.

```
flutter_app/
  pubspec.yaml, android/, ios/, macos/, assets/fonts/          WP-platform
  lib/
    main.dart                                                  WP0a
    config/api_config.dart                                     WP0a   const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3001')
    app/app.dart, router.dart, dependencies.dart               WP0a
    data/services/
      api_client.dart, api_exception.dart, session_storage.dart,
      oauth_browser.dart, pkce.dart, auth_api.dart             WP0a
      discogs_catalog_api.dart, library_api.dart, wantlist_api.dart, feeds_api.dart,
      streaming_api.dart, collection_stats_api.dart, discogs_oauth_api.dart   WP0b
    data/repositories/
      auth_repository.dart                                     WP0a
      catalog_repository.dart, library_repository.dart, wantlist_repository.dart,
      feeds_repository.dart, streaming_repository.dart,
      collection_stats_repository.dart, discogs_connection_repository.dart     WP0b
    domain/models/auth/user_profile.dart                       WP0a   (+ enum ThemePreference)
    domain/models/paged.dart                                   WP0b   Paged<T>{items, page, hasMore}
    domain/models/catalog/   release, artist_credit, track, label_credit, format_descriptor,
                             catalog_image, release_identifier, community_stats, community_rating,
                             catalog_search_result, catalog_suggestion, master_release,
                             master_release_version, catalog_filters                     WP0b
    domain/models/library/   library_entry (+ enum WantlistRemoval), copy_data, library_sort (enhanced enum, 6 values)  WP0b
    domain/models/wantlist/  want_entry, want_entry_detail, add_to_wantlist_result      WP0b
    domain/models/feeds/     article, category_group, source_status, feeds_dashboard, source_feed  WP0b
    domain/models/streaming/ streaming_link                                              WP0b
    domain/models/collection_stats/ collection_statistics, stat_breakdown, stat_bucket, artist_count,
                             growth_point, collection_valuation, per_disc_value, valuation_chunk  WP0b
    domain/models/discogs/   discogs_connection_status (+ enum DiscogsLinkOutcome)       WP0b
    domain/catalog_filter_options.dart   const genreOptions/styleOptions/formatOptions (verbatim from frontend/src/constants)  WP0b
    domain/copy_conditions.dart          const mediaConditions/sleeveConditions (verbatim from MyCopySection.tsx)          WP0b
    ui/core/theme/                                              WP0a
    ui/core/widgets/                                            WP0a
    ui/core/open_external_link.dart                             WP0a   Future<void> openExternalLink(Uri)  (url_launcher, externalApplication)
    ui/auth/                     sign-in + splash               WP0a
    ui/dashboard/                                               WP1   (stub seeded by WP0a)
    ui/search/                                                  WP2   (stub seeded by WP0a)
    ui/release_detail/           release, master, record detail + shared detail kit   WP3  (stubs seeded by WP0a)
    ui/library/, ui/wishlist/                                   WP4   (stubs seeded by WP0a)
    ui/stats/, ui/profile/                                      WP5   (stubs seeded by WP0a)
  test/  mirrors lib/; test/helpers/ split as in tasks.md
```

Record detail lives in `ui/release_detail/` with the release and master screens
because the three share the detail kit (gallery, details, tracklist, rating card,
streaming, extra info, layout, skeleton). One owner means no cross-package imports.

## 4. Core contracts (WP0a/WP0b deliver exactly these; features code against them)

### 4.1 Data layer (WP0a)

```dart
class ApiException implements Exception {
  const ApiException(this.statusCode, this.code, this.message); // statusCode 0 = network error, code 'network_error'
  final int statusCode; final String code; final String message;
}

class ApiClient {
  ApiClient({required http.Client httpClient, required SessionStorage sessionStorage, String baseUrl = apiBaseUrl});
  /// Set by AuthRepository. Called on 401 unless body.error == 'discogs_link_invalid' (mirrors apiClient.ts).
  void Function()? onUnauthorized;
  /// Query values: String, or Iterable<String> for repeated keys (`barcode`). Returns decoded JSON, null on 204.
  Future<Object?> get(String path, {Map<String, Object>? query});
  Future<Object?> post(String path, {Object? body});
  Future<Object?> patch(String path, {Object? body});
  Future<void> delete(String path);
}
// Non-2xx → ApiException(status, body.error ?? 'unknown', body.message ?? 'Request failed').

class SessionStorage {            // flutter_secure_storage, key 'vinylmania_session_token', in-memory cache after first read
  Future<String?> readToken(); Future<void> writeToken(String token); Future<void> clear();
}
class OAuthBrowser {              // flutter_web_auth_2, callbackUrlScheme 'vinylmania'
  /// Returns the callback URI, or null when the user closed the browser.
  Future<Uri?> authenticate(Uri url);
}
({String verifier, String challenge}) createPkcePair();   // pkce.dart: Random.secure 64 chars [A-Za-z0-9-._~], S256 base64url no padding

class AuthApi { // /api/auth/*
  Future<({String sessionToken, UserProfile user})> completeGoogle({required String state, String? code, String? error, required String codeVerifier});
  Future<UserProfile> me(); Future<void> deleteSession(); Future<void> setThemePreference(ThemePreference p);
}

class AuthRepository extends ChangeNotifier {
  AuthRepository({required AuthApi authApi, required SessionStorage sessionStorage, required OAuthBrowser oauthBrowser, required ApiClient apiClient}); // sets apiClient.onUnauthorized
  bool get isRestoring; UserProfile? get user; bool get isSignedIn;
  ThemePreference? get themePreference;
  Future<void> restore();                      // token? → me() ; 401 → cleared
  Future<SignInOutcome> signIn();              // enum SignInOutcome { success, cancelled, denied, expired, error }
  Future<void> signOut();                      // DELETE session, always clears locally
  Future<bool> setThemePreference(ThemePreference p); // optimistic; false = save failed (UI shows the web's banner)
}
```

Sign-in sequence: `createPkcePair()` → `oauthBrowser.authenticate(authorizeUri)`.
A null result means `cancelled` (no message). An `error` param means `denied`.
Otherwise `completeGoogle(..., codeVerifier)`: `expired_state` → `expired`,
anything else → `error`. Messages are the web's (`AuthContext.friendlyOutcomeMessage`).

### 4.2 Repositories (WP0b). Every method throws `ApiException`

```dart
class CatalogRepository {
  Future<List<CatalogSuggestion>> suggest(String query);
  Future<Paged<CatalogSearchResult>> search(String query, {int page = 1, CatalogFilters filters = CatalogFilters.none}); // type=release, perPage=20
  Future<Release> getRelease(int id);
  Future<MasterRelease> getMaster(int id);
  Future<Paged<MasterReleaseVersion>> getMasterVersions(int id, {int page = 1});
}
class LibraryRepository extends ChangeNotifier {
  Future<Paged<LibraryEntry>> list({int page = 1, LibrarySort sort = LibrarySort.newestFirst, CatalogFilters filters = CatalogFilters.none, bool refresh = false}); // pageSize 20
  Future<LibraryEntry> get(String entryId);
  Future<LibraryEntry> add(int releaseId);                                   // notifies
  Future<LibraryEntry> updateCopy(String entryId, {int? rating, String? mediaCondition, String? sleeveCondition, String? notes}); // exactly one non-null; notifies
  Future<void> remove(String entryId);                                       // notifies
}
class WantlistRepository extends ChangeNotifier {
  Future<Paged<WantEntry>> list({int page = 1, bool refresh = false});      // pageSize 20
  Future<WantEntryDetail?> get(int releaseId);                               // null on 404 (not in wantlist)
  Future<AddToWantlistResult> add(int releaseId);                            // notifies
  Future<WantEntryDetail> update(int releaseId, {int? rating, String? notes}); // notifies
  Future<void> remove(int releaseId);                                        // notifies
}
class FeedsRepository { Future<FeedsDashboard> dashboard(); Future<SourceFeed> source(String sourceId); }
class StreamingRepository { Future<List<StreamingLink>> links({required List<String> barcodes, required String artist, required String title, required String locale}); }
class CollectionStatsRepository {
  Future<CollectionStatistics> statistics({bool refresh = false});
  Future<ValuationChunk> valuationChunk({int cursor = 0, bool refresh = false, bool retryFailed = false}); // retry=failed
}
class DiscogsConnectionRepository {
  DiscogsConnectionRepository({required DiscogsOauthApi api, required OAuthBrowser oauthBrowser});
  Future<DiscogsConnectionStatus> status();
  Future<DiscogsLinkOutcome> link();   // request(client native) → browser → complete; null → denied; 'denied' param → denied; expired_request → expired; else error
  Future<void> disconnect();
}
```

`Paged<T>` is built by each service from the two wire shapes
(`{items,page,pageSize,totalItems}` and `{results,pagination{page,pages}}`).
`CatalogFilters` = `{Set<String> genre, style, format}`, `isEmpty`, `toQuery()`
(comma-joined, canonical option order). `LibrarySort` enhanced enum: `field`,
`dir`, `group`, `label`, `announcement` (strings from `librarySortOptions.ts`).

### 4.3 Shared widgets (WP0a, `ui/core/widgets/`, one class per file)

They take primitives only, never feature models, so WP0a doesn't depend on WP0b.

| Widget | API (essentials) | Web twin |
|---|---|---|
| `AppShell` | `AppShell({required String location, required Widget child})` | `AppHeader`, `HamburgerMenu` |
| `Pressable` | `Pressable({required VoidCallback? onTap, required Widget child, double pressedScale = 0.97, String? semanticLabel})`. Scale on pointer-down (`MotionTokens.press`), focus ring on keyboard focus, click cursor, no scale under reduced motion | `press.ts`, `focusRing.ts` |
| `VmButton` | `.primary/.secondary/.icon({onPressed, label, icon, bool loading})`. `loading` keeps the width (no shift) and disables | `Button` |
| `VmCard` | `VmCard({child, EdgeInsets padding, VoidCallback? onTap})`. Pressable at 0.99 when tappable | `Card` |
| `VmBadge`, `VmAvatar`, `VmTextField` | as web | `Badge`, `Avatar`, `Input` |
| `Skeleton` | `Skeleton({double? width, double height, BorderRadius radius})`. Pulses only when animations are enabled | `Skeleton` |
| `StarRating` | `StarRating({required int value, ValueChanged<int>? onChanged, bool saving})`. 0–5, 0 clears; slider semantics; 44/48 targets | `StarRating` |
| `ReleaseRatingBadge` | `ReleaseRatingBadge({double? average, int count = 0})`. Band/format rules ported from `lib/releaseRating.ts` (private functions in the file) | `ReleaseRatingBadge` |
| `CoverImage` | `CoverImage({String? url, required String semanticLabel, double aspectRatio = 1})`. Placeholder on null/error, fixed box | cover `<img>` |
| `PageTitle` | Anton title with `leading 1.05`, tracking −0.02em | `font-display` headers |
| `DiscogsLinkGate` | `DiscogsLinkGate({required bool relink, required String context})`. Message per `gateMessage()`, button → `/profile` | `LibraryLinkRequired`, `WantlistLinkRequired`, `DiscogsRelinkNotice` |
| `ErrorRetryCard` | `ErrorRetryCard({required String message, required VoidCallback onRetry})` | inline error cards |
| `DismissibleBanner` | `DismissibleBanner({required String text, required BannerTone tone, required VoidCallback onDismiss})`, `enum BannerTone {success, warning}` | Profile `DismissibleBanner` |
| `ViewModeToggle` | `ViewModeToggle({required ViewMode mode, required ValueChanged<ViewMode> onChanged})`, `enum ViewMode {grid, list}` | `ViewModeToggle` |
| `MultiSelectFilterSheet` | `static Future<Set<String>?> show(context, {required String title, required List<String> options, required Set<String> selected})`. Searchable list, Clear / Apply; bottom sheet (compact) or dialog (expanded) | `SelectableListFilter`, `CollapsibleFilterPanel`, `FilterActions` |
| `ConfirmDialog` | `static Future<bool> show(context, {title, message, confirmLabel, cancelLabel})`. `.adaptive` | `Modal`, `RemoveFromWantlistDialog` |
| `ProfileAvatarButton` | reads `AuthRepository.user`, goes to `/profile` | header avatar |

Add a widget here only when ≥ 2 feature packages need it. Anything used by one
package stays in that package's `widgets/`.

### 4.4 Routes and feature entry points (WP0a seeds the stubs; ownership passes to the feature package)

WP0a creates each `XxxScreen` + `XxxViewModel` below as a compiling stub with
**exactly** these constructors. The feature package replaces the bodies and
keeps the constructors. Wiring follows the official compass app:
`builder: (c, s) => XxxScreen(viewModel: XxxViewModel(...c.read()...))`.

| Path | Screen / ViewModel constructor | Pkg |
|---|---|---|
| `/splash` | `SplashScreen()` (brand skeleton while `isRestoring`) | WP0a |
| `/sign-in` | `SignInScreen(viewModel: SignInViewModel(authRepository))` (outside shell) | WP0a |
| `/` | `DashboardScreen(viewModel: DashboardViewModel(feedsRepository: …))` | WP1 |
| `/search?q=` | `SearchScreen(viewModel: SearchViewModel(catalogRepository:, libraryRepository:, wantlistRepository:, initialQuery: q ?? ''))` | WP2 |
| `/releases/:id` | `ReleaseDetailScreen(viewModel: ReleaseDetailViewModel(releaseId: int, catalogRepository:, libraryRepository:, wantlistRepository:, streamingRepository:))` | WP3 |
| `/masters/:id` | `MasterDetailScreen(viewModel: MasterDetailViewModel(masterId: int, catalogRepository:, streamingRepository:))` | WP3 |
| `/library/records/:entryId` | `RecordDetailScreen(viewModel: RecordDetailViewModel(entryId: String, libraryRepository:, streamingRepository:))` | WP3 |
| `/library` | `LibraryScreen(viewModel: LibraryViewModel(libraryRepository: …))` | WP4 |
| `/wishlist` | `WishlistScreen(viewModel: WishlistViewModel(wantlistRepository: …))` | WP4 |
| `/stats` | `StatsScreen(viewModel: StatsViewModel(collectionStatsRepository: …))` | WP5 |
| `/profile` | `ProfileScreen(viewModel: ProfileViewModel(authRepository:, discogsConnectionRepository:))` | WP5 |

Stub paths: `lib/ui/<pkg>/view_models/<x>_view_model.dart`, `lib/ui/<pkg>/widgets/<x>_screen.dart`.
A non-numeric `:id` → the screen's not-found state (no crash).
Redirect: `isRestoring` → `/splash`. Signed out and not `/sign-in` → `/sign-in`.
Signed in on `/sign-in` or `/splash` → `/`. `refreshListenable: authRepository`.
Feature screens navigate only with these paths (`context.push('/releases/$id')`,
`context.go('/search?q=…')`, `context.go('/profile')`).

## 5. Shell, theme, motion (WP0a)

**Shell.** Compact: top bar (Anton wordmark left, `ProfileAvatarButton` right) +
`NavigationBar` with News `/`, Search `/search`, Library `/library`, Wishlist
`/wishlist`, Stats `/stats`. Profile is reached from the avatar (5-tab maximum).
Expanded: `NavigationRail` (wordmark as leading, the same five + Profile, labels
shown) + content constrained to the web's max widths. Selected tab is derived
from the location prefix: `/releases`, `/masters` → Search; `/library/records` → Library.
Desktop: `⌘/Ctrl+K` → `go('/search')`, and the search field autofocuses when empty.

**Theme** (`ui/core/theme/`): `app_theme.dart` (`ThemeData buildLightTheme()`,
`buildDarkTheme()`), `stone.dart` (Tailwind stone 50–950 consts),
`vinylmania_colors.dart` (`ThemeExtension`: accent, accentText, rating
low/medium/high/unrated, surfaceRaised), `motion_tokens.dart` (`ThemeExtension`:
`easeOut/easeInOut/easeDrawer` Cubics, `press 130 / fade 200 / collapse 200 /
drawer 250 ms`, `springDefault/sheet/momentum`). Values: the `flutter-design` §2
table (source `frontend/src/styles/global.css`). `App` sets `themeMode` from
`AuthRepository.themePreference` (null → `ThemeMode.system`).

**Motion.** Only what the web already has: press scale, sheet/dialog default
transitions (platform), skeleton pulse, the growth-chart line draw (`fade`
duration, `easeOut`), and the valuation progress bar (`collapse`). All of it is
off or opacity-only under `MediaQuery.disableAnimationsOf`. No new curves.

## 6. Feature design notes (decisions so feature agents don't redesign)

- **Dashboard (WP1)**: compact = source chips in a horizontal scroll row
  (secondary content, allowed) above a single column of article cards grouped
  by category header. Expanded = multi-column grid per category (2–3 columns by
  width). Chip "All" + one per source, priority first (stable). An unavailable
  source chip says "unavailable" in text, not color alone. A card tap →
  `openExternalLink`.
- **Search (WP2)**: a field at the top of the screen, and a suggestion list
  replacing the results while the field is focused and has ≥ 2 chars (300 ms
  debounce, announces "N suggestions available."). Results grid (2 cols
  compact, 4–5 expanded) or list rows; infinite scroll triggers 600 px before
  the end; skeleton rows for the next page. The filters button shows a count
  and opens three `MultiSelectFilterSheet`s (genre/style/format) from one
  sheet. Result actions are icon buttons with labels "Add to library" /
  "Add to wishlist", and the state shows in label + icon (not color only).
  The gate message shows inline as a `DiscogsLinkGate`.
- **Detail kit (WP3)**, `ui/release_detail/widgets/`: `ReleaseGallery`
  (`PageView` + thumbnails; tap → `GalleryViewer` full-screen `InteractiveViewer`,
  swipe-down/Esc to close), `ReleaseDetailsSection`, `TracklistSection`
  (selectable text), `AdditionalInfoSection`, `RatingCard` (community + optional
  personal `StarRating`), `StreamingLinksSection` (loads after the release,
  hidden when empty, skeleton height fixed), `RecordDetailActions`,
  `MyCopySection` (rating, two condition dropdowns, notes field saved on
  blur/submit, per-field "Saved"/error via `liveRegion`), `MasterVersionsList`,
  `DetailLayout` (compact: one column in the web's mobile order. Expanded: two
  independent columns, gallery + rating left, info right, as `RecordDetailLayout`),
  `DetailSkeleton`.
- **Library (WP4)**: toolbar = sort menu (6 options, `announcement` via
  `SemanticsService.announce`), filters button, view toggle, Refresh. Infinite
  scroll. Wishlist uses classic pagination (Previous/Next) like the web.
  Remove → `ConfirmDialog`.
- **Stats (WP5)**: the valuation loop lives in `StatsViewModel` and ports
  `useProgressiveValuation` (backoff 1.5 s, max 3 transient retries, cursor
  loop, `retry(all|failed)`, `seller_settings` notice on the same error code
  the web checks). It's cancelled in `dispose`. Growth chart =
  `CustomPainter` with a `Semantics` summary ("N records added since …") plus
  a hidden data table for screen readers, like the web's.
- **Profile (WP5)**: two sections (Preferences, Connected services),
  side-by-side when expanded. Theme switch `.adaptive`. Discogs card states:
  loading skeleton / not connected (Link) / connected (username, linked date,
  Disconnect → inline confirm) / relink. The `link()` outcome shows as a
  `DismissibleBanner` with the web's four texts. Sign out button at the bottom.

## 7. Test strategy (Test-First, §I)

Red first in every task. The test file is committed and approved before the
implementation in each package.

| Layer | How | Helpers (owner) |
|---|---|---|
| Models | `fromJson` with fixtures shaped like the backend contracts, incl. optional/absent fields | `test/helpers/fixtures/*.dart` (WP0b) |
| Services | `MockClient` asserting method, path, query, `Authorization`, body, and error → `ApiException` | `test/helpers/mock_api.dart`: `ApiClient apiClientWith(MockClientHandler h, {String? token})` (WP0a) |
| Repositories / ViewModels | plain `test()` with `Fake…Repository implements …` | `test/helpers/fakes/fake_<x>_repository.dart` for every repository (WP0b; `fake_auth_repository.dart`, `fake_session_storage.dart`, `fake_oauth_browser.dart` from WP0a) |
| Widgets | `testWidgets` per state (skeleton, empty, error, populated, gate) × compact (390×844) and expanded (1280×800) × light/dark, text scale 2.0 without overflow, plus `meetsGuideline` ×4 | `test/helpers/pump_screen.dart`: `Future<void> pumpScreen(WidgetTester, Widget, {Size size, ThemeMode mode, double textScale})` and `expectA11yGuidelines(tester)` (WP0a) |
| Router | redirect matrix (restoring / signed out / signed in) and every path builds its screen | WP0a |
| Flows | `integration_test/app_flow_test.dart`: sign-in with a fake `OAuthBrowser` + `MockClient` → library → record detail → edit rating | WP-qa (after Phase 2) |

Gates per package: `dart format --set-exit-if-changed .`, `flutter analyze`,
`flutter test`, the dependency-rule grep and the one-class-per-file grep from
`flutter-architecture`.

## 8. Rejected alternatives

- Custom scheme registered directly at Google: web OAuth clients refuse it, and a native client type would need a second client id and secret on the backend.
- Separate native Google OAuth client + `google_sign_in` SDK: violates §IX (no Google SDK for data) and duplicates backend auth.
- Backend exchanging the code in the relay and passing a one-time ticket to the app: needs a new ticket store. PKCE on the existing pending doc gives the same protection with one field.
- Cookie session for native: the backend is already token-based.
- Universal/App Links callback: needs `apple-app-site-association` / `assetlinks.json` hosting and still no desktop answer. Custom scheme + relay is enough.
- `StatefulShellRoute` per-tab stacks: more wiring, no web parity requirement.
- Data layer split per feature package: the release screens need library + wantlist + catalog + streaming data, so per-feature ownership would create cross-package imports. A central WP0b keeps feature packages UI-only and fully parallel.
- Feature-owned route registration (each package edits `router.dart`): merge conflicts. Stubs with frozen constructors avoid it.

## 9. Ponytail notes (deliberate ceilings)

- `ponytail:` view mode (grid/list) is held in memory per app run. Ceiling: it resets on restart. Upgrade: `shared_preferences` behind one small store.
- `ponytail:` filter option lists are copied from `frontend/src/constants`, so two copies exist. Ceiling: drift if one side changes. Upgrade: serve them from the backend once they change more than rarely.
- `ponytail:` no repository cache beyond `ChangeNotifier` reload. Ceiling: re-fetch on every screen entry (the backend's Redis absorbs it). Upgrade: memoize in the repository if a profiler says so.
- `ponytail:` the relay 302s to a custom scheme. Ceiling: some Android browsers may refuse a redirect to a custom scheme without a user gesture (the consent click usually counts). Upgrade: the relay serves a tiny HTML page with a "Return to Vinylmania" link.
- `ponytail:` sign-in on Android/iOS/macOS only. Upgrade: allow `http://127.0.0.1:<port>/callback` as a relay target for Windows/Linux.

# 070 — Tasks: Flutter app parity

Inputs: `spec.md`, `plan.md` (§4 contracts are binding), `contracts/native-oauth-api.md`.

**Rules for every package**
- **Disjoint ownership**: edit only your owned paths. If you need something
  outside them, stop and ask `architect-agent`, who amends `plan.md`. Don't
  patch another package's file.
- **Test-first** (§I): each task's test is written, run red, and approved
  before its implementation. "R→G" below means exactly that.
- **Gates** before handing back: `dart format --set-exit-if-changed .`,
  `flutter analyze`, `flutter test` (all green), plus the two greps in
  `flutter-architecture` (dependency rule, one class per file). The backend
  runs its own suite instead.
- Each widget test covers states × compact (390×844) / expanded (1280×800) ×
  light/dark, text scale 2.0, and `expectA11yGuidelines` (plan §7).
- Conventional commits, one per task or small group (`feat(flutter_app): …`,
  `feat(backend): …`).

## Schedule

```
Phase 0  ── WP-backend ─────────────────────────┐   (parallel, independent)
         ── WP-platform ────────────────────────┤
         ── WP-platform P1 (deps) → WP0a T0a.1 (ApiClient seed) ─┐
Phase 1  ── WP0a (rest) ─────────────────┼──────┤   WP0b branches from T0a.1
         ── WP0b (data layer) ───────────┘      │
         ── WP0a T0a.9 (router + stubs) after WP0b is merged
Phase 2  ── WP1 ‖ WP2 ‖ WP3 ‖ WP4 ‖ WP5         (parallel, after WP0a + WP0b + WP-platform)
Phase 3  ── WP-qa (integration flow, a11y sweep) after Phase 2;  real-device sign-in check needs WP-backend deployed
```

| Pkg | Agent | Depends on | Owned paths |
|---|---|---|---|
| WP-backend | backend-agent | none | `backend/src/{domain,ports,application,adapters}/{auth,googleAuth,discogsOauth}/**` files listed in the contract, `backend/tests/{unit,contract}/{googleAuth,discogsOauth}/**`, `backend/README.md` |
| WP-platform | flutter-platform-agent | none | `flutter_app/pubspec.yaml`, `pubspec.lock`, `analysis_options.yaml`, `android/**`, `ios/**`, `macos/**`, `assets/**`, `.github/workflows/ci.yml` (flutter job only) |
| WP0a | flutter-agent | WP-platform P1 (pubspec deps; T0a.9 also needs WP0b) | `lib/main.dart`, `lib/app/**`, `lib/config/**`, `lib/data/services/{api_client,api_exception,session_storage,oauth_browser,pkce,auth_api}.dart`, `lib/data/repositories/auth_repository.dart`, `lib/domain/models/auth/**`, `lib/ui/core/**`, `lib/ui/auth/**`, and seeds the feature stubs (plan §4.4). Tests: the mirrors of those + `test/helpers/{mock_api,pump_screen}.dart`, `test/helpers/fakes/{fake_auth_repository,fake_session_storage,fake_oauth_browser}.dart`, `test/app/**` |
| WP0b | flutter-agent | WP0a T0a.1 | `lib/data/services/` 7 feature `*_api.dart`, `lib/data/repositories/` 7 feature repositories, `lib/domain/models/{paged.dart,catalog,library,wantlist,feeds,streaming,collection_stats,discogs}/**`, `lib/domain/{catalog_filter_options,copy_conditions}.dart`. Tests: mirrors + `test/helpers/fixtures/**`, `test/helpers/fakes/fake_{catalog,library,wantlist,feeds,streaming,collection_stats,discogs_connection}_repository.dart` |
| WP1 | flutter-agent | WP0a, WP0b | `lib/ui/dashboard/**`, `test/ui/dashboard/**` |
| WP2 | flutter-agent | WP0a, WP0b | `lib/ui/search/**`, `test/ui/search/**` |
| WP3 | flutter-agent | WP0a, WP0b | `lib/ui/release_detail/**`, `test/ui/release_detail/**` |
| WP4 | flutter-agent | WP0a, WP0b | `lib/ui/library/**`, `lib/ui/wishlist/**`, `test/ui/{library,wishlist}/**` |
| WP5 | flutter-agent | WP0a, WP0b | `lib/ui/stats/**`, `lib/ui/profile/**`, `test/ui/{stats,profile}/**` |
| WP-qa | qa-agent | Phase 2 | `flutter_app/integration_test/**` |
| WP-docs | docs-agent | Phase 2 (optional) | `docs/` end-user page "Using the Vinylmania app" |

All `lib/`, `test/` paths above are under `flutter_app/`.

---

## WP-backend — native OAuth (backend-agent)

Contract: `contracts/native-oauth-api.md`. Hexagonal skill applies. Don't add
classes to legacy multi-class files.

- [ ] B1 R→G `tests/unit/googleAuth/domain/pkceS256.test.ts` (RFC 7636 vector) → `domain/googleAuth/pkceS256.ts`; `OAuthClient` type in `domain/auth/types.ts`.
- [ ] B2 R→G unit tests for `startLogin` / `completeLogin` (native challenge stored; verifier ok / missing / wrong → `invalid_state`, pending kept; web ignores verifier; exchange gets `pending.client`) → use cases + `GoogleIdentityPort` + `PendingGoogleLogin`.
- [ ] B3 R→G contract tests in `googleAuthRoutes.test.ts` (authorize validation, native `redirect_uri`, relay whitelist, web unchanged) → `googleIdentityAdapter.ts`, `googleAuthRoutes.ts`.
- [ ] B4 R→G unit test `startLink(uid, 'native')` + contract tests (`/request` client body, nock asserts native `oauth_callback`, relay without auth) → port, `startLink.ts`, `discogsConnectionAdapter.ts`, `discogsRoutes.ts`.
- [ ] B5 `backend/README.md`: `GOOGLE_OAUTH_NATIVE_CALLBACK_URL`, `DISCOGS_OAUTH_NATIVE_CALLBACK_URL`, plus the note to register the Google redirect URI. Dependency-rule grep clean.
- Accept: `npm test` green, `npm run lint` clean, the e2e web login untouched (no e2e change needed).

## WP-platform — native config & dependencies (flutter-platform-agent)

- [ ] P1 `pubspec.yaml`: add `provider`, `go_router`, `http`, `flutter_secure_storage`, `flutter_web_auth_2`, `url_launcher`, `crypto`, `intl` (latest stable, caret); dev: `fake_async` (already transitive via flutter_test; direct so VM timer tests can import it). Add the font family `Anton` → `assets/fonts/Anton-Regular.ttf`, with `assets/fonts/OFL.txt` committed. Don't touch `version:`.
- [ ] P2 Android: `INTERNET` in `src/main/AndroidManifest.xml`; the `flutter_web_auth_2` `CallbackActivity` with an intent-filter for scheme `vinylmania` (hosts `auth`, `discogs`), `exported=true`; `minSdk` as `flutter_secure_storage` requires; `network_security_config` allowing cleartext only to `10.0.2.2`/`localhost` (debug); `<queries>` for `https` VIEW intents (`url_launcher`).
- [ ] P3 iOS: `NSAllowsLocalNetworking` (dev http) with ATS otherwise on; `LSApplicationQueriesSchemes` `https`. The auth session needs no URL-type registration; confirm on a simulator.
- [ ] P4 macOS: `com.apple.security.network.client` in **both** entitlements files; keychain access group for secure storage; minimum window size 800×600 in `MainFlutterWindow.swift`.
- [ ] P5 CI flutter job: keep `pub get → format → analyze → test`. Add Linux `libsecret-1-dev` only if `flutter test` needs it (it shouldn't, since fakes are used).
- Accept: `flutter build apk --debug`, `flutter build ios --no-codesign --debug`, `flutter build macos --debug` succeed locally; `flutter run -d macos` opens the system auth sheet for a `vinylmania://` round-trip (manual check, note the result in the PR).

## WP0a — core (flutter-agent)

- [ ] T0a.1 **Seed (unblocks WP0b, merge first)**: R→G `test/data/services/api_client_test.dart` (base URL, Bearer when a token exists, JSON in/out, 204 → null, non-2xx → `ApiException(status, error, message)`, malformed body → `unknown`, socket/client error → `network_error`, 401 → `onUnauthorized` except `discogs_link_invalid`, repeated query keys) → `config/api_config.dart`, `api_exception.dart`, `session_storage.dart`, `api_client.dart`, `oauth_browser.dart` (thin plugin wrapper, no test), `test/helpers/mock_api.dart`, `test/helpers/fakes/{fake_session_storage,fake_oauth_browser}.dart` (WP0b D7 needs the browser).
- [ ] T0a.2 R→G `pkce_test.dart` (RFC 7636 vector via an injectable verifier; charset/length) → `pkce.dart`.
- [ ] T0a.3 R→G `auth_api_test.dart` (complete with `codeVerifier`, me, delete session, preferences) → `auth_api.dart`, `domain/models/auth/user_profile.dart`.
- [ ] T0a.4 R→G `auth_repository_test.dart` (restore with/without token, 401 on me clears; signIn → success/cancelled/denied/expired/error and the authorize URI has `client=native` + challenge; signOut clears even on failure; unauthorized callback clears + notifies; theme optimistic + false on failure) → `auth_repository.dart`, `fake_auth_repository.dart`.
- [ ] T0a.5 R→G theme tests (light/dark build, extensions present, key text/background pairs ≥ 4.5:1 in both modes) → `ui/core/theme/*`.
- [ ] T0a.6 R→G widget tests per shared widget in plan §4.3 (states, press scale off under `disableAnimations`, 44/48 targets, labels, text scale 2.0) → `ui/core/widgets/*`, `ui/core/open_external_link.dart`, `test/helpers/pump_screen.dart`.
- [ ] T0a.7 R→G `sign_in_view_model_test.dart` + `sign_in_screen_test.dart` (button, in-flight state without layout shift, outcome messages, a11y) and `splash_screen_test.dart` → `ui/auth/**`.
- [ ] T0a.8 R→G `app_shell_test.dart` (compact NavigationBar 5 tabs + avatar → /profile; expanded rail 6; selected tab by prefix; ⌘/Ctrl+K → /search) → `ui/core/widgets/app_shell.dart`.
- [ ] T0a.9 **After WP0b merge**: seed the 9 feature stubs (plan §4.4, exact constructors, a placeholder `Text` body). R→G `test/app/router_test.dart` (redirect matrix, each path builds its screen, bad id doesn't crash) + `test/app/app_test.dart` (replaces the scaffold test: boots to splash → sign-in with fakes; themeMode follows the preference) → `app/router.dart`, `app/dependencies.dart` (`List<SingleChildWidget> buildProviders({http.Client?, SessionStorage?, OAuthBrowser?})`), `app/app.dart`, `main.dart` (restore on start).
- Accept: gates green; plan §4.1/§4.3/§4.4 signatures match exactly (feature packages compile against them).

## WP0b — data layer (flutter-agent, branches from T0a.1)

For each domain, test-first in this order: model `fromJson` tests (fixtures
copied from the TS interfaces in `frontend/src/services/*Api.ts`) → service
`MockClient` tests (method, path, query, body, `ApiException` passthrough) →
repository tests (Paged mapping, notifications, 404 → null where specified) → fake.

- [ ] D1 `paged.dart`, catalog models, `catalog_filters.dart`, `catalog_filter_options.dart` (lists verbatim) → `discogs_catalog_api.dart`, `catalog_repository.dart`, fake.
- [ ] D2 library models, `library_sort.dart` (6 values, labels/announcements verbatim), `copy_conditions.dart` → `library_api.dart`, `library_repository.dart` (`updateCopy` asserts exactly one field; notifies on add/update/remove), fake.
- [ ] D3 wantlist models → `wantlist_api.dart`, `wantlist_repository.dart` (`get` 404 → null), fake.
- [ ] D4 feeds models → `feeds_api.dart`, `feeds_repository.dart`, fake.
- [ ] D5 streaming model → `streaming_api.dart` (repeated `barcode`), `streaming_repository.dart`, fake.
- [ ] D6 collection-stats models → `collection_stats_api.dart` (`cursor`, `refresh`, `retry=failed`), `collection_stats_repository.dart`, fake.
- [ ] D7 discogs connection model + `DiscogsLinkOutcome` → `discogs_oauth_api.dart` (`request` sends `{client:'native'}`), `discogs_connection_repository.dart` (`link()` outcome matrix with `FakeOAuthBrowser`), fake.
- [ ] D8 `test/helpers/fixtures/**` shared by the feature packages (one populated + one minimal fixture per model).
- Accept: gates green; `domain/` imports no Flutter/http (grep); repositories match plan §4.2 exactly.

## Phase 2 feature packages (flutter-agent each)

Common to every package: replace your seeded stubs, keeping the constructors.
VM tests first (plain `test()` with the WP0b fakes), then widget tests per
state × layout, then build `XxxCompactLayout` / `XxxExpandedLayout` /
`XxxSkeleton` from `ui/core` widgets. Copy texts verbatim from the named web
files. Load `flutter-design` and `apple-design` before the layouts.

### WP1 — Dashboard / news (US2)
- [ ] F1.1 R→G `dashboard_view_model_test.dart`: load, source selection → source feed, per-source unavailable, all-unavailable, error + retry.
- [ ] F1.2 R→G widget tests (skeleton = the populated card shape, chips priority order, unavailable text, card tap calls `openExternalLink`, a11y) → `ui/dashboard/**` (screen, layouts, `ArticleCard`, `ArticleCardSkeleton`, `SourceFilterBar`).

### WP2 — Search + suggestions + results (US3, US4)
- [ ] F2.1 R→G `search_view_model_test.dart`: debounce 300 ms / ≥ 2 chars (fake clock via `fake_async`), suggestion pick → route intent per `resultType`, submit, infinite paging (no double fetch, stops at `hasMore=false`), filters reset to page 1, add-to-library/wishlist states, gate codes, `wantlistRemoval: failed` notice.
- [ ] F2.2 R→G widget tests (suggestion list + live announcement, grid/list, filter count, result action labels, gate, empty, error, skeleton rows) → `ui/search/**`.

### WP3 — Release, master and record detail + detail kit (US5, US6, US8)
- [ ] F3.1 R→G VM tests: `ReleaseDetailViewModel` (release + wantlist membership in parallel, add flows/notes/gates, personal rating save, relink, not found, streaming loaded after the release with the device locale), `MasterDetailViewModel` (versions paging), `RecordDetailViewModel` (per-field autosave with per-field saving/error, non-editable flags, remove → pop intent).
- [ ] F3.2 R→G widget tests for the kit (gallery + viewer close by Esc/swipe, rating card with/without personal, streaming hidden when empty, my-copy fields) and the three screens × states × layouts → `ui/release_detail/**`.

### WP4 — Library + wishlist (US7, US9)
- [ ] F4.1 R→G `library_view_model_test.dart` (sort/filters reset paging, refresh, infinite paging, reload on repository notify, gate, announcement strings) and `wishlist_view_model_test.dart` (page next/prev, refresh, remove, gate, empty).
- [ ] F4.2 R→G widget tests (toolbar, `RecordCard`/`RecordListRow` + skeletons, `WishlistCard` remove → `ConfirmDialog`, empty/error/gate) → `ui/library/**`, `ui/wishlist/**`.

### WP5 — Stats + profile (US10, US11)
- [ ] F5.1 R→G `stats_view_model_test.dart`: statistics; valuation cursor loop to complete, progress, transient backoff ×3, unavailable, seller-settings notice, retry all/failed, cancelled on dispose (`fake_async`).
- [ ] F5.2 R→G `profile_view_model_test.dart`: Discogs status, link outcomes → banner text, disconnect confirm, theme toggle + save-failure banner, sign out.
- [ ] F5.3 R→G widget tests (totals, breakdowns with "others", top artists, growth chart semantics summary, valuation card states, per-disc sheet; profile sections, banners, Discogs card states) → `ui/stats/**`, `ui/profile/**`.

## Phase 3

- [ ] Q1 (qa-agent) `integration_test/app_flow_test.dart`: fake `OAuthBrowser` + `MockClient` app: sign-in → news → search → release → add to library → library → record detail → rate → profile → sign out; one compact and one expanded window size.
- [ ] Q2 (qa-agent) a11y/parity sweep against spec US1–US11: each acceptance point maps to a test; report gaps to the owning package.
- [ ] Q3 (manual, after WP-backend is deployed with both env vars): real Google sign-in + Discogs link on an Android emulator, iOS simulator and macOS.
- [ ] Doc1 (docs-agent, optional) end-user page for the app.

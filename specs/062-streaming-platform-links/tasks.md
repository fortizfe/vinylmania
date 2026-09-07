---
description: "Task list for feature 062 — Escúchalo en Streaming"
---

# Tasks: "Escúchalo en Streaming" — Direct Streaming Platform Links on Record Detail

**Input**: Design documents from `specs/062-streaming-platform-links/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/streaming-links-api.md](contracts/streaming-links-api.md), [quickstart.md](quickstart.md)

**Tests**: REQUIRED — Constitution Principle I (Test-First, NON-NEGOTIABLE). Every implementation task
has a failing test written first.

**Organization**: Phase 1 Setup → Phase 2 Foundational (the shared backend resolution pipeline +
frontend data layer; blocks all stories) → Phase 3+ one phase per user story in priority order →
Phase 7 Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 / US4 for user-story phases only

## Path Conventions

Web app: `backend/src/…`, `backend/tests/…`, `frontend/src/…`, `frontend/tests/…`, `e2e/tests/…`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Zero-dependency declarations every later task imports. No new npm dependency is added
(the iTunes Search API is a plain HTTPS GET via the existing `axios`; `nock` is already a dev dep).

- [X] T001 [P] Create `backend/src/domain/streaming/types.ts` with type-only declarations: `StreamingPlatform` (`'apple_music'`), `Storefront` (string), `StreamingLinkQuery`, `ResolvedStreamingLink`, `StreamingLinksResult` — per [data-model.md](data-model.md). No logic.
- [X] T002 [P] Create `backend/src/domain/streaming/streamingErrors.ts`: abstract `StreamingResolutionError` (`code: 'unavailable' | 'rate_limited'`) with `StreamingUnavailableError` / `StreamingRateLimitedError`, mirroring `backend/src/discogs/discogsErrors.ts`.
- [X] T003 [P] Create `frontend/src/components/ui/icons/AppleMusicIcon.tsx` — inline SVG, `fill="currentColor"`, `role="img"` + `aria-hidden` (label lives on the anchor), sized via `className`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The complete streaming-link resolution capability (backend) and data access (frontend).
Every user story depends on this.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

### Tests (write first, MUST fail)

- [X] T004 [P] Unit test `backend/tests/unit/streaming/matching.test.ts`: `normalize()` (case, diacritics, punctuation, trailing `(Remastered)`/`[2011 Remaster]`/`- 2009 Remaster`); UPC result accepted without text check; UPC result with wholly-unrelated known artist rejected; text result requires artist AND title correspondence (equal / contains / ≥0.6 token overlap); ambiguous or title-only or artist-only → no-match.
- [X] T005 [P] Unit test `backend/tests/unit/streaming/storefront.test.ts`: `es-ES→ES`, `pt-BR→BR`, `en-US→US`, language-only `es→ES`/`en→US`/`de→DE`, explicit `locale` wins over `Accept-Language`, `Accept-Language` used when no explicit locale, junk/empty/unknown → `ES`.
- [X] T006 [P] Unit test `backend/tests/unit/streaming/resolveStreamingLinks.test.ts`: fans out over injected `StreamingResolverPort[]`; a resolver returning a link → included; returning `null` → omitted AND cached; throwing `StreamingResolutionError` → omitted, NOT cached (next call re-invokes), logged as `transient_failure`; one resolver throwing does not affect another resolver's link (isolation); result order follows resolver-list order; cache key is `streaming:<platform>:<recordKey>:<storefront>` with `recordKey` content-derived. Use a fake cache + fake resolvers.
- [X] T007 [P] Contract test `backend/tests/contract/streaming/streamingLinks.contract.test.ts`: all rows of the checklist in [contracts/streaming-links-api.md](contracts/streaming-links-api.md) — `200 {links:[…]}` on match, `200 {links:[]}` on `null`, `200 {links:[]}` on thrown error, `400 invalid_request` for missing/blank `artist`/`title`, `401` without session, multiple `barcode` params forwarded, `locale`→storefront + `Accept-Language` fallback + `ES` fallback, response body has no field but `links`.
- [X] T008 [P] Integration test `backend/tests/integration/streaming/itunesSearchAdapter.integration.test.ts` with `nock`: UPC lookup hit → `{platform:'apple_music', url: collectionViewUrl}`; UPC `resultCount:0` → falls back to text search; text search reliable match → link; text search no reliable match → `null`; HTTP `403` → `StreamingRateLimitedError`; timeout → `StreamingUnavailableError`; HTTP `5xx` → `StreamingUnavailableError`; malformed/`text/javascript` body parsed as JSON; unparseable body → throws (never returns a bad link); `country` param equals the requested storefront.

### Backend implementation

- [X] T009 [P] Implement `backend/src/domain/streaming/matching.ts`: pure `normalize(s)`, `isReliableUpcMatch(candidate, query)`, `pickReliableSearchMatch(candidates, query)` — passes T004. No imports outside the domain.
- [X] T010 [P] Implement `backend/src/adapters/streaming/storefront.ts`: `localeToStorefront(explicitLocale?: string, acceptLanguage?: string): Storefront` with the language→country table and known-storefront validation, fallback `ES` — passes T005.
- [X] T011 Create `backend/src/ports/streaming/streamingResolverPort.ts`: `interface StreamingResolverPort { readonly platform: StreamingPlatform; resolve(query: StreamingLinkQuery): Promise<ResolvedStreamingLink | null>; }` with JSDoc stating the contract (return `null` for confirmed no-match; throw `StreamingResolutionError` for transient failure only) and a "to add a platform, implement this and add it to the resolver array in `streamingRoutes.ts`" note.
- [X] T012 Implement `backend/src/adapters/streaming/itunesSearchAdapter.ts` (depends on T009, T011): `platform = 'apple_music'`; base URL `process.env.ITUNES_SEARCH_BASE_URL ?? 'https://itunes.apple.com'` (mirrors `DISCOGS_BASE_URL`); `resolve()` does normalised-barcode UPC lookup(s) first then `artist + title` text search; `PER_CALL_TIMEOUT_MS = 4000`, one retry on network/5xx; maps 403→`StreamingRateLimitedError`, timeout/5xx/parse→`StreamingUnavailableError`; applies domain matching; returns `{platform, url}` or `null`. Export `itunesSearchAdapter: StreamingResolverPort`. Passes T008.
- [X] T013 Implement `backend/src/application/streaming/resolveStreamingLinks.ts` (depends on T011; injects `StreamingResolverPort[]` + `CachePort`): `createResolveStreamingLinksUseCase({ resolvers, cache })` → `resolveStreamingLinks(query): Promise<StreamingLinksResult>`; per resolver, `cache.withCache('streaming:'+platform+':'+recordKey+':'+storefront, 7_776_000, () => resolver.resolve(query))` inside a per-resolver `try/catch` (or `Promise.allSettled`); catch → log `transient_failure`, omit; `null` → omit; link → push. Compute `recordKey = sha1(sortedNormalisedBarcodes.join(',') + '|' + normalize(artist) + '|' + normalize(title))`. Passes T006.
- [X] T014 Implement `backend/src/adapters/streaming/streamingRoutes.ts` and wire it in `backend/src/app.ts` as `app.use('/api/streaming', streamingRouter)` (depends on T010, T012, T013): `GET /links` with `standardRateLimit` + `requireAuth`; parse `artist`/`title` (`400 invalid_request` if missing/blank), repeatable `barcode`, optional `locale`; derive storefront via `localeToStorefront(req.query.locale, req.headers['accept-language'])`; call the use case built with `resolvers: [itunesSearchAdapter]`; always `200 { links }`; structured `logger.info` per attempt (`outcome`, `platform`, `method`, `storefront`, `uid`) and a request summary (`outcome:'success'`, `meta:{ linkCount }`). Passes T007.

### Frontend data layer

- [X] T015 [P] Unit test `frontend/tests/unit/services/streamingApi.test.ts`: builds `/api/streaming/links` with repeated `barcode` params, `artist`, `title`, and `locale = navigator.language`; parses `{ links }`; surfaces `ApiError` on non-2xx.
- [X] T016 [P] Implement `frontend/src/services/streamingApi.ts` (passes T015): `StreamingLink` / `StreamingLinksResponse` / `StreamingLinksInput` types; `getStreamingLinks(input)` via `authorizedFetch`.
- [X] T017 Implement `frontend/src/queries/streamingQueries.ts`: `streamingKeys` + `useStreamingLinks({ barcodes, artist, title })` (TanStack Query; key includes normalised barcodes + artist + title + `navigator.language`; `enabled: Boolean(artist && title)`; long `staleTime`; `retry: 1`). Follows `discogsQueries.ts` conventions.

**Checkpoint**: `GET /api/streaming/links` resolves Apple Music links end-to-end (verify with the `curl` calls in [quickstart.md](quickstart.md) §2); the frontend hook can fetch them. No UI yet.

---

## Phase 3: User Story 1 — Open a record in Apple Music from its detail page (Priority: P1) 🎯 MVP

**Goal**: On the release/master detail page (reached from search, library, or wantlist), a matched
record shows an Apple Music link that opens the album in one click; an unmatched record shows no
link and no error.

**Independent Test**: Open a detail page for an album known to be on Apple Music → the "Escúchalo en
streaming" section shows a working Apple Music link (new tab, no in-app audio). Open one for an
obscure vinyl-only release → the section shows a skeleton then disappears; the rest of the page is
unaffected.

### Tests (write first, MUST fail)

- [X] T018 [P] [US1] Component test `frontend/tests/unit/components/StreamingLinksSection.test.tsx`: shows a fixed-height skeleton while the query loads; renders an Apple Music `<a>` with `href` = returned url, `target="_blank"`, `rel="noopener noreferrer"`, accessible name "Escuchar en Apple Music", and a section heading, when `{ links:[{platform:'apple_music',url}] }` is returned; renders **nothing** (`container` empty) when `{ links:[] }`, when the query errors, and when `artist`/`title` are absent; derives `barcodes` from `identifiers` where `type === 'Barcode'`; link has a visible focus style; no colour-only meaning.
- [X] T019 [P] [US1] e2e `e2e/tests/streaming-links.spec.ts` (Playwright): stub `**/api/streaming/links**` → link present on `/app/releases/:id`, opens `music.apple.com` in a new tab; stub → `{ links: [] }` → no streaming section rendered; `runAxeScan` passes in both states. (Mirrors `e2e/tests/release-detail.spec.ts` route-interception style.)
- [X] T020 [P] [US1] Integration test `frontend/tests/integration/streamingLinksReleaseDetail.test.tsx`: `ReleaseDetailPage` renders `StreamingLinksSection` as the last section with a mocked `streamingApi`; page still renders fully when `getStreamingLinks` rejects.

### Implementation

- [X] T021 [US1] Implement `frontend/src/components/StreamingLinksSection.tsx` (passes T018): props `{ identifiers?: ReleaseIdentifier[]; artist?: string; title?: string }`; derive `barcodes`; call `useStreamingLinks`; render — loading → skeleton in reserved height (`animate-pulse`, honours `prefers-reduced-motion`); success with links → `<section>` + heading + platform anchors (metadata map: `apple_music` → label/icon/aria-label); success empty / error / missing inputs → `return null`. Use `Card`/spacing per the design system; consult `apple-design` + `emil-design-eng` first.
- [X] T022 [US1] Mount `<StreamingLinksSection>` as the **last** section on `frontend/src/pages/ReleaseDetailPage.tsx`, passing `release.identifiers`, primary `release.artists[0]?.name`, `release.title`. Placement-last so a skeleton→collapsed transition shifts nothing above it (FR-017).
- [X] T023 [US1] Extend `backend/tests/contract/streaming/streamingLinks.contract.test.ts` to assert the per-attempt structured log line (`outcome`, `platform`, `method`, `storefront`, `uid`) and the request summary line (`outcome:'success'`, `meta.linkCount`) fire for a matched and an unmatched request (FR-019, Principle V).

**Checkpoint**: MVP — Apple Music links work on the release detail page (search + wantlist releases),
degrade silently, and pass an axe scan.

---

## Phase 4: User Story 2 — Same one-click access on every record-detail surface (Priority: P1)

**Goal**: The identical section, with identical resolution behaviour, on the master detail page and
the library-record detail page — the link-resolution logic is shared, not re-implemented (FR-002,
SC-007).

**Independent Test**: Open the same album as a master detail page and as a library record → the
section resolves to the same result in both, and matches the release page.

### Tests (write first, MUST fail)

- [X] T024 [P] [US2] Integration test `frontend/tests/integration/streamingLinksMasterDetail.test.tsx`: `MasterReleaseDetailPage` renders `StreamingLinksSection` (no `identifiers` → `barcodes: []` → text-fallback query) with mocked `streamingApi`; page renders fully when the call rejects.
- [X] T025 [P] [US2] Integration test `frontend/tests/integration/streamingLinksRecordDetail.test.tsx`: `RecordDetailPage` (library record) renders `StreamingLinksSection` from `entry.release`; not rendered / harmless when `entry.release` is unavailable (`catalogStatus === 'unavailable'`).
- [X] T026 [P] [US2] Extend `e2e/tests/streaming-links.spec.ts`: the section appears on `/app/masters/:id` and on a library record detail page; the stubbed result is identical across surfaces for the same record.

### Implementation

- [X] T027 [US2] Mount `<StreamingLinksSection>` as the last section on `frontend/src/pages/MasterReleaseDetailPage.tsx`, passing `undefined` identifiers, `master.artists[0]?.name`, `master.title`.
- [X] T028 [US2] Mount `<StreamingLinksSection>` as the last section on `frontend/src/pages/RecordDetailPage.tsx`, passing `release.identifiers`, `release.artists[0]?.name`, `release.title` (only in the branch where `entry.release` exists).

**Checkpoint**: The section behaves identically on all three detail surfaces; resolution logic
exists in exactly one place.

---

## Phase 5: User Story 3 — Records not on Apple Music never show a broken or misleading link (Priority: P2)

**Goal**: Harden the "never lie" guarantees — no dead link, no error text, no perpetual spinner, no
generic search link; a transient failure is never stored as a permanent "no match"; the ~20 req/min
limit is respected.

**Independent Test**: Point the resolver at a set of records absent from Apple Music → no link, no
error anywhere. Force an iTunes failure → section degrades silently and the record resolves
successfully on a later view.

### Tests (write first, MUST fail)

- [X] T029 [P] [US3] Extend `backend/tests/unit/streaming/resolveStreamingLinks.test.ts`: a thrown `StreamingResolutionError` leaves NO cache entry (second call re-invokes the resolver); a `null` DOES persist (second call does not re-invoke); a resolver that throws does not suppress a sibling resolver's successful link.
- [X] T030 [P] [US3] Extend `backend/tests/integration/streaming/itunesSearchAdapter.integration.test.ts`: a UPC lookup returning an album whose artist is wholly unrelated to a known query artist → `null` (rejected reused/rebadged barcode); a text search returning only ambiguous/partial candidates → `null`.
- [X] T031 [P] [US3] Unit test `backend/tests/unit/streaming/itunesThrottle.test.ts`: the adapter's in-process min-interval throttle spaces outbound calls to ≤ ~20/min; a call that cannot proceed within its window surfaces as `StreamingRateLimitedError` (so it is not cached).
- [X] T032 [P] [US3] Extend `frontend/tests/unit/components/StreamingLinksSection.test.tsx`: on query error the section renders nothing (no `role="alert"`, no spinner left mounted); skeleton, empty, and populated states share the same outer reserved height (assert the min-height class / computed style).

### Implementation

- [X] T033 [US3] Add the in-process minimum-interval throttle to `backend/src/adapters/streaming/itunesSearchAdapter.ts` (module-level; ~3s spacing; a call that would exceed the window rejects with `StreamingRateLimitedError`). Passes T031.
- [X] T034 [US3] Confirm/adjust `matching.ts` + `itunesSearchAdapter.ts` so a mismatched UPC result and ambiguous search results both yield `null` (passes T030); ensure no code path can return a URL that was not matched.
- [X] T035 [US3] Ensure `StreamingLinksSection` gives the section a single fixed outer `min-h-*` shared by skeleton/empty/populated and that the empty/error branch returns `null` (no residual node). Passes T032. Re-consult `emil-design-eng` for the skeleton→collapse transition.

**Checkpoint**: Every "no reliable match" and every transient failure is silent and non-destructive;
rate limit respected.

---

## Phase 6: User Story 4 — Ready for more streaming platforms without rework (Priority: P3)

**Goal**: Prove structurally that a second platform is "add one adapter + one list entry + one
metadata row", touching neither the Apple Music adapter, nor the use case, nor the section.

**Independent Test**: Add a throwaway fake second `StreamingResolverPort` in a test → the use case
returns both links, order follows the list, one failing doesn't affect the other — with no edit to
`itunesSearchAdapter.ts`, `resolveStreamingLinks.ts`, `matching.ts`, or `StreamingLinksSection.tsx`.

### Tests (write first, MUST fail)

- [X] T036 [P] [US4] Unit test `backend/tests/unit/streaming/resolverExtensibility.test.ts`: `createResolveStreamingLinksUseCase({ resolvers: [fakeAppleLike, fakeSpotifyLike], cache })` returns both links in list order; when `fakeSpotifyLike` throws, `fakeAppleLike`'s link is still returned; each platform is cached under its own key.
- [X] T037 [P] [US4] Component test in `StreamingLinksSection.test.tsx`: given `{ links: [{platform:'apple_music',…},{platform:'spotify',…}] }` (synthetic), the section renders an anchor per entry from the metadata map in list order and does not special-case Apple Music; an entry with an unknown platform id is skipped without error.

### Implementation

- [X] T038 [US4] Add JSDoc "adding a platform" checklists to `backend/src/ports/streaming/streamingResolverPort.ts` and to the resolver array in `backend/src/adapters/streaming/streamingRoutes.ts`; make the frontend platform-metadata map in `StreamingLinksSection.tsx` iterate `links[]` generically (lookup by `platform`, skip unknown). Passes T037. (Backend half — port + routes JSDoc checklists — already present; frontend half done: `PLATFORM_META` is a string-keyed registry, render loop filters by `Object.hasOwn`, no `apple_music` special-case.)

**Checkpoint**: The extensibility guarantee (SC-008) is enforced by a test, not just documentation.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T039 [P] Run the full [quickstart.md](quickstart.md) validation (backend `npm test -- streaming`, frontend `npm test -- Streaming streamingApi`, `e2e` `streaming-links`, manual UI pass on all three surfaces + dark mode + keyboard). — Backend streaming subset 7 suites / 75 tests green; full backend 90 suites / 771 tests green (no regressions); frontend 101 files / 769 tests green + `tsc -b` clean + lint clean; e2e `streaming-links` 5/5 green. Quickstart §1–§6 all PASS (manual UI items §4 mapped to automated coverage).
- [X] T040 [P] Accessibility sign-off: axe clean on release / master / library-record detail with the section present and absent; visible focus ring on the link; ≥44×44 px target at mobile width; heading level correct in each page's outline; `prefers-reduced-motion` respected by the skeleton. — PASS, no code changes. axe: `e2e/tests/streaming-links.spec.ts` scans release (present + absent), master (present), library-record (present) with `runAxeScan` asserting zero serious/critical; the "absent" state adds no incremental DOM and the release-absent scan covers it, so master/record-absent are not separately scanned (acceptable). No jsdom `axe` assertion added: the frontend ships no axe test dep and the "present" state is already axe-covered on all three surfaces by e2e — a lone jsdom-axe dep would be weaker (no layout/contrast) and inconsistent (YAGNI). Anchors: accessible name via `aria-label` ("Escuchar en <platform>") plus visible `<span>` label → WCAG 2.5.3 Label-in-Name holds; native `<a href target=_blank rel=noopener noreferrer>` = keyboard-operable, no trap; shared `focusRing` (`focus-visible:ring-2 ring-primary ring-offset-2`) = visible focus; `min-h-11` (44px) target, always wider than 44px, `gap-2` between wrapped pills. Heading: `<h4>` matches the sibling section headings ("Tracklist" h4 on all three pages, "Versions" h4 on master) and follows the page-title `<h3>` — no skipped level on any of the three pages. (Pre-existing, out-of-062-scope: all three detail pages lack an `<h1>` and open at `<h3>`; noted as a follow-up, not a 062 regression.) Icon: `aria-hidden="true"` + `focusable="false"`, meaning carried by the text label, never colour/shape. Skeleton: `motion-safe:animate-pulse` (pulse fully absent — no `animation-name` — under `prefers-reduced-motion`, plus the global reduce block in `global.css`). Contrast: light `text-stone-900`/icon on `bg-stone-50` ≈ 17:1, `border-stone-500` ≈ 4.6:1; dark `text-stone-100`/icon on `surface-raised` ≈ 16:1, `border-border-dark` ≈ 3.75:1 — all clear 4.5:1 text / 3:1 UI-component.
- [X] T041 [P] Apple-design sign-off: section visual weight, spacing, icon treatment, and the skeleton→content / skeleton→collapse motion reviewed against `apple-design` + `emil-design-eng`. — PASS, no code changes. Visual weight: the pill anchor carries the same treatment/weight as the app's `secondary` `Button` (`border-stone-500`, `min-h-11 px-4 py-2`, shared `pressable`+`focusRing`) which already appears higher on these same pages ("Add to wishlist"), and the card matches its `<Card padding="sm">` siblings (Tracklist, Versions, Other details) — it does not out-shout them, and it is deliberately mounted last (research.md §7). Spacing: `gap-3` / `gap-2` / `px-4 py-2` / `min-h-11` all on the Tailwind step scale, consistent with siblings. Icon: `h-5 w-5` inline `currentColor`, decorative — consistent. Motion: skeleton→content and skeleton→collapse are intentional hard swaps with no transition — this matches every other skeleton→content swap in the app (no component animates that boundary) and the research.md §7 decision; skeleton dims (`h-5 w-44` heading, `h-11 w-36` pill, `gap-3`) match the populated layout to ~1px so the swap introduces effectively zero shift; `prefers-reduced-motion` honoured via `Skeleton` + the global reduce block. Minor notes (not fixed — deliberate / out of scope): the anchor hand-rolls its class string rather than reusing `buttonClassName('secondary')` (`rounded-lg` chip radius + a Card-visible `hover:bg-stone-100` vs the helper's `rounded-xl` + Card-invisible `hover:bg-stone-50` — the divergence reads as an intentional chip character); `RESERVED_HEIGHT` `min-h-[4.5rem]` is below the real ~108px content height on both states (harmless floor, and both states share the exact class); this is the only detail section rendered as a named `<section>` region while siblings use a bare `<div>` + `<h4>` (aligning all of them is a cross-cutting follow-up — the accessible region here is the better pattern, not a defect). SpotifyIcon / `spotify` PLATFORM_META row: KEEP as-is. It has zero production surface — `StreamingLink.platform` is typed `'apple_music'` only and no backend Spotify resolver exists, so `data.links` can never contain `spotify` outside the (synthetic) T037 tests; it is the concrete reference for "adding platform #2" the US4 JSDoc points at and keeps the list-order / no-Apple-special-case / skip-unknown tests realistic. "Reduce to a generic inline fallback" would contradict the spec's deliberate design (unknown platforms are silently skipped via an explicit allowlist — there is no generic fallback render path). Strict-adherence follow-up if the team wants it: drop `PLATFORM_META.spotify` + `SpotifyIcon.tsx` and inject a fake registry into the three extensibility tests (a non-trivial test refactor, not a small change).
- [X] T042 [P] Backend observability check: `logger` lines for `matched` / `no_match` / `transient_failure` are structured and greppable; confirm no internal error detail (stack, upstream body) ever reaches the `200` response or a user-visible string. — Request/use-case lines (`matched` / `no_match` / `transient_failure` / `success`) already PASS: all use the `LogEvent` shape, are greppable by `route` + `outcome`, carry platform/method/storefront/uid, and `transient_failure` logs only `code: domainMessage` (never `cause`); contract test already guards no stack/upstream-body leak and a `links`-only 200 body. Gap closed: the iTunes adapter's own throttle/retry were invisible — a local min-interval fast-fail was logged upstream identically to an Apple 403. Added lean adapter lines: `streaming:itunes:throttle` `throttled` (info, `waitMs`) and `rate_limited` (warn, `reason: local_min_interval_exceeded`), and `streaming:itunes` `retry` (warn, `path`/`attempt`/`status`/`code`). New `retry` `LogOutcome`. Tests extended in `itunesThrottle.test.ts` + `itunesSearchAdapter.integration.test.ts`.
- [X] T043 Update `README` / developer notes only if an env var is introduced (`ITUNES_SEARCH_BASE_URL`, test-only) — otherwise no doc change (CHANGELOG/version are CI-managed per the constitution; do not edit them). — No doc change made. Per the task rule (mirror where `DISCOGS_BASE_URL` is documented): `DISCOGS_BASE_URL` — the catalog base-URL override read in `discogsCatalogAdapter.ts` — is documented nowhere (not in `backend/README.md`'s env table, no `backend/.env.example` exists, not in the root README; only ad-hoc prose in `specs/029` & `specs/040` quickstarts). Sibling test-only overrides (`DISCOGS_OAUTH_BASE_URL`, `DISCOGS_AUTHORIZE_BASE_URL`, `GOOGLE_*_BASE_URL`) *are* in the README table — if the team wants consistency, a one-line `| \`ITUNES_SEARCH_BASE_URL\` | test only | Overrides \`https://itunes.apple.com\` for the iTunes Search API (nock/integration tests) |` row there would be the place.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies.
- **Phase 2 (Foundational)**: depends on Phase 1. **Blocks Phases 3–6.**
- **Phase 3 (US1)**: depends on Phase 2. MVP.
- **Phase 4 (US2)**: depends on Phase 3 (reuses `StreamingLinksSection` from T021).
- **Phase 5 (US3)**: depends on Phase 2; independent of Phase 4 (can run in parallel with it). Some tasks refine Phase 2/3 files.
- **Phase 6 (US4)**: depends on Phase 2 (use case + component). Independent of Phases 4–5.
- **Phase 7 (Polish)**: depends on all targeted stories.

### Key within-phase dependencies

- T009 ← T004; T010 ← T005; T012 ← T009, T011; T013 ← T011; T014 ← T010, T012, T013.
- T016 ← T015; T017 ← T016.
- T021 ← T017, T018; T022 ← T021; T020 ← T021.
- T027, T028 ← T021.
- T033 ← T012; T035 ← T021.
- T038 ← T013, T021.

### Parallel opportunities

- Phase 1: T001, T002, T003 all in parallel.
- Phase 2 tests: T004, T005, T006, T007, T008, T015 all in parallel (all fail).
- Phase 2 impl: T009 ∥ T010; then T011; then T012 ∥ T013; then T014. T016 ∥ the backend track; T017 after T016.
- After Phase 3: Phases 4, 5, 6 can proceed in parallel (different files, aside from the noted refinements).
- Phase 7: T039–T042 in parallel.

---

## Parallel Example: Phase 2 foundational tests

```bash
Task: "Unit test matching.test.ts in backend/tests/unit/streaming/"
Task: "Unit test storefront.test.ts in backend/tests/unit/streaming/"
Task: "Unit test resolveStreamingLinks.test.ts in backend/tests/unit/streaming/"
Task: "Contract test streamingLinks.contract.test.ts in backend/tests/contract/streaming/"
Task: "Integration test itunesSearchAdapter.integration.test.ts (nock) in backend/tests/integration/streaming/"
Task: "Unit test streamingApi.test.ts in frontend/tests/unit/services/"
```

---

## Implementation Strategy

### MVP (Phases 1 → 2 → 3)

1. Setup (T001–T003).
2. Foundational (T004–T017) — the whole backend resolution pipeline + frontend data layer, test-first.
3. US1 (T018–T023) — section on the release detail page.
4. **STOP & VALIDATE**: quickstart §2 + §4 (release page) + e2e. Deploy/demo — Apple Music links are live on the primary surface.

### Incremental delivery

- + US2 (T024–T028): section on master + library-record detail. Demo.
- + US3 (T029–T035): hardening. Demo (force-fail iTunes, show silent degradation).
- + US4 (T036–T038): extensibility test locked in.
- + Polish (T039–T043).

---

## Notes

- Constitution I: every impl task's test is written and failing first; commit test + impl separately or as a logical group.
- Constitution VIII: `axios` only in `adapters/streaming/`; `domain/streaming/` imports nothing but other domain modules.
- Constitution IX: the frontend hits only `/api/streaming/links`; the rendered link is a passive `<a target="_blank">`, not a JS request.
- Constitution X/XI: the section is not exempt because it "looks small" — run the design + a11y skills before building T021 and again at T041.
- Do NOT edit `frontend/CHANGELOG.md` / `backend/CHANGELOG.md` or `version` fields (CI-managed).

# Implementation Plan: "Escúchalo en Streaming" — Direct Streaming Platform Links on Record Detail

**Branch**: `062-streaming-platform-links` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/062-streaming-platform-links/spec.md`

## Summary

Add a reusable **"Escúchalo en streaming"** section to every record-detail surface that shows, for
a given record, direct links to the streaming platforms where that record actually exists. Only
**Apple Music** is resolved in this version, via the free, unauthenticated **iTunes Search API**
(barcode/UPC lookup first, artist+title search fallback), against the viewing user's locale-derived
storefront. A resolution outcome — match or confirmed no-match — is cached for **90 days**, keyed by
platform + record identity + storefront. Platforms resolve independently; a failure or absent match
for one never affects the others; a platform with no reliable match is simply omitted (never a
broken link, error, or generic search link).

Backend: a new `streaming` domain following the existing **ports & adapters** pattern — one
`StreamingResolverPort` per platform, an `itunesSearchAdapter` implementing it for Apple Music, a
`resolveStreamingLinks` use case that fans out over the registered resolvers with per-platform
isolation, and a driving `GET /api/streaming/links` route. Adding Spotify/Amazon/Deezer/Tidal later
= adding one adapter to the resolver list, no change to existing code.

Frontend: a single `StreamingLinksSection` component (+ a query hook + an api service) mounted on
`ReleaseDetailPage`, `MasterReleaseDetailPage`, and `RecordDetailPage`. It shows a skeleton in
reserved space while resolving, then fills in the resolved links in place or collapses to nothing.

## Technical Context

**Language/Version**: TypeScript (backend Node.js / Express; frontend React 19 + Vite). Matches the
existing stack; no new language.

**Primary Dependencies**: Backend — Express, `axios` (already used by `discogsCatalogAdapter` /
`feedSourceAdapter`), `nock` (already a dev dep, for adapter tests). Frontend — React,
`@tanstack/react-query` (already used for all catalog reads). **No new runtime dependency is
required** — the iTunes Search API is a plain HTTPS+JSON GET.

**Storage**: Redis via the existing `CachePort` / `cacheAdapter` (`withCache(key, ttlSeconds,
fetcher)`), fail-soft. No Firestore, no schema change. Cache key namespace: `streaming:*`. TTL:
`90 * 24 * 60 * 60` seconds (7 776 000).

**Testing**: Backend — Jest (`unit` / `contract` / `integration`), `nock` for the iTunes HTTP
boundary, existing Firebase-emulator harness for route/auth. Frontend — Vitest + React Testing
Library. e2e — Playwright with browser-network route interception of `**/api/streaming/links**`
(same technique as the existing release-detail suite).

**Target Platform**: Existing Vercel-deployed web app (backend API + SPA frontend).

**Project Type**: Web application (`backend/` + `frontend/` + `e2e/`).

**Performance Goals**: Cache hit → section resolves server-side in <50 ms. Cache miss → resolved
within ~2 s p95 (bounded by a per-call timeout on the iTunes request). The detail-page render is
never blocked on resolution (the section loads independently and fills in).

**Constraints**:
- iTunes Search API documented limit ≈ 20 requests/minute (HTTP 403 when exceeded). Mitigated by
  the 90-day cache and a small in-process minimum-interval throttle in the adapter; a throttled or
  rejected call surfaces as a transient failure (not cached, retried on a later view).
- Per-platform isolation is a hard requirement (FR-005): one resolver throwing/timing out must not
  affect another's result.
- No layout shift beyond the section's own area (FR-017): the section is placed **last** in the
  detail layout so a skeleton→collapsed transition moves nothing meaningful.
- Constitution IX: the frontend calls only `/api/streaming/*` on our own backend — never
  `itunes.apple.com` directly.

**Scale/Scope**: Personal-scale collector app. Catalog is large but access is per-record and
long-tailed; with a 90-day cache, sustained iTunes traffic stays far below the rate limit. Scope of
this feature: 1 new backend domain (~6 files), 1 new route, 3 frontend mount points, 1 new
component + hook + service.

### Surface mapping (resolves a spec/codebase discrepancy)

The spec names three surfaces: "search preview popup", "release/master detail page", "library /
wantlist record detail". The **search preview popup was removed** (features 013/014 → a later
refactor; `frontend/tests/integration/searchResultsFlow.test.tsx` asserts "no preview control on
the card" — a search result now navigates straight to the detail page). The real, current surfaces
are the three detail page components:

| Spec surface | Current component | Route | Records shown |
|---|---|---|---|
| Search preview popup + release/master detail (from search) | `ReleaseDetailPage` | `/app/releases/:discogsId` | search results, **wantlist** releases |
| " (master) | `MasterReleaseDetailPage` | `/app/masters/:discogsId` | search-result masters |
| Library / wantlist record detail | `RecordDetailPage` | `/app/library/records/:entryId` | **library** records |

The `StreamingLinksSection` mounts in all three. If a preview popup is reintroduced later, the same
component drops in unchanged — which is exactly the reuse guarantee the spec asks for (FR-002).

## Constitution Check

*GATE: re-checked after Phase 1 design — still PASS.*

| Principle | Assessment |
|---|---|
| **I. Test-First (NON-NEGOTIABLE)** | PASS — every task in `tasks.md` will be authored test-first: domain matching/storefront pure-unit tests, use-case isolation tests, `nock` adapter tests, a route contract test, Vitest component tests, and a Playwright e2e flow, each written and failing before implementation. |
| **II. Discogs Integration-First & Modularity** | PASS — no new Discogs usage; the feature consumes `Release.identifiers` / `artists` / `title` already returned by `discogsCatalogAdapter` (FR-003), adds no Discogs request, and the new external source (iTunes) is a reusable, independently testable adapter+port+cache module mirroring the Discogs integration's shape. |
| **III. Simplicity, YAGNI & KISS** | PASS — one platform now; the "extensibility" is only a `StreamingResolverPort` + an array of resolvers (the minimum needed for FR-006), not a plugin framework. No new dependency, no new datastore, no per-user country field (Clarifications: locale-derived). Reuses `CachePort`, `axios`, `nock`. |
| **IV. SOLID Design** | PASS — SRP: matching logic (domain) vs. HTTP/shape (adapter) vs. orchestration (use case) vs. HTTP translation (route) are separate. OCP/DIP: the use case depends on `StreamingResolverPort[]`, not on iTunes; a new platform extends the list without modifying the use case, the Apple Music adapter, or the component (FR-006, FR-015). |
| **V. Observability** | PASS — FR-019: each resolution attempt logs `{ route, platform, method: 'barcode'\|'text', outcome: 'matched'\|'no_match'\|'transient_failure', storefront }` via the existing structured `logger`, consistent with `discogsRoutes` / `feeds` logging. |
| **VI. Versioning & Breaking Changes** | PASS — purely additive: a new route, a new additive response, a new optional UI section. No API contract, schema, or stored-data change. MINOR (`feat:`). Changelog/version handled by CI (not touched). |
| **VII. Curated Ratings & Music News — graceful per-source degradation** | PASS (directly analogous) — the "each external source degrades independently, the rest of the page still renders" rule from Principle VII is exactly FR-005/FR-014: one platform failing never fails the section, and the section failing never fails the detail page. |
| **VIII. Hexagonal Architecture (Backend)** | PASS — new folders `backend/src/domain/streaming/`, `application/streaming/`, `ports/streaming/`, `adapters/streaming/`. Domain (matching, types, errors) imports no SDK; `axios` appears only in `adapters/streaming/itunesSearchAdapter.ts`; the Express route is a thin driving adapter translating query params → use case → JSON, throwing/catching domain `StreamingResolutionError`. |
| **IX. Frontend Network Requests — Backend-Only** | PASS — the frontend calls only `GET /api/streaming/links` on our backend; `itunes.apple.com` is contacted server-side only. The resolved link is rendered as a native `<a href target="_blank">` (passive navigation, not a JS request). |
| **X. Accessibility — WCAG 2.1 AA (NON-NEGOTIABLE)** | PASS — FR-018 + design: `<section>` with a heading; each link is an `<a>` with a text or `aria-label` accessible name ("Escuchar en Apple Music"), visible focus (`focusRing`), ≥44×44 px touch target, not colour/icon-shape-only (visible platform name or `aria-label` + `title`). Skeleton uses the constitution's `animate-pulse` pattern and respects `prefers-reduced-motion`. An `axe` scan is part of the e2e suite. |
| **XI. Apple Design Principles** | PASS — consult `apple-design` / `emil-design-eng` before building the section; use the existing `Card` pattern, `--font-display` only for the section heading if consistent with sibling sections (likely a normal `font-semibold` label like "Tracklist"), soft shadow, spacing scale. Skeleton-to-content transition uses the project's motion conventions and honours reduced-motion. |

**No entries in Complexity Tracking** — no principle requires a deviation.

## Project Structure

### Documentation (this feature)

```text
specs/062-streaming-platform-links/
├── plan.md              # This file
├── research.md          # Phase 0 — iTunes Search API, storefront mapping, matching, caching
├── data-model.md        # Phase 1 — entities, cache key, response shape
├── quickstart.md        # Phase 1 — how to validate end-to-end
├── contracts/
│   └── streaming-links-api.md   # GET /api/streaming/links contract
└── checklists/
    └── requirements.md  # (from /speckit-specify + /speckit-clarify)
```

### Source Code (repository root)

```text
backend/src/
├── domain/streaming/
│   ├── types.ts                  # StreamingPlatform, Storefront, StreamingLinkQuery,
│   │                             #   ResolvedStreamingLink, StreamingLinksResult
│   ├── streamingErrors.ts        # StreamingResolutionError (code: 'unavailable' | 'rate_limited')
│   └── matching.ts               # normalizeArtist/Title, isReliableAlbumMatch (pure)
├── application/streaming/
│   └── resolveStreamingLinks.ts  # use case: fan out over StreamingResolverPort[], per-platform
│                                 #   isolation, cache per (platform, recordKey, storefront)
├── ports/streaming/
│   └── streamingResolverPort.ts  # StreamingResolverPort { platform; resolve(query) }
└── adapters/streaming/
    ├── itunesSearchAdapter.ts    # Apple Music resolver (axios + nock-testable); UPC lookup → search
    ├── storefront.ts             # localeToStorefront(acceptLanguage?, explicitLocale?) → country code
    └── streamingRoutes.ts        # GET /api/streaming/links (driving adapter, requireAuth)
# wiring: backend/src/app.ts  →  app.use('/api/streaming', streamingRouter)

backend/tests/
├── unit/streaming/
│   ├── matching.test.ts
│   ├── storefront.test.ts
│   └── resolveStreamingLinks.test.ts
├── contract/streaming/
│   └── streamingLinks.contract.test.ts
└── integration/streaming/
    └── itunesSearchAdapter.integration.test.ts   # nock

frontend/src/
├── services/streamingApi.ts        # getStreamingLinks({ barcodes, artist, title, locale })
├── queries/streamingQueries.ts     # useStreamingLinks(inputs) — TanStack Query, long staleTime
└── components/
    ├── StreamingLinksSection.tsx    # the reusable section (derives barcodes from identifiers)
    └── ui/icons/AppleMusicIcon.tsx  # inline SVG, currentColor
# mount points: ReleaseDetailPage.tsx, MasterReleaseDetailPage.tsx, RecordDetailPage.tsx

frontend/tests/
├── unit/components/StreamingLinksSection.test.tsx
└── unit/services/streamingApi.test.ts

e2e/tests/
└── streaming-links.spec.ts         # match shown / no-match hidden, + axe scan
```

**Structure Decision**: Existing web-app layout. The backend change is a new self-contained
hexagonal domain (`streaming`) plus one line of route wiring in `app.ts`. The frontend change is
one new component consumed at three existing mount points, plus a service and a query hook that
follow the `discogsApi` / `discogsQueries` conventions exactly.

## Complexity Tracking

> No Constitution Check violations — this section is intentionally empty.

## Phase 0 — Research

See [research.md](research.md). Resolves: iTunes Search API request/response shape and failure
modes; UPC-lookup vs. text-search strategy and match-acceptance rules; locale → storefront mapping;
cache key design and 90-day TTL behaviour with a fail-soft Redis; per-platform isolation approach;
in-process throttle for the ~20 req/min limit; where the section sits in the detail layout.

## Phase 1 — Design & Contracts

- [data-model.md](data-model.md) — `StreamingPlatform`, `Storefront`, `StreamingLinkQuery`,
  `ResolvedStreamingLink`, `StreamingLinksResult`, `StreamingResolutionError`, the derived cache
  key, and the resolution state machine (matched / no-match / transient-failure).
- [contracts/streaming-links-api.md](contracts/streaming-links-api.md) — `GET /api/streaming/links`
  query params, always-200 response shape, auth, logging, examples.
- [quickstart.md](quickstart.md) — end-to-end validation steps for a matched record, an unmatched
  record, a transient failure, and the "add a second platform" extensibility check.

## Phase 2 — Next

`/speckit-tasks` will generate `tasks.md` from these artifacts (dependency-ordered, test-first).

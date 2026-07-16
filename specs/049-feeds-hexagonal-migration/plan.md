# Implementation Plan: Feeds/RSS Domain Migrated to Hexagonal Architecture

**Branch**: `backend-hexagonal-architecture-refactor` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/049-feeds-hexagonal-migration/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Move the RSS/news dashboard domain (`backend/src/feeds/*`, `backend/src/routes/feeds.ts`)
onto the Hexagonal convention already demonstrated by the library (Historia 2), catalog
(Historia 3), and OAuth+Collection (Historia 4) domains. One new port emerges — a
**`FeedSourcePort`** wrapping the single per-source fetch-and-parse operation
(`fetchFeed(feedUrl, timeoutMs?)`) that `feeds/feedClient.ts` performs today via `axios`
+ `rss-parser` directly. Per this spec's clarification session, the port returns a
domain-owned `RawFeedItem[]` — not `rss-parser`'s own `Parser.Output`/`Parser.Item`
types — so `feedMapper.ts`'s sanitization rules (excerpt truncation, image extraction,
text cleaning) stay in the domain layer as pure functions with zero coupling to the
parsing library, mirroring the catalog domain's own precedent
(`discogsMapper.ts` operates on `unknown`/Zod-validated data, never a named `axios`
type). The aggregation rules (`getDashboard`'s per-source fan-out with
`Promise.allSettled`-based degradation, category grouping, per-category cap;
`getSourceArticles`'s single-source lookup) become one application-layer use case —
combined into a single factory rather than split per Historia 4's one-factory-per-use-case
precedent, because both functions share the exact same private per-source
fetch+cache+map pipeline (`fetchSourceArticles`) today, and splitting them would
duplicate that pipeline rather than reuse it. `routes/feeds.ts` is rewritten into a
driving adapter (`adapters/feeds/feedsRoutes.ts`) limited to invoking the use case and
mapping its result/errors to the existing response shapes. `feedSources.ts` (the static
source catalog) relocates unchanged into `domain/feeds/` — no port needed, since it has
no infrastructure dependency of its own.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node.js (CommonJS), Express 4.19 backend (`backend/package.json`)

**Primary Dependencies**: `axios` 1.7 and `rss-parser` 3.13 (both only inside the new
`adapters/feeds/feedSourceAdapter.ts` after migration), `express` (routing)

**Storage**: None — this domain has no Firestore dependency (verified: no file under
`feeds/` imports `firebase-admin`), so this migration introduces no persistence port.
Redis (optional, read-through per-source cache, 20-minute TTL) — already fail-soft when
unavailable via the shared `CachePort`/`cacheAdapter` (Historia 2/3); this migration
reuses it as-is, adding no new cache behavior

**Testing**: Jest 29 + ts-jest, `firebase emulators:exec --only auth,firestore`
(`backend/package.json` `test` script) — needed only for the Auth emulator that the
contract/integration tests use via `requireAuth`, since this domain itself has no
Firestore data; `nock` 13.5 for stubbing outbound feed-source HTTP calls
(contract/integration tests already do this against real feed-shaped XML fixtures, not
a fake port); two of the ten existing test files use path-sensitive `jest.mock()` calls
targeting `feeds/feedClient`/`feeds/feedSources` by their current module path (verified
below) — both are addressed by this migration, one by relocation-only path fixes, one by
replacing the mock with a fake-port test double

**Target Platform**: Node.js server, deployed as a long-lived warm process (unaffected
by this migration)

**Project Type**: Web application backend (Express REST API); this feature touches
`backend/` only, per Constitution Principle VIII's explicit backend-only scope

**Performance Goals**: No new targets — SC-005 requires byte-for-byte identical HTTP
behavior for the feeds endpoints. The per-source cache (currently a direct
`cache/cacheAside.ts` `withCache` call, 20-minute TTL, `ARTICLES_PER_CATEGORY = 10` cap)
must remain exactly one cache operation per source, now routed through
`CachePort.withCache` instead

**Constraints**: Zero HTTP contract changes for `GET /api/feeds/dashboard` and
`GET /api/feeds/sources/:sourceId`; zero change to per-source failure isolation (one
source failing MUST NOT affect the others' articles or fail the whole request); zero
change to each source's independent per-call timeout (`DEFAULT_TIMEOUT_MS = 8_000`,
already isolated per source by `Promise.allSettled`, not centralized); the feed source
port's return type changes from `rss-parser`'s own `Parser.Output`/`Parser.Item` to a
domain-owned `RawFeedItem[]` per this spec's Clarifications — an internal contract
change the spec explicitly scopes in (FR-012), not a violation of "no behavioral
changes," since no HTTP-observable behavior moves

**Scale/Scope**: 5 source files (~253 lines total: `feedClient.ts` 22,
`feedAggregator.ts` 118, `feedMapper.ts` 97, `feedSources.ts` 76 minus comments,
`types.ts` 46) plus `routes/feeds.ts` (62 lines) relocated/split into ~8 new files
across `domain/feeds/`, `application/feeds/`, `ports/feeds/`, `adapters/feeds/`; 10
existing test files (~1,700 lines) relocated: 4 with import-path-only fixes for their
`jest.mock()` calls (`feedsDashboard.contract.test.ts`,
`feedsDashboardNewSources.integration.test.ts`, `feedsSourceDirect.integration.test.ts`,
`feedsSource.contract.test.ts` — all mock `feedSources`'s new path only, behavior
unchanged), 2 more with import-path fixes only and no `jest.mock()` to fix
(`feedsDashboard.integration.test.ts`, `feedsDashboardExpandedSources.integration.test.ts`),
1 with an import-path fix only (`feedSources.test.ts`), 1 with an import-path fix plus
one fixture shape change (`feedMapper.test.ts` — its `enclosure: { url }` fixture
becomes the flat `enclosureUrl` field `RawFeedItem` uses, same assertions), 1 rewritten
from `jest.mock()`-based module mocking to fake-port/fake-cache test doubles
(`feedAggregator.test.ts` → `getFeedsDashboard.test.ts`, same assertions, different
double mechanism, mirroring `searchCatalogWithRatings.test.ts`'s established pattern),
1 with an assertion-shape update tracking the port's new return type
(`feedClient.test.ts` → `feedSourceAdapter.test.ts`: `feed.items[0].title` →
`feed[0].title`, since the port returns `RawFeedItem[]` directly instead of
`rss-parser`'s `{ items: [...] }` wrapper)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Test-First | Each relocated/new file's test is adjusted (and run red against the new module boundary) before the corresponding file is written, following the same copy-then-cutover strategy validated in the library, catalog, and OAuth+Collection migrations | PASS (enforced by task ordering, see `tasks.md` once generated) |
| II. Discogs Integration-First & Modularity | Not applicable — this domain has no Discogs API dependency; its external integration is RSS/Atom feeds, governed instead by Principle VII's per-source degradation requirement | PASS (N/A, no violation) |
| III. Simplicity, YAGNI & KISS | One `FeedSourcePort` for this domain's one external-system boundary (feed retrieval), not split by source or by concern; `getDashboard`/`getSourceArticles` stay combined in one application-layer factory because they share one real implementation detail (`fetchSourceArticles`) today — splitting them would duplicate it, not simplify it; manual factory-function DI, no framework | PASS |
| IV. SOLID Design | Application code depends on `ports/feeds/feedSourcePort.ts` and the shared `ports/cache/cachePort.ts` interfaces, never on concrete `axios`/`rss-parser` modules | PASS |
| V. Observability | Every existing `logger.warn` call in `feedAggregator.ts` (per-source failure) is preserved verbatim in its new location | PASS (verified per-file during relocation) |
| VI. Versioning & Breaking Changes | Purely structural for the public HTTP contract; the feed source port's return type changes (research.md/spec.md FR-012) is an internal contract change with no external API, schema, or stored-data impact | PASS |
| VII. Curated Ratings & Music News | This feature's other core concern alongside Principle VIII — per-source degradation (already implemented via `Promise.allSettled`) is preserved exactly, not redesigned | PASS |
| VIII. Hexagonal Architecture (Ports & Adapters) — Backend | This feature's entire purpose. The static source catalog (`feedSources.ts`) is confirmed to need no port (no infrastructure dependency), and the mapping logic (`feedMapper.ts`) is confirmed to stay domain-level once decoupled from `rss-parser`'s types (spec.md Clarifications) | PASS |

**Deferred, out-of-scope infra (not a violation introduced by this feature)**: The
auth/users domain (`services/userService.ts`, `middleware/requireAuth.ts`,
`firebase-admin`) and the final `CachePort` consolidation are untouched — Historia 6.
`cache/cacheAside.ts` and `cache/redisClient.ts` themselves stay in place (this feature
adds no new method to `CachePort`, only a new consumer of the existing `withCache`) —
relocating those two files is still not triggered by any single domain needing it
exclusively, same reasoning Historias 3 and 4 applied.

## Project Structure

### Documentation (this feature)

```text
specs/049-feeds-hexagonal-migration/
├── plan.md               # This file (/speckit-plan command output)
├── research.md           # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── feed-source-port.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   └── feeds/
│   │       ├── types.ts                     # moved from feeds/types.ts (Article, CategoryGroup, DashboardResponse, SourceStatus, SourceFeedResponse, FeedSourceConfig) + NEW RawFeedItem (spec.md Clarifications, FR-012)
│   │       ├── feedSources.ts                # moved verbatim from feeds/feedSources.ts — static FEED_SOURCES catalog, no port needed
│   │       └── feedMapper.ts                 # moved from feeds/feedMapper.ts — mapFeedItem's business rules unchanged, input type changed from rss-parser's Parser.Item to the new domain-owned RawFeedItem
│   ├── application/
│   │   └── feeds/
│   │       └── getFeedsDashboard.ts           # createFeedsAggregationUseCase — getDashboard (US1) + getSourceArticles (US1), sharing the relocated fetchSourceArticles/groupByCategory helpers; depends on FeedSourcePort + CachePort only
│   ├── ports/
│   │   └── feeds/
│   │       └── feedSourcePort.ts              # FeedSourcePort (US2) — fetchFeed(feedUrl, timeoutMs?): Promise<RawFeedItem[]>
│   ├── adapters/
│   │   └── feeds/
│   │       ├── feedSourceAdapter.ts           # implements FeedSourcePort; axios + rss-parser, relocated from feeds/feedClient.ts, translates Parser.Output.items → RawFeedItem[] at the boundary (spec.md FR-012)
│   │       └── feedsRoutes.ts                 # driving adapter (was routes/feeds.ts) — parsing + one use-case call + existing 404/500 response mapping
│   ├── feeds/                                  # DELETED once all four files relocate (feedClient.ts, feedAggregator.ts, feedMapper.ts, feedSources.ts, types.ts)
│   ├── routes/feeds.ts                         # DELETED — replaced by adapters/feeds/feedsRoutes.ts
│   └── app.ts                                   # one-line import path update: routes/feeds → adapters/feeds/feedsRoutes
└── tests/
    ├── unit/
    │   └── feeds/
    │       ├── domain/
    │       │   ├── feedMapper.test.ts                  # relocated from unit/feedMapper.test.ts; fixture items updated from Parser.Item shape to RawFeedItem shape, same assertions
    │       │   └── feedSources.test.ts                 # relocated from unit/feedSources.test.ts, unchanged assertions
    │       ├── adapters/
    │       │   └── feedSourceAdapter.test.ts            # relocated from unit/feedClient.test.ts; return-shape assertions updated (feed.items[0] → feed[0]) per FR-012, same nock stubs
    │       └── application/
    │           └── getFeedsDashboard.test.ts             # relocated+rewritten from unit/feedAggregator.test.ts; jest.mock('feeds/feedClient')/jest.mock('feeds/feedSources') replaced by a fake FeedSourcePort + fake CachePort, same assertions, mirrors searchCatalogWithRatings.test.ts's pattern
    ├── integration/
    │   └── feeds/
    │       ├── feedsDashboard.integration.test.ts                  # relocated, jest.mock path fixed, unchanged assertions
    │       ├── feedsDashboardExpandedSources.integration.test.ts   # relocated, import path fixed, unchanged assertions
    │       ├── feedsDashboardNewSources.integration.test.ts        # relocated, jest.mock path fixed, unchanged assertions
    │       └── feedsSourceDirect.integration.test.ts               # relocated, jest.mock path fixed (feedSources only — the ioredis mock is unaffected), unchanged assertions
    └── contract/
        └── feeds/
            ├── feedsDashboard.contract.test.ts   # relocated, jest.mock path fixed, unchanged assertions
            └── feedsSource.contract.test.ts       # relocated, jest.mock path fixed, unchanged assertions
```

**Structure Decision**: Web application backend, Hexagonal layers as global top-level
folders under `backend/src/` per Constitution Principle VIII, mirroring the library,
catalog, and OAuth+Collection domains' precedent exactly. `ports/feeds/` and
`adapters/feeds/` are new, domain-scoped folders (not shared, unlike `ports/cache/`)
since no other domain needs `FeedSourcePort` — this is the smallest of the five domains
in the parent HU, with no cross-domain consumers to reconcile (unlike Historia 4's
retirement of the library domain's provisional ports). Tests mirror the same domain
grouping under `backend/tests/{unit,integration,contract}/feeds/`, split by layer inside
`tests/unit/` (`domain/`, `adapters/`, `application/`) — the same `unit/<domain>/<layer>/`
nesting Historia 3 introduced and Historia 4 continued.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

*No violations requiring justification — the deliberate deviation (the port's return
type diverging from a byte-for-byte pass-through of `rss-parser`'s own output) is
documented above in the Constitution Check and Technical Context as a scoped-in,
spec-mandated change (FR-012), not a violation this feature introduces or must defend.*

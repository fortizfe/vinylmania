# Implementation Plan: Discogs Catalog Domain Migrated to Hexagonal Architecture

**Branch**: `047-discogs-catalog-hexagonal-migration` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/047-discogs-catalog-hexagonal-migration/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Move the Discogs catalog domain (`backend/src/discogs/discogsClient.ts`,
`backend/src/routes/discogs.ts`) onto the Hexagonal convention already demonstrated by
the library domain (Historia 2): raw catalog access (release/artist/master/master-
versions/rating lookups) behind a new `DiscogsCatalogPort` in `ports/discogsCatalog/`,
implemented by `adapters/discogsCatalog/discogsCatalogAdapter.ts`; the search
rating-enrichment rule pulled out into a new `application/discogsCatalog/` use case
that depends only on the port; and `routes/discogs.ts` rewritten into a driving
adapter limited to parsing/validation, one use-case call, and error mapping. The
library domain's `CachePort` (Historia 2) is **relocated and extended** — not
duplicated — to a shared `ports/cache/`/`adapters/cache/` location with a new
`withCache<T>` read-through method matching `cache/cacheAside.ts`'s existing contract,
since the catalog domain needs that capability and the library domain never did. The
shared resilience modules (`discogsRateLimiter.ts`, `discogsCircuitBreaker.ts`,
`discogsRetry.ts`) and the cross-domain `discogsErrors.ts` stay exactly where they are
— they are also imported by the not-yet-migrated `collectionClient.ts` (Historia 4),
so relocating them now would break that file. `discogsMapper.ts` and the catalog's
pure types (`discogs/types.ts`) do move, since nothing outside this domain's own
already-migrated library consumers touches them.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node.js (CommonJS), Express 4.19 backend (`backend/package.json`)

**Primary Dependencies**: `axios` 1.7 (Discogs HTTP, only inside the new
`adapters/discogsCatalog/discogsCatalogAdapter.ts` after migration), `ioredis` 5.11
(via `cache/redisClient.ts` — unchanged location, now wrapped by the relocated/shared
`adapters/cache/cacheAdapter.ts`), `express` (routing)

**Storage**: Redis (optional, read-through cache for release/artist/master/master-
versions/rating lookups and for fully-enriched search responses) — already fail-soft
when unavailable; this migration preserves that behavior exactly, it does not change it.
No Firestore access in this domain (catalog data is not persisted locally)

**Testing**: Jest 29 + ts-jest, `firebase emulators:exec --only auth,firestore` for the
contract/integration tests that go through `requireAuth` (`backend/package.json` `test`
script), `nock` for stubbing outbound Discogs HTTP calls, `ioredis-mock` for
Redis-backed integration tests

**Target Platform**: Node.js server, deployed as a long-lived warm process (unaffected
by this migration — the resilience modules' own doc comments already note they are
"best-effort per warm process, not globally coordinated across serverless instances")

**Project Type**: Web application backend (Express REST API); this feature touches
`backend/` only, per Constitution Principle VIII's explicit backend-only scope

**Performance Goals**: No new targets — SC-004 requires byte-for-byte identical HTTP
behavior. Explicitly preserved: a cached search response must remain a single cache
read (see research.md Decision 2) — splitting rating enrichment out of `searchCatalog`
must not turn a cache hit into N extra rating-cache lookups per request

**Constraints**: Zero HTTP contract changes for the catalog endpoints; zero change to
resilience/rate-limiting behavior (explicitly out of scope per the parent user story);
zero change to the "masters surface first" search-result ordering; the relocated
`CachePort` must remain a strict superset of its Historia 2 shape (`has`/`set`
unchanged) so the library domain's existing consumers need only an import-path update,
not a behavior change

**Scale/Scope**: 1 source file (`discogsClient.ts`, 458 lines) plus `routes/discogs.ts`
(286 lines) relocated/split into ~7 new files across `domain/discogsCatalog/`,
`application/discogsCatalog/`, `ports/discogsCatalog/`, `adapters/discogsCatalog/`,
plus the `CachePort` relocation (`ports/cache/`, `adapters/cache/`); 13 test files
named in the parent user story relocated/adapted; 3 existing cross-domain call sites
(2 in the already-migrated library domain, 1 test file in the not-yet-migrated
collection domain) get an import-path fix, per spec.md FR-009

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Test-First | Each relocated/new file's test is adjusted (and run red against the new module boundary) before the corresponding file is written, following the same copy-then-cutover strategy validated in the library migration | PASS (enforced by task ordering, see `tasks.md` once generated) |
| II. Discogs Integration-First & Modularity | `discogsRateLimiter.ts`, `discogsCircuitBreaker.ts`, `discogsRetry.ts`, `discogsErrors.ts` are not touched or duplicated — the new adapter imports them from their current, shared location; `discogsMapper.ts` is relocated unchanged | PASS |
| III. Simplicity, YAGNI & KISS | `CachePort`'s `withCache<T>` addition matches an already-existing, already-battle-tested contract (`cacheAside.ts`) verbatim — no new caching design; manual factory-function DI, no framework | PASS |
| IV. SOLID Design | Application code depends on `ports/discogsCatalog/*` and `ports/cache/*` interfaces, never on concrete `axios`/`ioredis` modules | PASS |
| V. Observability | Every existing `logger.info/warn/error` call in `discogsClient.ts`/`routes/discogs.ts` is preserved verbatim in its new location | PASS (verified per-file during relocation) |
| VI. Versioning & Breaking Changes | Purely structural; no API contract, schema, or stored-data change | PASS |
| VII. Curated Ratings & Music News | The community-rating enrichment rule's graceful per-result degradation (a failed/slow rating lookup never fails the whole search) is exactly what this principle requires — this migration relocates that rule, it does not weaken it | PASS |
| VIII. Hexagonal Architecture (Ports & Adapters) — Backend | This feature's entire purpose. See "Deferred, out-of-scope infra" below for the one deliberate, tracked exception | PASS (with tracked exception below) |

**Deferred, out-of-scope infra (not a violation introduced by this feature)**:
`discogs/collection/collectionClient.ts` and `discogs/oauth/discogsOauthService.ts`
keep importing `axios`/`firebase-admin` directly — migrating them is Historia 4's
scope. Both also import `discogsRateLimiter.ts`/`discogsCircuitBreaker.ts`/
`discogsRetry.ts` (verified: their own doc comments describe them as shared across
"both Discogs HTTP clients") — those three modules are **not** relocated by this
feature for exactly the same "would break a not-yet-migrated domain" reason
`cache/cacheAside.ts` and `cache/redisClient.ts` were not relocated by Historia 2.
`discogsErrors.ts` is left in place too: it is the cross-domain error hierarchy
Constitution Principle VIII's own Rationale cites as already-conformant, consumed by
every Discogs-adjacent domain (library, catalog, and — once migrated — collection and
oauth).

## Project Structure

### Documentation (this feature)

```text
specs/047-discogs-catalog-hexagonal-migration/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── discogs-catalog-port.md
│   └── cache-port.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   └── discogsCatalog/
│   │       └── types.ts                    # moved verbatim from discogs/types.ts (Release, Artist, MasterRelease, CatalogSearchResult, CommunityRating, ...)
│   ├── application/
│   │   └── discogsCatalog/
│   │       └── searchCatalogWithRatings.ts # the rating-enrichment use case (US2) — owns the search cache-wrap, see research.md Decision 2
│   ├── ports/
│   │   ├── discogsCatalog/
│   │   │   └── discogsCatalogPort.ts       # DiscogsCatalogPort (US1)
│   │   └── cache/
│   │       └── cachePort.ts                # relocated + extended from ports/library/cachePort.ts (adds withCache<T>)
│   ├── adapters/
│   │   ├── discogsCatalog/
│   │   │   ├── discogsMapper.ts            # moved verbatim from discogs/discogsMapper.ts
│   │   │   ├── discogsCatalogAdapter.ts    # implements DiscogsCatalogPort; axios client + resilience wiring, relocated from discogsClient.ts
│   │   │   └── discogsRoutes.ts            # driving adapter (was routes/discogs.ts)
│   │   ├── cache/
│   │   │   └── cacheAdapter.ts             # relocated + extended from adapters/library/cacheAdapter.ts (implements has/set/withCache)
│   │   └── library/                        # updated: syncLibrary wiring now imports the shared cache port/adapter (import-path fix only)
│   ├── discogs/                            # discogsRateLimiter.ts, discogsCircuitBreaker.ts, discogsRetry.ts, discogsErrors.ts stay — shared with not-yet-migrated collectionClient.ts/discogsOauthService.ts
│   ├── cache/                              # unchanged: cacheAside.ts, redisClient.ts (still not relocated — Historia 6's job)
│   ├── application/library/                # syncLibrary.ts: import-path fix only (CachePort's new shared location)
│   └── app.ts                              # one-line import path update: routes/discogs → adapters/discogsCatalog/discogsRoutes
└── tests/
    ├── unit/
    │   └── discogsCatalog/
    │       ├── application/
    │       │   └── searchCatalogWithRatings.test.ts  # new — the enrichment rule against a fake port
    │       └── adapters/                              # discogsMapper.test.ts
    ├── integration/
    │   └── discogsCatalog/
    │       ├── discogsCaching.test.ts
    │       ├── discogsCacheOutage.test.ts
    │       ├── discogsRateLimitSmoothing.test.ts
    │       ├── discogsRetryResilience.test.ts
    │       └── discogsClient.live.test.ts
    └── contract/
        └── discogsCatalog/
            ├── discogsClient.contract.test.ts
            ├── discogsRelease.contract.test.ts
            ├── discogsSearch.contract.test.ts
            └── discogsMaster.contract.test.ts
```

`discogsRateLimiter.test.ts`/`discogsCircuitBreaker.test.ts`/`discogsRetry.test.ts`
are **not** relocated (research.md Decision 1) — they stay at their current
`tests/unit/` path, unchanged, since their subject files stay in place too.

**Structure Decision**: Web application backend, Hexagonal layers as global top-level
folders under `backend/src/` per Constitution Principle VIII, mirroring the library
domain's precedent exactly. `ports/cache/` and `adapters/cache/` are a shared,
domain-agnostic pair (not nested under `discogsCatalog/`) because — unlike Historia
2's provisional per-domain ports — this is the second domain to consume `CachePort`,
which is exactly the trigger research.md Decision 4 (library migration) named for
graduating it out of a single domain's folder. Tests mirror the same domain grouping
under `backend/tests/{unit,integration,contract}/discogsCatalog/`, except the three
resilience-module unit tests that aren't moving because their subject files aren't
moving either.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

*No violations requiring justification — the deliberate deviations (resilience
modules and `discogsErrors.ts` staying in `discogs/`) are documented above in the
Constitution Check as explicitly tracked, shared-infrastructure carry-overs, not
violations this feature introduces or must defend.*

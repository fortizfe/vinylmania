# Implementation Plan: Library Domain Migrated to Hexagonal Architecture

**Branch**: `046-library-hexagonal-migration` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/046-library-hexagonal-migration/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Move the user-library domain (`backend/src/library/*`, `backend/src/routes/library.ts`) onto the
four-layer Hexagonal convention ratified as Constitution Principle VIII: pure business rules and
types in `domain/library/`, orchestration (CRUD use cases, sync/reconciliation, enrichment) in
`application/library/`, four new port interfaces in `ports/library/`
(`LibraryRepositoryPort`, `DiscogsCollectionPort`, `DiscogsConnectionPort`, `CachePort`), and thin
adapters in `adapters/library/` that satisfy those ports by delegating to the existing,
**unmoved** infrastructure modules (`config/firebase-admin.ts`, `discogs/collection/collectionClient.ts`,
`discogs/oauth/discogsOauthService.ts`, `cache/redisClient.ts`). No business rule, HTTP contract, or
observable behavior changes — this is a structural relocation plus a dependency-direction fix,
verified by relocating the domain's existing test suite alongside the code and confirming it stays
green with unit tests now injecting fake ports instead of `jest.mock()`-ing module paths.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node.js (CommonJS), Express 4.19 backend (`backend/package.json`)

**Primary Dependencies**: `firebase-admin` 12.3 (Firestore, via `config/firebase-admin.ts` — unchanged
location), `axios` 1.7 (Discogs HTTP, only inside the not-yet-migrated `discogs/collection/collectionClient.ts`
and `discogs/discogsClient.ts`), `ioredis` 5.11 (via `cache/redisClient.ts` — unchanged location),
`zod` (HTTP body/query validation in the driving adapter), `express` (routing)

**Storage**: Firestore (`users/{uid}/libraryEntries` for library entries, read-only dependency on
`discogsConnections/{uid}` for the linked account) and Redis (optional sync-freshness marker,
optional Discogs field-map cache) — both already fail-soft when unavailable; this migration
preserves that behavior exactly, it does not change it

**Testing**: Jest 29 + ts-jest, `firebase emulators:exec --only auth,firestore` for
integration/contract tests (`backend/package.json` `test` script, 300s timeout via
`scripts/run-with-timeout.js`), `supertest` for HTTP contract tests, `nock` for stubbing outbound
Discogs HTTP calls, `ioredis-mock` for Redis-backed integration tests

**Target Platform**: Node.js server, deployed as a long-lived warm process (see the "warm
serverless container" memoization comments already in `config/firebase-admin.ts` and
`cache/redisClient.ts` — unaffected by this migration)

**Project Type**: Web application backend (Express REST API) — one of two projects in this repo
(`backend/`, `frontend/`); this feature touches `backend/` only, per Constitution Principle VIII's
explicit backend-only scope

**Performance Goals**: No new targets — SC-004 requires byte-for-byte identical HTTP behavior, so
the bar is "no regression," not a new number

**Constraints**: Zero HTTP contract changes (`specs/016-library-discogs-sync/contracts/library-sync-api.md`
stays valid unmodified); zero reconciliation-rule changes (union-merge on first sync, mirror mode
after); the cache-backed sync marker's exact fail-soft behavior (`client === null` never fails a
sync) must be preserved through the new `CachePort`, not reimplemented; the relocated test suite
must keep passing inside the existing 300s Jest/emulator budget

**Scale/Scope**: 4 source files under `library/` (`libraryService.ts`, `librarySyncService.ts`,
`libraryEnrichment.ts`, `types.ts`) plus `routes/library.ts` relocated/split into ~14 new files
across `domain/library/`, `application/library/`, `ports/library/`, `adapters/library/`; 5 test
files explicitly named in the parent user story (plus `libraryEnrichment.test.ts`, part of
`library/*`) relocated/adapted — no change to per-user data volume assumptions ("few hundred
records" per `libraryService.ts`'s existing pagination comment)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Test-First | Each relocated/new file's test is adjusted (and run red against the new module boundary) before the corresponding `domain`/`application`/`ports`/`adapters` file is written, per task in Phase 2 | PASS (enforced by task ordering, see `tasks.md` once generated) |
| II. Discogs Integration-First & Modularity | `DiscogsCollectionPort`'s adapter delegates to the existing `collectionClient.ts` unchanged — the shared resilience modules (`discogsRateLimiter`, `discogsCircuitBreaker`, `discogsRetry`) are not touched or duplicated | PASS |
| III. Simplicity, YAGNI & KISS | Manual constructor-function dependency injection (each application use case is a factory taking only the ports it needs); no DI framework; no port method not already required by an existing call site | PASS |
| IV. SOLID Design | This feature *is* Dependency Inversion applied to the library domain: application code depends on `ports/library/*` interfaces, never on concrete Firestore/axios/ioredis modules | PASS |
| V. Observability | Every existing `logger.info/warn/error` call in `librarySyncService.ts`/`libraryService.ts`/`routes/library.ts` is preserved verbatim in its new location — none dropped, none added | PASS (verified per-file during relocation) |
| VI. Versioning & Breaking Changes | Purely structural; no API contract, schema, or stored-data change → no MAJOR/MINOR bump required beyond the automated pipeline's normal handling | PASS |
| VII. Curated Ratings & Music News | Not applicable — this feature does not touch ratings or news surfaces | N/A |
| VIII. Hexagonal Architecture (Ports & Adapters) — Backend | This feature's entire purpose. See "Deferred, out-of-scope infra" below for the one deliberate, tracked exception | PASS (with tracked exception below) |

**Deferred, out-of-scope infra (not a violation introduced by this feature)**: `discogs/collection/collectionClient.ts`
and `discogs/oauth/discogsOauthService.ts` keep importing `axios`/`firebase-admin` directly and stay
in their current locations — migrating them is explicitly Historia 3/Historia 4's scope (parent user
story), not this one. This feature's new `DiscogsCollectionPort` and `DiscogsConnectionPort` adapters
wrap those modules' existing exported functions unchanged, so the **library** domain's own code has
zero direct infrastructure imports even though its two upstream Discogs modules are not yet fully
compliant. `cache/cacheAside.ts` and `cache/redisClient.ts` are treated the same way and are **not**
relocated by this feature (see Decision 4 in `research.md`) — moving them would ripple into every
other not-yet-migrated domain (`discogsClient.ts`, `collectionClient.ts`, `feedAggregator.ts`,
`discogsOauthService.ts`), breaking the "each domain migrates and deploys independently" requirement
from the parent user story's success criteria. Historia 6 (parent user story) explicitly owns
consolidating a single shared `CachePort` after Historias 2-5 have each defined and consumed one.

## Project Structure

### Documentation (this feature)

```text
specs/046-library-hexagonal-migration/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── library-repository-port.md
│   ├── discogs-collection-port.md
│   ├── discogs-connection-port.md
│   └── cache-port.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   └── library/
│   │       ├── types.ts              # moved verbatim from library/types.ts
│   │       ├── libraryErrors.ts      # DiscogsNotLinkedError, FieldNotEditableError (moved out of librarySyncService.ts)
│   │       └── libraryFilters.ts     # matchesLibraryFilters + FILTER_FIELDS (moved out of libraryService.ts)
│   ├── application/
│   │   └── library/
│   │       ├── createLibraryEntry.ts # POST / orchestration
│   │       ├── getLibraryEntry.ts    # GET /:id orchestration
│   │       ├── listLibraryEntries.ts # GET / orchestration (sync + list/filter + enrich)
│   │       ├── updateLibraryEntry.ts # PATCH /:id orchestration
│   │       ├── deleteLibraryEntry.ts # DELETE /:id orchestration
│   │       ├── syncLibrary.ts        # syncLibrary/reconcileMatchedEntry/pickManagedInstances/migrateLegacyFields/pushEntryToDiscogs/requireConnection
│   │       └── enrichLibraryEntry.ts # enrichEntry/enrichEntries (still calls discogsClient.getRelease directly — Historia 3 scope, unchanged)
│   ├── ports/
│   │   └── library/
│   │       ├── libraryRepositoryPort.ts   # LibraryRepositoryPort
│   │       ├── discogsCollectionPort.ts   # DiscogsCollectionPort (provisional — Historia 4 consolidates)
│   │       ├── discogsConnectionPort.ts   # DiscogsConnectionPort (provisional — Historia 4 consolidates)
│   │       └── cachePort.ts               # CachePort (library-scoped instance — Historia 6 consolidates)
│   ├── adapters/
│   │   └── library/
│   │       ├── firestoreLibraryRepository.ts  # implements LibraryRepositoryPort, wraps config/firebase-admin.ts (unmoved)
│   │       ├── discogsCollectionAdapter.ts    # implements DiscogsCollectionPort, wraps discogs/collection/collectionClient.ts (unmoved)
│   │       ├── discogsConnectionAdapter.ts    # implements DiscogsConnectionPort, wraps discogs/oauth/discogsOauthService.ts (unmoved)
│   │       ├── cacheAdapter.ts                # implements CachePort, wraps cache/redisClient.ts (unmoved) — see research.md Decision 4
│   │       └── libraryRoutes.ts               # driving adapter (was routes/library.ts): HTTP parsing/validation + error mapping only
│   ├── discogs/                       # unchanged in this feature (collectionClient.ts, discogsClient.ts, oauth/*)
│   ├── cache/                         # unchanged in this feature (cacheAside.ts, redisClient.ts)
│   ├── config/                        # unchanged in this feature (firebase-admin.ts, logger.ts)
│   └── app.ts                         # one-line import path update: routes/library → adapters/library/libraryRoutes
└── tests/
    ├── unit/
    │   └── library/
    │       ├── domain/
    │       │   └── libraryFilters.test.ts       # was tests/unit/libraryService.test.ts
    │       └── application/
    │           ├── syncLibrary.test.ts           # was tests/unit/librarySyncService.test.ts (mocks become injected fake ports)
    │           └── enrichLibraryEntry.test.ts     # was tests/unit/libraryEnrichment.test.ts
    ├── integration/
    │   └── library/
    │       ├── library.integration.test.ts        # was tests/integration/library.integration.test.ts
    │       └── librarySync.integration.test.ts     # was tests/integration/librarySync.integration.test.ts
    └── contract/
        └── library/
            └── library.contract.test.ts            # was tests/contract/library.contract.test.ts
```

**Structure Decision**: Web application backend, Hexagonal layers as global top-level folders under
`backend/src/` per Constitution Principle VIII (`domain/`, `application/`, `ports/`, `adapters/`,
each with a `library/` subfolder). Tests mirror the same domain grouping under
`backend/tests/{unit,integration,contract}/library/`, with `unit/` further split into `domain/` and
`application/` subfolders since those are the two layers this feature gives independent unit-test
coverage to (the `adapters/library/*` files are exercised by the existing integration/contract
suites against the real Firebase emulator, not by new isolated unit tests — see research.md Decision
5). Everything outside `library/` (routes for other domains, `discogs/*`, `cache/*`, `config/*`)
is untouched, so this feature can merge and deploy independently of Historias 3-6, per the parent
user story's explicit cross-domain independence requirement.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

*No violations requiring justification — the one deliberate deviation (deferred infra in
`collectionClient.ts`/`discogsOauthService.ts`) is documented above in the Constitution Check as an
explicitly tracked, out-of-scope carry-over owned by later stories in the same parent user story,
not a violation this feature introduces or must defend.*

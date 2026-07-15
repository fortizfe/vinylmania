# Implementation Plan: Discogs OAuth + Collection Domain Migrated to Hexagonal Architecture

**Branch**: `backend-hexagonal-architecture-refactor` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/048-discogs-oauth-collection-migration/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Move the Discogs OAuth linking flow (`backend/src/discogs/oauth/*`,
`backend/src/routes/discogsOauth.ts`) and the authenticated Collection API client
(`backend/src/discogs/collection/collectionClient.ts`) onto the Hexagonal convention
already demonstrated by the library (Historia 2) and catalog (Historia 3) domains,
as one combined `discogsOauth` business domain (per the parent user story's own
framing — "Historia 4: Dominio Discogs OAuth + Collection"). Two ports emerge: a
**`DiscogsConnectionPort`**, broadened per this spec's clarification session to cover
both Firestore-backed connection/pending-request persistence *and* the three-step OAuth
1.0a handshake (request-token, access-token exchange, identity lookup) that
`startLink`/`completeLink` perform via a raw `axios` client today; and a
**`DiscogsCollectionPort`**, the real implementation of the 7-method interface the
library domain already defined provisionally (Historia 2) — `getFieldMap`,
`listAllInstances`, `getInstancesForRelease`, `addReleaseToCollection`,
`deleteInstance`, `setRating`, `setFieldValue`. The linking-flow business rules
(pending-token ownership/expiration, already-connected checks) become four new
application-layer use cases (`startLink`, `completeLink`, `getConnectionStatus`,
`disconnectConnection`) depending only on the two ports and the shared `CachePort`;
`routes/discogsOauth.ts` is rewritten into a driving adapter limited to
parsing/validation, one use-case call, and the existing `handleFailure` error mapping
— including moving the "already connected" check that lives inline in the route today
into the use cases themselves, where `DiscogsOauthFlowError`'s existing
`already_connected` code already models it. The library domain's two provisional ports
(`ports/library/discogsCollectionPort.ts`, `ports/library/discogsConnectionPort.ts`)
and their pass-through adapters are retired, consolidated onto this domain's real ports
(spec.md FR-005). `CachePort` (Historia 2/3) is **extended, not duplicated**, with an
`invalidate(key)` method — Historia 3's own research.md flagged this exact gap
("`invalidateCache`... stays a direct `cache/cacheAside.ts` import for
`discogsOauthService.ts` until Historia 4"). The shared resilience modules
(`discogsRateLimiter.ts`, `discogsCircuitBreaker.ts`, `discogsRetry.ts`,
`discogsErrors.ts`) stay exactly where they are, unmoved, per the same
would-break-another-domain reasoning Historia 3 already applied to them (this domain is
their other consumer).

## Technical Context

**Language/Version**: TypeScript 5.6 on Node.js (CommonJS), Express 4.19 backend (`backend/package.json`)

**Primary Dependencies**: `axios` 1.7 (both the OAuth handshake client and the
collection client, only inside the new `adapters/discogsOauth/` after migration),
`firebase-admin` 12.3 (pending-request/connection persistence, only inside the new
`adapters/discogsOauth/discogsConnectionAdapter.ts` after migration), `express`
(routing)

**Storage**: Firestore collections `discogsOAuthRequests` (pending link attempts,
15-minute TTL) and `discogsConnections` (linked accounts) — both accessed exclusively
through `DiscogsConnectionPort` after migration. Redis (optional, read-through cache
for the collection field map only — the seven other collection operations are
uncached today and stay uncached) — already fail-soft when unavailable; this migration
preserves that behavior exactly

**Testing**: Jest 29 + ts-jest, `firebase emulators:exec --only auth,firestore` for the
Firestore-backed tests (`backend/package.json` `test` script), `nock` for stubbing
outbound Discogs OAuth-handshake and Collection API HTTP calls (`tests/helpers/nock.ts`
already provides `discogsScope`/`stubCollectionFields`/`stubCollectionPage`), no
`jest.mock()` module-path mocking found in any of this domain's four existing test
files (verified) — same "real Firestore emulator + `nock`" integration style Historias
2-3 already established, so no path-sensitive-mock risk (spec.md Edge Cases)

**Target Platform**: Node.js server, deployed as a long-lived warm process (unaffected
by this migration)

**Project Type**: Web application backend (Express REST API); this feature touches
`backend/` only, per Constitution Principle VIII's explicit backend-only scope

**Performance Goals**: No new targets — SC-005 requires byte-for-byte identical HTTP
behavior for the OAuth endpoints. The collection field-map cache (currently a direct
`cache/cacheAside.ts` `withCache` call, 24-hour TTL) must remain exactly one cache
operation per call, now routed through `CachePort.withCache` instead

**Constraints**: Zero HTTP contract changes for the OAuth endpoints (`/api/discogs/oauth/*`);
zero change to the pending-link ownership/expiration rules or their 15-minute TTL; zero
change to the shared resilience behavior (rate-limit smoothing, circuit breaker, retry)
that the collection client already reuses from the catalog domain; the "already
connected" check currently duplicated inline in both `POST /request` and
`POST /complete` route handlers must produce the same 409 response, now via
`DiscogsOauthFlowError`'s existing `already_connected` code instead of a route-level
`if` check (see research.md Decision 2)

**Scale/Scope**: ~12 source files (~1,100 lines total: `discogsOauthService.ts` 227,
`oauthHttpClient.ts` 89, `oauthSignature.ts` 69, oauth `types.ts` 38,
`routes/discogsOauth.ts` 144, `collectionClient.ts` 358, `collectionTypes.ts` 34,
`conditionGrading.ts` 56, plus the library domain's four provisional-port/adapter files
totaling 81 lines) relocated/split into ~14 new files across `domain/discogsOauth/`,
`application/discogsOauth/`, `ports/discogsOauth/`, `adapters/discogsOauth/`, plus the
`CachePort` extension (`ports/cache/cachePort.ts`, `adapters/cache/cacheAdapter.ts`,
already-shared locations, no relocation needed this time); 5 existing test files
(~1,280 lines: `discogsOauthService.test.ts`, `discogsOauthSignature.test.ts`,
`discogsOauthRoutes.test.ts`, `collectionClient.contract.test.ts`,
`conditionGrading.test.ts`) relocated/adapted, 2 new unit test files added (one per new
use-case-level port-double test per spec.md User Stories 1-2); 6 existing cross-domain
call sites in the already-migrated library domain (`createLibraryEntry.ts`,
`deleteLibraryEntry.ts`, `getLibraryEntry.ts`, `updateLibraryEntry.ts`,
`syncLibrary.ts`, `discogsCopyData.ts`) plus the composition root
(`libraryRoutes.ts`) get an import-path fix, per spec.md FR-011

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Test-First | Each relocated/new file's test is adjusted (and run red against the new module boundary) before the corresponding file is written, following the same copy-then-cutover strategy validated in the library and catalog migrations | PASS (enforced by task ordering, see `tasks.md` once generated) |
| II. Discogs Integration-First & Modularity | `discogsRateLimiter.ts`, `discogsCircuitBreaker.ts`, `discogsRetry.ts`, `discogsErrors.ts` are not touched or duplicated — the new `discogsCollectionAdapter.ts` imports them from their current, shared location exactly as `collectionClient.ts` does today | PASS |
| III. Simplicity, YAGNI & KISS | The connection port's broadened shape (persistence + handshake) was the explicit, deliberate outcome of this spec's clarification session, not an arbitrary expansion — one port per this domain's one external-system boundary (Discogs, whether via Firestore-backed state or HTTP handshake) rather than three narrow ports for what is operationally one linking flow; manual factory-function DI, no framework | PASS |
| IV. SOLID Design | Application code depends on `ports/discogsOauth/*` and the shared `ports/cache/cachePort.ts` interfaces, never on concrete `firebase-admin`/`axios` modules | PASS |
| V. Observability | Every existing `logger.info/warn/error` call in `discogsOauthService.ts`/`oauthHttpClient.ts`/`collectionClient.ts`/`routes/discogsOauth.ts` is preserved verbatim in its new location | PASS (verified per-file during relocation) |
| VI. Versioning & Breaking Changes | Purely structural; no API contract, schema, or stored-data change | PASS |
| VII. Curated Ratings & Music News | Not directly implicated — this domain has no rating/news surface of its own; the collection port's `setRating` is user-state (Principle VII's own carve-out: "collector-facing rating... treated as user-specific state under Principle II's Firebase constraints, not as Discogs catalog data"), unaffected by this structural migration | PASS |
| VIII. Hexagonal Architecture (Ports & Adapters) — Backend | This feature's entire purpose. The library domain's two provisional ports are retired (not left as a second, parallel definition), closing the last cross-domain gap named in Historia 2/3's own research | PASS |

**Deferred, out-of-scope infra (not a violation introduced by this feature)**: The
feeds domain (`feeds/feedClient.ts`, `axios` + `rss-parser`) and the auth/users domain
(`services/userService.ts`, `middleware/requireAuth.ts`, `firebase-admin`) are
untouched — Historias 5 and 6. `cache/cacheAside.ts` and `cache/redisClient.ts`
themselves stay in place (only their consumer-facing port gains one new method) —
relocating those two files is still not triggered by any single domain needing it
exclusively, same reasoning Historia 3 applied.

## Project Structure

### Documentation (this feature)

```text
specs/048-discogs-oauth-collection-migration/
├── plan.md               # This file (/speckit-plan command output)
├── research.md           # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── discogs-connection-port.md
│   ├── discogs-collection-port.md
│   └── cache-port.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   └── discogsOauth/
│   │       ├── types.ts                     # moved verbatim from discogs/oauth/types.ts (DiscogsConnection, PendingOAuthRequest, ConnectionStatus)
│   │       ├── collectionTypes.ts            # moved verbatim from discogs/collection/collectionTypes.ts (CollectionInstance, InstanceRef, CollectionFieldMap)
│   │       ├── conditionGrading.ts           # moved verbatim from discogs/collection/conditionGrading.ts — pure grading vocabulary, consumed by application/library/syncLibrary.ts
│   │       └── discogsOauthErrors.ts         # NEW — DiscogsOauthFlowError extracted from discogsOauthService.ts (mirrors domain/library/libraryErrors.ts's precedent)
│   ├── application/
│   │   └── discogsOauth/
│   │       ├── startLink.ts                  # US1 — already-connected check + pending-request creation + handshake step 1, via the port
│   │       ├── completeLink.ts                # US1 — pending-token lookup/ownership/expiration + handshake steps 2-3 + connection write, via the port
│   │       ├── getConnectionStatus.ts         # US1 — getStatus's connected/not-connected shaping rule
│   │       └── disconnectConnection.ts        # US1 — disconnect + CachePort.invalidate(fieldsCacheKey), replacing the direct cacheAside import
│   ├── ports/
│   │   └── discogsOauth/
│   │       ├── discogsConnectionPort.ts       # DiscogsConnectionPort (US1) — broadened per Clarifications session
│   │       └── discogsCollectionPort.ts       # DiscogsCollectionPort (US2) — same 7-method shape the library domain already defined provisionally
│   ├── adapters/
│   │   ├── discogsOauth/
│   │   │   ├── oauthHttpClient.ts             # moved verbatim from discogs/oauth/oauthHttpClient.ts — axios client factory backing the handshake
│   │   │   ├── oauthSignature.ts              # moved verbatim from discogs/oauth/oauthSignature.ts — OAuth 1.0a header building, consumed by both adapters below
│   │   │   ├── discogsConnectionAdapter.ts    # implements DiscogsConnectionPort; Firestore CRUD + the 3-step handshake, relocated from discogsOauthService.ts's low-level code + oauthHttpClient.ts
│   │   │   ├── discogsCollectionAdapter.ts    # implements DiscogsCollectionPort; axios client + resilience wiring, relocated from collectionClient.ts
│   │   │   └── discogsRoutes.ts               # driving adapter (was routes/discogsOauth.ts) — parsing/validation + one use-case call + handleFailure
│   │   ├── cache/
│   │   │   └── cacheAdapter.ts                # extended in place: new invalidate(key) method delegating to the unmoved cache/cacheAside.ts's invalidateCache
│   │   └── library/                           # discogsCollectionAdapter.ts + discogsConnectionAdapter.ts DELETED; libraryRoutes.ts wiring repointed at the new adapters above
│   ├── discogs/                                # discogsRateLimiter.ts, discogsCircuitBreaker.ts, discogsRetry.ts, discogsErrors.ts stay — shared with the already-migrated catalog domain
│   ├── cache/                                   # unchanged: cacheAside.ts, redisClient.ts (still not relocated — Historia 6's job)
│   ├── application/library/                     # createLibraryEntry.ts, deleteLibraryEntry.ts, getLibraryEntry.ts, updateLibraryEntry.ts, syncLibrary.ts, discogsCopyData.ts: import-path fix only (new ports/discogsOauth/* location)
│   └── app.ts                                   # one-line import path update: routes/discogsOauth → adapters/discogsOauth/discogsRoutes
└── tests/
    ├── unit/
    │   └── discogsOauth/
    │       ├── domain/
    │       │   └── conditionGrading.test.ts               # relocated, unchanged assertions
    │       ├── adapters/
    │       │   └── discogsOauthSignature.test.ts           # relocated, unchanged assertions
    │       └── application/
    │           ├── startLink.test.ts                       # NEW — fake DiscogsConnectionPort, US1
    │           └── completeLink.test.ts                    # NEW — fake DiscogsConnectionPort + injectable clock, US1 expiration/ownership rules
    ├── integration/
    │   └── discogsOauth/
    │       └── discogsOauthService.test.ts                 # relocated, unchanged assertions (Firestore emulator + nock, exercises the use cases end-to-end)
    └── contract/
        └── discogsOauth/
            ├── discogsOauthRoutes.test.ts                  # relocated, unchanged assertions
            └── collectionClient.contract.test.ts            # relocated, unchanged assertions
```

**Structure Decision**: Web application backend, Hexagonal layers as global top-level
folders under `backend/src/` per Constitution Principle VIII, mirroring the library and
catalog domains' precedent exactly. Both the connection and collection concerns live
under one `discogsOauth` domain folder (not split into two domains) because the parent
user story frames this as a single "Dominio Discogs OAuth + Collection," and because
`DiscogsCollectionPort`'s every method already takes a `DiscogsConnection` as its first
argument — the two are not independently useful. `ports/discogsOauth/` and
`adapters/discogsOauth/` are new, domain-scoped folders (not shared, unlike
`ports/cache/`) since — unlike `CachePort` at the Historia 2→3 boundary — no other
domain needs either of these two new ports; the library domain **consumes** them but
does not own or extend their shape. Tests mirror the same domain grouping under
`backend/tests/{unit,integration,contract}/discogsOauth/`, split by layer inside
`tests/unit/` (`domain/`, `adapters/`, `application/`) to distinguish the two relocated
files (whose subject moved to `domain/`/`adapters/`) from the two brand-new
port-double tests (whose subject is the new `application/` use cases) — the same
`unit/<domain>/<layer>/` nesting Historia 3 introduced for
`discogsCatalog/application/searchCatalogWithRatings.test.ts`.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

*No violations requiring justification — the deliberate deviations (resilience modules
staying in `discogs/`, `cache/cacheAside.ts`/`redisClient.ts` staying in `cache/`) are
documented above in the Constitution Check as explicitly tracked, shared-infrastructure
carry-overs, not violations this feature introduces or must defend.*

---

description: "Task list template for feature implementation"
---

# Tasks: Library Domain Migrated to Hexagonal Architecture

**Input**: Design documents from `/specs/046-library-hexagonal-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included and REQUIRED — Constitution Principle I (Test-First, NON-NEGOTIABLE) applies to
this project. See "Migration Strategy" below for how Test-First applies to a pure structural
refactor of already-covered production code.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story. All paths are relative to the repository root; `backend/` is implied for
every `src/`/`tests/` path below.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description

## Migration Strategy (read before starting)

This feature relocates already-tested, already-live production code. Stories 1 and 2 build their
new `domain/`, `application/`, `ports/`, `adapters/` files **additively, alongside the untouched
originals** — `backend/src/library/*.ts` and `backend/src/routes/library.ts` keep serving all
traffic, completely unmodified, until Story 3's cutover. This keeps Stories 1 and 2 zero-risk (the
running app never changes behavior while they're in progress) and independently mergeable/testable,
per spec.md's explicit cross-story independence requirement.

A brief, intentional duplication window results: `domain/library/types.ts` (new) and
`library/types.ts` (old, still used by not-yet-migrated code) coexist with identical content from
Phase 2 until Story 3 deletes the old file, at which point there is exactly one copy again. This is
not a permanent shim — it is the standard build-then-cutover shape of the parent user story's
explicitly phased migration (see research.md Decisions 3-4 for why other shared infra is *not*
touched at all by this feature).

For pure relocations with no existing dedicated test (types, error classes), Test-First is satisfied
transitively: they have no observable behavior until something in Stories 1-3 depends on them, and
every one of those dependents has its own test task that would fail if the relocation were wrong.
For relocations with an existing dedicated test, the filter-predicate, sync, and enrichment
unit/integration tests (T004, T006, T007, T013) are **copied** to their new location and repointed
— not moved — so the original keeps covering the still-live old file until Phase 5's cutover
deletes both the old source file and its now-redundant original test copy in one step (T027/T028).
The new copy goes red (module not found) before the corresponding implementation task turns it
green — genuine Red-Green-Refactor for a refactor. The HTTP-level contract/integration tests
(T018, T019) *are* true relocations, since by Phase 5 the cutover happens in the same phase — there
is no window where old and new routes coexist needing separate coverage.

## Phase 1: Setup

**Purpose**: Establish a pre-migration baseline to measure "no regression" against.

- [X] T001 Run `cd backend && npm test -- --testPathPattern="library"` and confirm all 6 existing
  library test files (`tests/unit/libraryService.test.ts`, `tests/unit/librarySyncService.test.ts`,
  `tests/unit/libraryEnrichment.test.ts`, `tests/contract/library.contract.test.ts`,
  `tests/integration/library.integration.test.ts`, `tests/integration/librarySync.integration.test.ts`)
  pass today. This is the baseline spec.md FR-004/SC-001 must not regress.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure, infrastructure-free domain building blocks every user story imports.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Create `backend/src/domain/library/types.ts` — copy `LibraryEntry`, `LibraryFilters`,
  `EntryDiscogsData`, `EnrichedLibraryEntry`, `CreateLibraryEntryInput`, `PaginatedLibraryEntries`,
  `CatalogStatus` unchanged from `backend/src/library/types.ts`. Leave the original file in place
  (still imported by not-yet-migrated code) until Phase 5 deletes it.
- [X] T003 [P] Create `backend/src/domain/library/libraryErrors.ts` — copy `DiscogsNotLinkedError`
  and `FieldNotEditableError` unchanged from `backend/src/library/librarySyncService.ts`. Leave the
  originals in place (still thrown/caught by production routes) until Phase 5 deletes them.
- [X] T004 [P] Create `backend/src/domain/library/libraryFilters.ts` — copy `matchesLibraryFilters`
  and `FILTER_FIELDS` unchanged from `backend/src/library/libraryService.ts` (the original stays in
  place, still used by `listEntriesFiltered`, until Phase 5 deletes it). Then copy
  `backend/tests/unit/libraryService.test.ts` to `backend/tests/unit/library/domain/libraryFilters.test.ts`,
  updating the new copy's import to the new path, and run it to confirm it passes. Leave the
  original test file in place — it still covers the old `libraryService.ts` copy — until Phase 5
  deletes it.

**Checkpoint**: `domain/library/` exists with the three building blocks every subsequent phase
depends on. `backend/src/library/*.ts` still exists, unmodified, still serving production traffic.

---

## Phase 3: User Story 1 - Library persistence isolated behind a port (Priority: P1)

**Goal**: Every read/write of a library entry goes through `LibraryRepositoryPort`; enrichment
depends on the same port instead of `libraryService` module internals.

**Independent Test**: Swap `LibraryRepositoryPort` for an in-memory fake in a unit test and confirm
enrichment logic behaves correctly with no real Firestore connection (spec.md US1).

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T005 [US1] Define `backend/src/ports/library/libraryRepositoryPort.ts` per
  `contracts/library-repository-port.md` (interface only — `createEntry`, `getEntry`,
  `listEntries`, `listAllEntries`, `persistCatalogFields`, `updateEntryInstance`,
  `clearLegacyFields`, `deleteEntry`).
- [X] T006 [P] [US1] Copy `backend/tests/integration/library.integration.test.ts` to
  `backend/tests/integration/library/adapters/firestoreLibraryRepository.integration.test.ts`,
  updating the new copy's `createEntry` import from `../../src/library/libraryService` to
  `../../../src/adapters/library/firestoreLibraryRepository`. Run the new copy and confirm it fails
  (module not found — the adapter doesn't exist yet). Leave the original file in place, still
  covering `library/libraryService.ts`, until Phase 5 deletes it.
- [X] T007 [P] [US1] Copy `backend/tests/unit/libraryEnrichment.test.ts` to
  `backend/tests/unit/library/application/enrichLibraryEntry.test.ts`, rewriting the new copy's
  `jest.spyOn(libraryService, 'persistCatalogFields')` into a hand-built fake
  `LibraryRepositoryPort` (only `persistCatalogFields` needs a real implementation for this test's
  assertions) injected into `createEnrichLibraryEntryUseCase(...)`. Run the new copy and confirm it
  fails (module not found — the use case doesn't exist yet). Leave the original file in place, still
  covering `library/libraryEnrichment.ts`, until Phase 5 deletes it.

### Implementation for User Story 1

- [X] T008 [US1] Implement `backend/src/adapters/library/firestoreLibraryRepository.ts` —
  implements `LibraryRepositoryPort`; relocate the Firestore CRUD code from
  `backend/src/library/libraryService.ts` (everything except `matchesLibraryFilters`,
  `FILTER_FIELDS`, and `listEntriesFiltered`), importing `getFirestoreDb` from the unchanged
  `../../config/firebase-admin` and types from `../../domain/library/types`. Run T006 and confirm
  it now passes.
- [X] T009 [US1] Implement `backend/src/application/library/enrichLibraryEntry.ts` — factory
  `createEnrichLibraryEntryUseCase(deps: { repository: LibraryRepositoryPort })` returning
  `enrichEntry`/`enrichEntries`, relocated unchanged from
  `backend/src/library/libraryEnrichment.ts` (still calls `getRelease` from
  `../../discogs/discogsClient` directly — out of this feature's scope, per plan.md). Run T007 and
  confirm it now passes.

**Checkpoint**: `LibraryRepositoryPort` and its Firestore adapter exist and are proven against the
real Firestore emulator; enrichment is proven against a fake port with no infrastructure. Nothing
new is wired into production routes yet — `library/libraryService.ts` and
`library/libraryEnrichment.ts` are now dead code paths in waiting, but still present and untouched.

---

## Phase 4: User Story 2 - Library sync/reconciliation logic isolated from external SDKs (Priority: P1)

**Goal**: `syncLibrary`'s reconciliation rules (union-merge on first sync, mirror mode after) depend
only on `DiscogsCollectionPort`, `DiscogsConnectionPort`, and `CachePort` — never on
`collectionClient`, `discogsOauthService`, or `redisClient` directly.

**Independent Test**: Run the reconciliation logic against fake ports and confirm union-merge and
mirror-mode behaviors match today's suite, with no real Discogs API call and no real Redis instance
(spec.md US2).

### Tests for User Story 2 ⚠️ (write first, confirm it fails)

- [X] T010 [US2] Define `backend/src/ports/library/discogsCollectionPort.ts` per
  `contracts/discogs-collection-port.md` (`getFieldMap`, `listAllInstances`,
  `getInstancesForRelease`, `addReleaseToCollection`, `deleteInstance`, `setRating`,
  `setFieldValue`).
- [X] T011 [P] [US2] Define `backend/src/ports/library/discogsConnectionPort.ts` per
  `contracts/discogs-connection-port.md` (`getConnection`, `markInitialLibrarySync`).
- [X] T012 [P] [US2] Define `backend/src/ports/library/cachePort.ts` per `contracts/cache-port.md`
  (`has(key)`, `set(key, value, ttlSeconds)` — both documented as never-rejecting).
- [X] T013 [US2] Copy `backend/tests/unit/librarySyncService.test.ts` to
  `backend/tests/unit/library/application/syncLibrary.test.ts`. In the new copy, replace its four
  `jest.mock('../../src/discogs/collection/collectionClient')` /
  `jest.mock('../../src/discogs/oauth/discogsOauthService')` /
  `jest.mock('../../src/library/libraryService')` /
  `jest.mock('../../src/cache/redisClient', ...)` calls with hand-built in-memory fakes for
  `LibraryRepositoryPort`, `DiscogsCollectionPort`, `DiscogsConnectionPort`, and `CachePort`,
  injected into `createSyncLibraryUseCase(...)`. Run the new copy and confirm it fails (module not
  found — the use case doesn't exist yet). Leave the original file in place, still covering
  `library/librarySyncService.ts`, until Phase 5 deletes it.

### Implementation for User Story 2

- [X] T014 [P] [US2] Implement `backend/src/adapters/library/discogsCollectionAdapter.ts` —
  implements `DiscogsCollectionPort` by delegating each method, unchanged, to the corresponding
  export of `../../discogs/collection/collectionClient` (not relocated — see research.md Decision
  3).
- [X] T015 [P] [US2] Implement `backend/src/adapters/library/discogsConnectionAdapter.ts` —
  implements `DiscogsConnectionPort` by delegating `getConnection`/`markInitialLibrarySync`,
  unchanged, to `../../discogs/oauth/discogsOauthService` (not relocated).
- [X] T016 [P] [US2] Implement `backend/src/adapters/library/cacheAdapter.ts` — implements
  `CachePort` by calling `getRedisClient()` from `../../cache/redisClient` (not relocated) directly,
  preserving the exact try/catch fail-soft behavior of today's `isMarkerFresh`/`setMarker`
  (research.md Decision 4).
- [X] T017 [US2] Implement `backend/src/application/library/syncLibrary.ts` — factory
  `createSyncLibraryUseCase(deps: { repository: LibraryRepositoryPort; discogsCollection:
  DiscogsCollectionPort; discogsConnection: DiscogsConnectionPort; cache: CachePort })` returning
  `syncLibrary`, relocated unchanged from `backend/src/library/librarySyncService.ts`
  (`reconcileMatchedEntry`, `pickManagedInstances`, `migrateLegacyFields`, `pushEntryToDiscogs`,
  `requireConnection`, `isMarkerFresh`/`setMarker` become private helpers of this module, calling
  the injected ports and `domain/library/libraryErrors.ts` instead of the concrete modules and
  inline error classes). Run T013 and confirm it now passes.

**Checkpoint**: The sync/reconciliation business rules are proven against fake ports with zero real
infrastructure. `library/librarySyncService.ts` is still present and still serving production
traffic, untouched.

---

## Phase 5: User Story 3 - HTTP layer delegates orchestration to application logic (Priority: P2)

**Goal**: `routes/library.ts` becomes a thin driving adapter (parse/validate → one use-case call →
error mapping); this is the cutover that retires the old `library/*.ts` files.

**Independent Test**: Every route handler body is limited to parsing/validation, one use-case call,
and error-to-HTTP mapping; the existing contract/integration suites pass unchanged against the
migrated routes (spec.md US3).

### Tests for User Story 3 ⚠️ (relocate first; they must keep passing throughout this phase)

- [X] T018 [P] [US3] Relocate `backend/tests/contract/library.contract.test.ts` →
  `backend/tests/contract/library/library.contract.test.ts`, updating its `createEntry`/`getEntry`
  seeding imports from `../../src/library/libraryService` to
  `../../../src/adapters/library/firestoreLibraryRepository`. Run it and confirm it still passes
  (routes aren't migrated yet — this only proves the relocation/import fix is correct).
- [X] T019 [P] [US3] Relocate `backend/tests/integration/librarySync.integration.test.ts` →
  `backend/tests/integration/library/librarySync.integration.test.ts`, updating its `createEntry`
  seeding import the same way. Run it and confirm it still passes.

### Implementation for User Story 3

- [X] T020 [P] [US3] Implement `backend/src/application/library/createLibraryEntry.ts` — factory
  `createCreateLibraryEntryUseCase(deps: { repository, discogsCollection, discogsConnection })`;
  relocate the POST `/` orchestration from `routes/library.ts` (catalog lookup via
  `discogsClient.getRelease`, `requireConnection`, `discogsCollection.addReleaseToCollection`,
  `repository.createEntry`, `discogsCollection.getFieldMap` for the response shape).
- [X] T021 [P] [US3] Implement `backend/src/application/library/getLibraryEntry.ts` — factory
  `createGetLibraryEntryUseCase(deps: { repository, discogsCollection, discogsConnection,
  enrichLibraryEntry })`; relocate the GET `/:id` orchestration (`repository.getEntry`,
  `requireConnection`, `enrichLibraryEntry`, `getCopyData`-equivalent via `discogsCollection`).
- [X] T022 [P] [US3] Implement `backend/src/application/library/listLibraryEntries.ts` — factory
  `createListLibraryEntriesUseCase(deps: { repository, enrichLibraryEntry })`; relocate the
  filtered/paginated listing (`repository.listAllEntries` + `domain/library/libraryFilters.ts`'s
  `matchesLibraryFilters` + in-memory pagination, or `repository.listEntries` when no filters are
  active — same branching as today's route).
- [X] T023 [P] [US3] Implement `backend/src/application/library/updateLibraryEntry.ts` — factory
  `createUpdateLibraryEntryUseCase(deps: { repository, discogsCollection, discogsConnection,
  enrichLibraryEntry })`; relocate the PATCH `/:id` orchestration (`updateCopyData`'s rating/field
  edits via `discogsCollection`, throwing `FieldNotEditableError` from
  `domain/library/libraryErrors.ts`).
- [X] T024 [P] [US3] Implement `backend/src/application/library/deleteLibraryEntry.ts` — factory
  `createDeleteLibraryEntryUseCase(deps: { repository, discogsCollection, discogsConnection })`;
  relocate the DELETE `/:id` orchestration (`removeFromLibrary`'s Discogs-instance-then-mirror
  write-through).
- [X] T025 [US3] Implement `backend/src/adapters/library/libraryRoutes.ts` — the driving adapter,
  relocated from `backend/src/routes/library.ts`: instantiate `firestoreLibraryRepository`,
  `discogsCollectionAdapter`, `discogsConnectionAdapter`, `cacheAdapter`, and every
  `application/library/*` use case factory once at module load; keep the existing Zod schemas
  (`createBodySchema`, `patchBodySchema`), `parsePageParams`, `parseLibraryFilters`,
  `serializeEntry`, `respondCollectionError`, `respondInternalError` unchanged; each route handler
  body is limited to parse/validate → exactly one use-case call → response/error mapping. Depends
  on T008, T009, T017, T020-T024.
- [X] T026 [US3] Update `backend/src/app.ts`: change
  `import { libraryRouter } from './routes/library'` to
  `import { libraryRouter } from './adapters/library/libraryRoutes'`.
- [X] T027 [US3] Delete the now-superseded old files: `backend/src/library/libraryService.ts`,
  `backend/src/library/librarySyncService.ts`, `backend/src/library/libraryEnrichment.ts`,
  `backend/src/library/types.ts`, `backend/src/routes/library.ts`; remove the now-empty
  `backend/src/library/` directory.
- [X] T028 [US3] Delete the now-superseded old test files: `backend/tests/unit/libraryService.test.ts`,
  `backend/tests/unit/librarySyncService.test.ts`, `backend/tests/unit/libraryEnrichment.test.ts`,
  `backend/tests/integration/library.integration.test.ts` — each one's coverage now lives at its
  Phase 2/3/4-relocated path.
- [X] T029 [US3] Run
  `cd backend && npm test -- --testPathPattern="tests/(unit|integration|contract)/library"` and
  confirm every relocated test (T004, T006, T007, T013, T018, T019) passes against the now
  fully-wired new code — this is the FR-004/SC-001 regression gate for the whole feature.

**Checkpoint**: All user stories functional; `library/` (old) no longer exists; `routes/library.ts`
no longer exists; `adapters/library/libraryRoutes.ts` serves `/api/library` unchanged.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T030 [P] Run
  `grep -rnE "from '(firebase-admin|axios|ioredis)'" backend/src/domain/library backend/src/application/library backend/src/ports/library`
  and confirm zero matches (spec.md SC-002; quickstart.md step 1).
- [X] T031 Run `cd backend && npm test` (full suite, no path filter) once and confirm all ~43
  backend test files pass, including every domain this feature didn't touch — proving no
  cross-domain blast radius (spec.md SC-001; quickstart.md step 3).
- [X] T032 [P] Manually review `backend/src/adapters/library/libraryRoutes.ts`: confirm every
  handler body is limited to parsing/validation, one use-case call, and error mapping, with no
  inline business orchestration (spec.md US3 acceptance scenario 1; quickstart.md step 5).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 only. Independent of US2/US3.
- **User Story 2 (Phase 4)**: Depends on Phase 2 only. Independent of US1/US3 (it does not call
  `LibraryRepositoryPort` — reconciliation's Firestore writes happen through
  `application/library/syncLibrary.ts`'s own `repository` dependency, which is the *same port
  type* Phase 3 defines the adapter for, but Phase 4's tests use a fake, so Phase 4 does not need
  Phase 3's adapter to exist).
- **User Story 3 (Phase 5)**: Depends on Phase 3 AND Phase 4 (needs real `firestoreLibraryRepository`,
  `enrichLibraryEntry`, and `syncLibrary` to wire into routes) — matches spec.md's explicit
  statement that US3 depends on US1 and US2.
- **Polish (Phase 6)**: Depends on Phase 5.

### Parallel Opportunities

- T002, T003, T004 (Phase 2) — different files.
- T006, T007 (Phase 3 tests) — different files, both only need T005.
- T011, T012 (Phase 4 ports) — different files, independent of T010.
- T014, T015, T016 (Phase 4 adapters) — different files, independent of each other.
- T018, T019 (Phase 5 test relocations) — different files.
- T020, T021, T022, T023, T024 (Phase 5 use cases) — different files, each only needs Phase 3/4's
  ports+adapters, not each other.
- **Phase 3 and Phase 4 can run fully in parallel** (e.g., two developers) once Phase 2 is done —
  neither reads nor writes a file the other touches.

---

## Parallel Example: Phase 2 (Foundational)

```bash
Task: "Create backend/src/domain/library/types.ts"
Task: "Create backend/src/domain/library/libraryErrors.ts"
Task: "Create backend/src/domain/library/libraryFilters.ts + relocate its test"
```

## Parallel Example: Phase 4 adapters (User Story 2)

```bash
Task: "Implement backend/src/adapters/library/discogsCollectionAdapter.ts"
Task: "Implement backend/src/adapters/library/discogsConnectionAdapter.ts"
Task: "Implement backend/src/adapters/library/cacheAdapter.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2.
2. Complete Phase 3 (User Story 1).
3. **STOP and VALIDATE**: T006/T007 pass; `firestoreLibraryRepository`/`enrichLibraryEntry` are
   proven; production traffic is still served by the untouched old code, so this is safe to pause
   on or merge as an incremental, behavior-invisible step.

### Incremental Delivery

1. Setup + Foundational → shared building blocks ready.
2. User Story 1 → persistence port proven, zero production risk (additive only).
3. User Story 2 → sync/reconciliation port proven, zero production risk (additive only) — can be
   done in parallel with Story 1 by a second developer.
4. User Story 3 → the cutover: application use cases assembled, routes rewritten, `app.ts`
   repointed, old files deleted. This is the only phase that changes what actually serves
   `/api/library` traffic.
5. Polish → static-import check, full-suite regression run, manual route-handler review.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Every implementation task in Phases 3-4 has a preceding test task that fails until it lands
  (Constitution Principle I).
- Commit after each checkpoint (end of Phase 2, 3, 4, 5, 6) rather than after every single task —
  Phases 3 and 4 in particular are each one coherent, independently-mergeable unit.
- Do not delete anything under `backend/src/library/`, `backend/src/routes/library.ts`, or the four
  Phase 2-4 original test files (`tests/unit/libraryService.test.ts`,
  `tests/unit/librarySyncService.test.ts`, `tests/unit/libraryEnrichment.test.ts`,
  `tests/integration/library.integration.test.ts`) before T027/T028 — every earlier phase depends on
  the old code and its original tests continuing to serve/cover production traffic unmodified.

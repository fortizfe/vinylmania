# Tasks: Sync Vinyl Library with Discogs Collection

**Input**: Design documents from `/specs/016-library-discogs-sync/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/library-sync-api.md, quickstart.md

**Tests**: INCLUDED — constitution Principle I (Test-First) is non-negotiable: each test task MUST be written and observed failing before its paired implementation task.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4, mapping to spec.md priorities)
- Include exact file paths in descriptions

## Path Conventions

Web app layout per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test scaffolding both suites need before any red test can be written

- [X] T001 [P] Extend the e2e Discogs stub (used by `e2e/tests/discogs-account-link.spec.ts`, lives under `e2e/helpers/`) with authenticated collection endpoints: `GET /users/:u/collection/folders/0/releases` (paginated), `POST /users/:u/collection/folders/1/releases/:rid`, `DELETE`/`POST .../instances/:iid` (delete + rating), `GET /users/:u/collection/fields`, `POST .../fields/:fid`, with in-memory per-test collection state
- [X] T002 [P] Add nock helper builders for the same six Discogs collection endpoints (success, 401, 429, 5xx variants) in `backend/tests/helpers/nock.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared Discogs collection client, grading domain, error taxonomy, cache invalidation, and entry types every story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests (write first, observe failing)

- [X] T003 [P] Unit tests for `buildProtectedResourceHeader` (PLAINTEXT signature with access token/secret, nonce/timestamp presence) in `backend/tests/unit/discogsOauthSignature.test.ts`
- [X] T004 [P] Unit tests for grading sets and `LEGACY_CONDITION_MAP` (all six legacy values map; unmapped input reported as unmappable; sleeve-only values accepted for sleeve) in `backend/tests/unit/conditionGrading.test.ts`
- [X] T005 [P] Unit tests for `invalidateCache` (deletes key; fail-soft when Redis unavailable/unconfigured) in `backend/tests/unit/cache/cacheAside.test.ts` (extend existing cache tests under `backend/tests/unit/cache/`)
- [X] T006 [P] Contract tests for the collection client against nock stubs — pagination walk of folder 0, add returns `instance_id`, delete 204, rating POST, fields list → field map by name (including missing-field → null), field edit, and error mapping 401/403→`DiscogsAuthError`, 429→`DiscogsRateLimitError`, 5xx/network→`DiscogsUnavailableError` — in `backend/tests/contract/collectionClient.contract.test.ts`

### Implementation

- [X] T007 Generalize `backend/src/discogs/oauth/oauthSignature.ts`: add `buildProtectedResourceHeader(credentials, access)` and make `buildIdentityHeader` delegate to it (T003 green)
- [X] T008 [P] Add `DiscogsAuthError` (code `auth_failed`) to `backend/src/discogs/discogsErrors.ts`
- [X] T009 [P] Add `invalidateCache(key)` (Redis DEL, fail-soft, structured log on failure) to `backend/src/cache/cacheAside.ts` (T005 green)
- [X] T010 [P] Create `backend/src/discogs/collection/collectionTypes.ts` (CollectionInstance, CollectionFieldMap per data-model.md §2/§4) and `backend/src/discogs/collection/conditionGrading.ts` (MEDIA_CONDITIONS, SLEEVE_CONDITIONS, LEGACY_CONDITION_MAP, mapLegacyCondition) (T004 green)
- [X] T011 Implement `backend/src/discogs/collection/collectionClient.ts`: OAuth-signed axios client (base URL from `DISCOGS_OAUTH_BASE_URL`, research R4), six operations from research R4's endpoint table, field-map resolution by default field names cached in Redis `discogs:fields:{uid}` TTL 24h, error interceptor mapping to the DiscogsError taxonomy (T006 green)
- [X] T012 Update `backend/src/library/types.ts`: `LibraryEntry` gains `discogsInstanceId`/`discogsFolderId` and drops public `condition`/`notes`; add `EntryDiscogsData` (data-model.md §6); keep internal legacy fields typed as optional for migration code only

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — My library reflects my Discogs collection (Priority: P1) 🎯 MVP

**Goal**: Library list = linked Discogs collection: sync-on-read with 5-min throttle + manual refresh, first-sync union merge with legacy notes/condition migration, Discogs as source of truth afterwards, and a "link your accounts" gate for unlinked users.

**Independent Test**: With a linked account holding records on both sides, load `/app/library` and verify one merged set (and migrated notes/condition visible on discogs.com); with an unlinked account verify the gate card and that `GET /api/library` returns `409 discogs_not_linked` (quickstart scenarios 1–3).

### Tests for User Story 1 (write first, observe failing)

- [X] T013 [P] [US1] Unit tests for sync reconciliation in `backend/tests/unit/librarySyncService.test.ts`: first-sync mode (union merge pushes Firestore-only entries, migrates notes/condition per FR-010 including unmappable→notes append, deletes legacy fields only after confirmed writes, sets `initialLibrarySyncAt` only on full pass, per-entry failure keeps legacy fields and flag unset); mirror mode (Discogs-only instance → entry created with `date_added`, Firestore-only entry → deleted, nothing pushed); lowest-`instance_id` selection for multi-instance releases (research R8)
- [X] T014 [P] [US1] Update contract tests in `backend/tests/contract/library.contract.test.ts` for `GET /api/library` and `GET /api/library/:id`: 409 `discogs_not_linked` when no connection, 401 `discogs_link_invalid` on `DiscogsAuthError`, new `EnrichedLibraryEntry` shape with `discogs` object and without top-level `condition`/`notes`, `refresh=true` forcing sync
- [X] T015 [P] [US1] Integration test in `backend/tests/integration/librarySync.integration.test.ts` (Firestore emulator + nock): full sync-on-read pass, throttle marker `discogs:libsync:{uid}` skips second sync within TTL, `refresh=true` bypasses it, mid-pass Discogs failure returns 503 leaving mirror intact

### Backend implementation for User Story 1

- [X] T016 [US1] Update `backend/src/library/libraryService.ts`: create entries with `discogsInstanceId`/`discogsFolderId` (and `addedAt` from a provided date), helper to delete legacy `condition`/`notes` via `FieldValue.delete()`, list/read unchanged otherwise (T013 support)
- [X] T017 [US1] Implement `backend/src/library/librarySyncService.ts`: `syncLibrary(uid)` with first-sync vs mirror mode off `discogsConnections/{uid}.initialLibrarySyncAt` (research R3), throttle marker read/write via cacheAside/ioredis (research R2), reconciliation + migration logic, structured logs (`sync_completed`, `first_sync_migrated`, `entry_added`, `entry_removed`, per-entry failures) (T013, T015 green)
- [X] T018 [US1] Rework `backend/src/routes/library.ts` GET `/` and GET `/:id`: require-connection guard returning 409 `discogs_not_linked` (connection via `getConnection`), run `syncLibrary` before listing honoring `?refresh=true`, map `DiscogsAuthError`→401 `discogs_link_invalid` and collection failures→503 `discogs_unavailable` per contracts/library-sync-api.md, include `discogs` data on entries (T014 green)

### Frontend implementation for User Story 1

- [X] T019 [P] [US1] Component tests in `frontend/tests/` for the link-required gate (renders message + CTA to `/app/profile` on `discogs_not_linked`, re-link variant on `discogs_link_invalid`) and the library refresh action (calls list with `refresh=true`)
- [X] T020 [US1] Update `frontend/src/services/apiClient.ts` (surface non-2xx response bodies with their `error` code) and `frontend/src/services/libraryApi.ts` (new `EnrichedLibraryEntry` shape with `discogs`, `list(page, pageSize, refresh?)`)
- [X] T021 [US1] Update `frontend/src/queries/libraryQueries.ts`: typed API errors, `useLibraryList` with refresh support (T019 green)
- [X] T022 [P] [US1] Create `frontend/src/components/LibraryLinkRequired.tsx`: Card-based state (not-linked and re-link variants), CTA to `/app/profile`, dark mode, same sizing as list states (no layout shift)
- [X] T023 [US1] Update `frontend/src/pages/LibraryListPage.tsx`: render `LibraryLinkRequired` on gate errors, hide records/actions for unlinked users, add Refresh button beside "Add a record" (T019 green)
- [X] T024 [US1] E2E spec `e2e/tests/library-discogs-sync.spec.ts` (against the T001 stub): unlinked gate scenario, first-sync union merge + migration visible in stub state, discogs.com-side deletion disappearing after Refresh and not re-added

**Checkpoint**: User Story 1 fully functional — MVP: library is the synced collection, gate works, legacy data migrated

---

## Phase 4: User Story 2 — Edit my copy's Discogs data from the record detail (Priority: P2)

**Goal**: Record detail shows and edits rating (5 stars), media condition, sleeve condition, and notes with per-field autosave persisted to the Discogs collection.

**Independent Test**: Open an owned record's detail, set rating/conditions/notes, reload and verify persistence and the same values on the Discogs side (quickstart scenario 5).

### Tests for User Story 2 (write first, observe failing)

- [X] T025 [P] [US2] Contract tests in `backend/tests/contract/library.contract.test.ts` for `PATCH /api/library/:id`: one-field-per-call rating (instance POST) and condition/notes (fields endpoint) write-through, zod rejection of out-of-set conditions and rating outside 0–5, 400 when targeting a field whose map entry is null, 401 `discogs_link_invalid` on revoked credentials, response reflects post-write state
- [X] T026 [P] [US2] Component tests for `StarRating` (renders 0–5, click sets value, click on current value clears to 0, keyboard accessible) in `frontend/tests/components/StarRating.test.tsx`, and for the reworked `MyCopySection` (grading options only in selects, per-field save callbacks, disabled control with hint when `editable` is false) in `frontend/tests/components/MyCopySection.test.tsx`

### Implementation for User Story 2

- [X] T027 [US2] Add per-copy operations to `backend/src/library/librarySyncService.ts`: `getCopyData(uid, entry)` (instance fetch for detail) and `updateCopyData(uid, entry, patch)` (rating via instance endpoint, conditions/notes via fields endpoint using the cached field map; never report saved without Discogs confirmation) (T025 support)
- [X] T028 [US2] Rework `PATCH /:id` in `backend/src/routes/library.ts`: zod body schema `{rating?, mediaCondition?, sleeveCondition?, notes?}` validated against `conditionGrading.ts` sets, wire to `updateCopyData`, error mapping per contract (T025 green)
- [X] T029 [P] [US2] Create `frontend/src/components/ui/StarRating.tsx`: atomic 5-star component (Tailwind v4 utilities, dark mode, focus-visible states) (T026 green)
- [X] T030 [US2] Rework `frontend/src/components/MyCopySection.tsx`: StarRating + media/sleeve condition selects (exact grading strings from a shared constant) + notes via existing `InlineEditableField`, per-field autosave, per-field error feedback with retry, disabled+hint when not `editable` (T026 green)
- [X] T031 [US2] Update `frontend/src/services/libraryApi.ts` + `frontend/src/queries/libraryQueries.ts` (`useUpdateLibraryEntry` sends exactly one field per call) and wire the panel in `frontend/src/pages/RecordDetailPage.tsx` to `entry.discogs`
- [X] T032 [US2] Update `e2e/tests/record-detail-inline-edit.spec.ts`: rating/media/sleeve/notes edits persist against the Discogs stub, values survive reload, save failure shows retryable error without claiming success

**Checkpoint**: User Stories 1 AND 2 work — per-copy data lives in Discogs and is editable

---

## Phase 5: User Story 3 — Adding a record updates both sides (Priority: P2)

**Goal**: Adding from Vinylmania writes to the Discogs collection first, then mirrors locally; failures abort visibly.

**Independent Test**: Add a release, verify it in the library and in the Discogs collection (stub or discogs.com) immediately (quickstart scenario 4).

### Tests for User Story 3 (write first, observe failing)

- [X] T033 [P] [US3] Contract tests in `backend/tests/contract/library.contract.test.ts` for `POST /api/library`: body accepts only `{discogsReleaseId}` (400 on `condition`/`notes` or unknown keys), write-through order (Discogs add → returned `instance_id` stored on the mirror entry), Discogs failure → no mirror entry and 503/429 per contract, 409 `discogs_not_linked` when unlinked

### Implementation for User Story 3

- [X] T034 [US3] Add `addToLibrary(uid, releaseId)` write-through to `backend/src/library/librarySyncService.ts` and rework `POST /` in `backend/src/routes/library.ts` (zod body, catalog 404 → `release_not_found` preserved) (T033 green)
- [X] T035 [US3] Update frontend create path: `frontend/src/queries/libraryQueries.ts` `useCreateLibraryEntry({discogsReleaseId})` only, `frontend/src/services/libraryApi.ts` create signature, and gate/link-error handling in `frontend/src/pages/AddRecordPage.tsx` plus any other create call sites (`frontend/src/components/ResultCardActions.tsx`)
- [X] T036 [US3] Add add-propagation scenario to `e2e/tests/library-discogs-sync.spec.ts`: add from search → appears in library and in stub collection (folder 1); stub failure → visible error, record not shown as owned

**Checkpoint**: Additions propagate; failure never leaves a phantom owned record

---

## Phase 6: User Story 4 — Removing a record updates both sides (Priority: P3)

**Goal**: Removing from Vinylmania deletes the managed Discogs instance first, then the mirror entry.

**Independent Test**: Remove an owned record from the detail view, verify it is gone from the library and the Discogs collection (quickstart scenario 6).

### Tests for User Story 4 (write first, observe failing)

- [X] T037 [P] [US4] Contract tests in `backend/tests/contract/library.contract.test.ts` for `DELETE /api/library/:id`: write-through order, Discogs failure → entry untouched + error, Discogs 404 (instance already gone) → mirror entry deleted anyway + 204, 409/401 gate errors

### Implementation for User Story 4

- [X] T038 [US4] Add `removeFromLibrary(uid, entry)` write-through to `backend/src/library/librarySyncService.ts` and rework `DELETE /:id` in `backend/src/routes/library.ts` (T037 green)
- [X] T039 [US4] Surface removal failures in `frontend/src/pages/RecordDetailPage.tsx` (error state instead of silent navigation; existing confirm dialog kept)
- [X] T040 [US4] Add remove-propagation scenario to `e2e/tests/library-discogs-sync.spec.ts`: remove from detail → gone from library and stub collection; stub failure → record still shown, error visible

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Release hygiene required by the constitution and final validation

- [X] T041 [P] Backend changelog + version: add `Changed`/`Removed`/`Added` entries describing the breaking API/data change and migration path to `backend/CHANGELOG.md` under a new dated `0.4.0` heading; bump `backend/package.json` to `0.4.0`
- [X] T042 [P] Frontend changelog + version: matching entries in `frontend/CHANGELOG.md` under `0.7.0`; bump `frontend/package.json` to `0.7.0`
- [X] T043 Sweep for dead code: remove legacy condition/notes handling left in `frontend/src/components/MyCopySection.tsx` constants, `frontend/src/queries/libraryQueries.ts` arg types, and unused `UpdateLibraryEntryInput`/`CreateLibraryEntryInput` fields in `backend/src/library/types.ts`
- [X] T044 Verify structured logging coverage per FR-013 (sync outcomes, migration, auth failures, rate-limit metadata) across `backend/src/library/librarySyncService.ts` and `backend/src/discogs/collection/collectionClient.ts`; add missing log lines
- [X] T045 Run full validation: `cd backend && npm test`, `cd frontend && npm test`, `cd e2e && npx playwright test`, then walk `specs/016-library-discogs-sync/quickstart.md` manual scenarios 1–7

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T001 and T002 in parallel
- **Foundational (Phase 2)**: Depends on T002 (nock helpers) for T006; T003–T006 (tests) before their paired implementations; T011 depends on T007, T008, T010; T012 independent after tests — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 complete. T013–T015 (red) → T016 → T017 → T018; frontend T019 (red) → T020 → T021 → T022/T023; T024 last (needs T001 stub + backend + frontend)
- **US2 (Phase 4)**: Depends on Phase 2; touches `routes/library.ts`, `libraryApi.ts`, `libraryQueries.ts` after US1's rework of those files — implement after US1 (or coordinate carefully)
- **US3 (Phase 5)** / **US4 (Phase 6)**: Depend on Phase 2; same shared-file caveat with US1/US2 for `routes/library.ts`, `librarySyncService.ts`, `libraryQueries.ts`
- **Polish (Phase 7)**: After all desired stories; T041/T042 in parallel; T045 last

### User Story Dependencies

- **US1 (P1)**: None beyond Foundational — the MVP
- **US2 (P2)**: Functionally independent (editable panel testable with any synced entry), but shares backend route/service files with US1 → schedule after US1
- **US3 (P2)**: Functionally independent; shares files with US1/US2 → sequential in a solo workflow
- **US4 (P3)**: Functionally independent; same sharing caveat

### Within Each User Story

- Tests written and failing before implementation (constitution Principle I)
- Service logic before route wiring; API/services before queries before components/pages; e2e last

### Parallel Opportunities

- Phase 1: T001 ∥ T002
- Phase 2: T003 ∥ T004 ∥ T005 ∥ T006 (tests), then T008 ∥ T009 ∥ T010 (different files)
- US1: T013 ∥ T014 ∥ T015; T019 ∥ T022; backend track (T016–T018) ∥ frontend track (T019–T023) once contracts are fixed
- US2: T025 ∥ T026; T029 parallel with backend T027/T028
- Polish: T041 ∥ T042

---

## Parallel Example: User Story 1

```bash
# Red tests together (different files):
Task: "Unit tests for sync reconciliation in backend/tests/unit/librarySyncService.test.ts"
Task: "Contract tests for library GET endpoints in backend/tests/contract/library.contract.test.ts"
Task: "Integration test in backend/tests/integration/librarySync.integration.test.ts"

# Then backend and frontend tracks in parallel:
Task: "Implement librarySyncService.ts + routes (T016→T017→T018)"
Task: "Frontend gate + refresh (T019→T020→T021→T022→T023)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (stubs/helpers) → Phase 2 (collection client + domain, all foundational tests green)
2. Phase 3: US1 — synced, gated, migrated library
3. **STOP and VALIDATE**: quickstart scenarios 1–3 + `library-discogs-sync.spec.ts`; deploy/demo — the library is now the Discogs collection even before editing/add/remove propagation ship

### Incremental Delivery

1. + US2 → per-copy editing (quickstart 5) → deploy
2. + US3 → add propagation (quickstart 4) → deploy
3. + US4 → remove propagation (quickstart 6) → deploy
4. Phase 7 polish (changelogs/version bumps are required in the SAME PR as the code they describe — if delivering in multiple PRs, split T041/T042 accordingly)

### Solo/Small-Team Note

Stories share `backend/src/routes/library.ts`, `backend/src/library/librarySyncService.ts`, and `frontend/src/queries/libraryQueries.ts`; sequential story order (US1→US2→US3→US4) avoids merge conflicts. With two developers, split backend vs frontend tracks inside each story instead of parallelizing stories.

---

## Notes

- Verify each red test fails for the right reason before implementing (Principle I)
- Commit after each task or logical group with Conventional Commits; the breaking contract change lands as `feat!`
- Constitution: e2e must cover the changed frontend flows (T024, T032, T036, T040) and the full suite gates the deployment pipeline, not each local iteration

---

description: "Task list template for feature implementation"
---

# Tasks: Discogs Catalog Client & Data Model

**Input**: Design documents from `/specs/002-discogs-api-client/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/discogs-client.md](./contracts/discogs-client.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED. The constitution's Principle I (Test-First,
NON-NEGOTIABLE) overrides the template default of "tests optional," and the
user explicitly required all tests to pass by the end of development. Every
implementation task below is preceded by a test task that must be written
and failing first.

**Organization**: Tasks are grouped by user story (from spec.md) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description

## Path Conventions

All work happens inside the existing `backend/` project (from feature 001):
`backend/src/discogs/`, `backend/tests/{contract,unit,integration}/`.

---

## Phase 1: Setup

**Purpose**: Add the new dependencies and scaffold the module's file layout

- [X] T001 Add `axios` and `zod` as dependencies, and `nock` as a devDependency, to `backend/package.json`; run `npm install`
- [X] T002 [P] Create the `backend/src/discogs/` directory and empty `types.ts`, `discogsErrors.ts`, `discogsClient.ts`, `discogsMapper.ts` files per [plan.md](./plan.md#project-structure)

**Checkpoint**: Dependencies installed, module skeleton exists.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Define the shared internal TypeScript types in `backend/src/discogs/types.ts` (`CatalogSearchResult`, `Release`, `ReleaseArtistCredit`, `Track`, `LabelCredit`, `FormatDescriptor`, `CatalogImage`, `Artist`, `ArtistAliasRef`) per [data-model.md](./data-model.md)
- [X] T004 [P] Implement the error taxonomy (`DiscogsError` base, `DiscogsNotFoundError`, `DiscogsRateLimitError`, `DiscogsUnavailableError`, `DiscogsValidationError`) in `backend/src/discogs/discogsErrors.ts` per [contracts/discogs-client.md](./contracts/discogs-client.md#error-taxonomy-backendsrcdiscogsdiscogserrorsts)
- [X] T005 [P] Configure the `nock` test helper (enable interceptors, `disableNetConnect` for contract tests, reset between tests) in `backend/tests/helpers/nock.ts`
- [X] T006 Configure the shared axios instance — `baseURL` `https://api.discogs.com`, `Authorization: Discogs token=${DISCOGS_TOKEN}`, `User-Agent` from `DISCOGS_USER_AGENT`, timeout — with a response interceptor that classifies 404/429/5xx/network errors into the error taxonomy and logs the outcome plus Discogs' rate-limit headers via `backend/src/config/logger.ts`, in `backend/src/discogs/discogsClient.ts` (depends on T003, T004)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Find the right release or artist by searching (Priority: P1) 🎯 MVP

**Goal**: Given a free-text query, return relevant Discogs release or artist
matches mapped into `CatalogSearchResult`.

**Independent Test**: Call `searchCatalog('Stockholm', { resultType:
'release' })` and confirm the well-known release "The Persuader - Stockholm"
(Discogs ID 1) appears among the mapped results.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, and confirm they FAIL before implementation.

- [X] T007 [US1] Contract test: `searchCatalog()` happy path for `resultType: 'release'` and `resultType: 'artist'`, `nock`-mocked against `/database/search`, in `backend/tests/contract/discogsClient.contract.test.ts`
- [X] T008 [US1] Contract test: `searchCatalog()` error paths (429 rate limit, 5xx/network failure) via `nock`, in `backend/tests/contract/discogsClient.contract.test.ts` (same file as T007 — sequential, not parallel)
- [X] T009 [P] [US1] Unit test: search-result mapping handles a missing `thumb`/`year` without failing, in `backend/tests/unit/discogsMapper.test.ts`
- [X] T010 [P] [US1] Live integration test: `searchCatalog('Stockholm', { resultType: 'release' })` against the real API includes release ID `1` among its results, in `backend/tests/integration/discogsClient.live.test.ts`

### Implementation for User Story 1

- [X] T011 [US1] Implement `mapSearchResult()` (zod-validate the raw Discogs search item, then map to `CatalogSearchResult`) in `backend/src/discogs/discogsMapper.ts` (depends on T003, T009)
- [X] T012 [US1] Implement `searchCatalog()` in `backend/src/discogs/discogsClient.ts` — short-circuits to an empty result for an empty/whitespace query, otherwise calls `GET /database/search` with `q`/`type`/`page`/`per_page` and maps each result via `mapSearchResult` (depends on T006, T011)

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - View full details of a specific release (Priority: P1)

**Goal**: Given a Discogs release ID, return its full detail mapped into the
internal `Release` shape.

**Independent Test**: Call `getRelease(1)` and confirm it resolves to a
mapped `Release` titled "Stockholm" with "The Persuader" among its artists
and a non-empty tracklist.

### Tests for User Story 2 ⚠️

> Write these tests FIRST, and confirm they FAIL before implementation.

- [X] T013 [US2] Contract test: `getRelease()` happy path (200), `nock`-mocked against `/releases/{id}`, in `backend/tests/contract/discogsClient.contract.test.ts`
- [X] T014 [US2] Contract test: `getRelease()` error paths (404 not-found, 429, 5xx/network) via `nock`, in `backend/tests/contract/discogsClient.contract.test.ts` (same file as T013 — sequential, not parallel)
- [X] T015 [P] [US2] Unit test: release mapping handles multiple artists, an empty tracklist/images array, and a present/absent `master_id`, in `backend/tests/unit/discogsMapper.test.ts`
- [X] T016 [P] [US2] Live integration test: `getRelease(1)` against the real API maps correctly (title, artists, tracklist), in `backend/tests/integration/discogsClient.live.test.ts`

### Implementation for User Story 2

- [X] T017 [US2] Implement `mapRelease()` in `backend/src/discogs/discogsMapper.ts` (depends on T003, T015)
- [X] T018 [US2] Implement `getRelease()` in `backend/src/discogs/discogsClient.ts` — calls `GET /releases/{id}`, translates a 404 into `DiscogsNotFoundError` via the shared interceptor, maps the body via `mapRelease` (depends on T006, T017)

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - View full details of a specific artist (Priority: P2)

**Goal**: Given a Discogs artist ID, return its full detail mapped into the
internal `Artist` shape.

**Independent Test**: Call `getArtist(1)` and confirm it resolves to a
mapped `Artist` named "The Persuader" with `realName` "Jesper Dahlbäck" and a
non-empty `aliases` list.

### Tests for User Story 3 ⚠️

> Write these tests FIRST, and confirm they FAIL before implementation.

- [X] T019 [US3] Contract test: `getArtist()` happy path (200), `nock`-mocked against `/artists/{id}`, in `backend/tests/contract/discogsClient.contract.test.ts`
- [X] T020 [US3] Contract test: `getArtist()` error paths (404, 429, 5xx/network) via `nock`, in `backend/tests/contract/discogsClient.contract.test.ts` (same file as T019 — sequential, not parallel)
- [X] T021 [P] [US3] Unit test: artist mapping handles aliases and a missing `realname`/`profile`/`images`, in `backend/tests/unit/discogsMapper.test.ts`
- [X] T022 [P] [US3] Live integration test: `getArtist(1)` against the real API maps correctly (name, realName, aliases), in `backend/tests/integration/discogsClient.live.test.ts`

### Implementation for User Story 3

- [X] T023 [US3] Implement `mapArtist()` in `backend/src/discogs/discogsMapper.ts` (depends on T003, T021)
- [X] T024 [US3] Implement `getArtist()` in `backend/src/discogs/discogsClient.ts` — calls `GET /artists/{id}`, translates a 404 into `DiscogsNotFoundError` via the shared interceptor, maps the body via `mapArtist` (depends on T006, T023)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and hardening across all user stories

- [X] T025 [P] Run the manual validation script in [quickstart.md](./quickstart.md#validate-manually) end-to-end against the real Discogs API
- [X] T026 [P] Verify no secrets are committed — `DISCOGS_TOKEN` is never hardcoded, `backend/.env` stays git-ignored — cross-checked against the root `.gitignore`
- [X] T027 Run the full backend test suite (contract + unit + live integration) and confirm every test passes, per the user's explicit requirement
- [X] T028 [P] Add a short "Discogs catalog client" pointer to the project README linking to [quickstart.md](./quickstart.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion only
- **User Story 2 (Phase 4)**: Depends on Foundational completion only — shares `discogsMapper.ts`/`discogsClient.ts` files with US1 but adds independent functions, so no logical dependency on US1's own tests passing
- **User Story 3 (Phase 5)**: Depends on Foundational completion only — same file-sharing note as US2
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories
- **User Story 2 (P1)**: No dependency on other stories (independently testable via `getRelease` alone)
- **User Story 3 (P2)**: No dependency on other stories (independently testable via `getArtist` alone)

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Principle I)
- Mapping function (`mapX`) before the client function that uses it
- Story complete before moving to the next priority

### Parallel Opportunities

- Setup: T002 can run alongside T001
- Foundational: T004 and T005 can run in parallel (different files); T003 must precede T006, T004 must precede T006
- Each story's unit test and live-integration test (e.g., T009/T010, T015/T016, T021/T022) can run in parallel with each other and with that story's contract tests, since they're in different files — but the two contract-test tasks within a story (e.g., T007/T008) touch the same file and must run sequentially
- Because US1/US2/US3 share `discogsClient.ts` and `discogsMapper.ts`, their *implementation* tasks (e.g., T012, T018, T024) should not literally run at the same time even though the stories are logically independent — treat the three stories as sequential waves in practice, despite each being independently testable

---

## Parallel Example: User Story 2

```bash
# These can run in parallel (different files):
Task: "Unit test: release mapping handles multiple artists, empty tracklist/images, present/absent master_id in backend/tests/unit/discogsMapper.test.ts"
Task: "Live integration test: getRelease(1) against the real API in backend/tests/integration/discogsClient.live.test.ts"

# This must follow both contract-test tasks in sequence (same file):
Task: "Contract test: getRelease() happy path in backend/tests/contract/discogsClient.contract.test.ts"
Task: "Contract test: getRelease() error paths in backend/tests/contract/discogsClient.contract.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (search)
4. **STOP and VALIDATE**: confirm `searchCatalog` returns real, correctly-mapped results
5. Demo if ready — note that full release/artist detail (US2/US3) isn't available yet

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 (search) → validate independently → demo
3. Add User Story 2 (release detail) → validate independently → demo (search + "view this release" now both work)
4. Add User Story 3 (artist detail) → validate independently → demo (full scope complete)
5. Polish → manual quickstart run, secrets check, full suite green

---

## Notes

- [P] tasks touch different files and have no unmet dependencies
- [Story] labels map every implementation task back to spec.md's user stories
- Commit after each task or logical group, using Conventional Commits per the constitution
- Tests must fail before their corresponding implementation task is started
- The user explicitly required all tests to pass by the end of development — T027 is the final gate for that
- Avoid: vague tasks, two tasks editing the same file in parallel, cross-story dependencies that break independent testability (beyond the noted shared-file caution above)

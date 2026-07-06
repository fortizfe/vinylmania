# Tasks: Record Rating Badges on Search and Library Cards

**Input**: Design documents from `/specs/017-record-rating-cards/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/discogs-search-rating-api.md](./contracts/discogs-search-rating-api.md), [quickstart.md](./quickstart.md)

**Tests**: INCLUDED and REQUIRED — the project constitution makes Test-First non-negotiable, and this feature changes frontend user flows plus a backend API contract.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Every task includes an exact file path

## Path Conventions

Web app structure per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the red-test baseline and the fixture surfaces this feature will extend

- [X] T001 [P] Add search-rating fixture builders for enriched, non-enriched, and slow/never-resolving release results in `backend/tests/helpers/nock.ts`
- [X] T002 [P] Extend frontend search and library card test fixtures with reusable rating/no-rating variants in `frontend/tests/testUtils.tsx`
- [X] T003 Run the current targeted suites as baseline checks in `backend/tests/contract/discogsSearch.contract.test.ts`, `frontend/tests/unit/SearchResultCard.test.tsx`, and `frontend/tests/unit/RecordCard.test.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contract and presentation primitives required before story work begins

**⚠️ CRITICAL**: No user story work should begin until this phase is complete

### Tests for Foundational Work

- [X] T004 [P] Add unit tests for rating visibility, one-decimal formatting, and threshold banding in `frontend/tests/unit/releaseRating.test.ts`
- [X] T005 [P] Extend the search API contract coverage for additive `communityRating`, partial omission, and a per-lookup timeout past 2 seconds being treated as omission (SC-006) in `backend/tests/contract/discogsSearch.contract.test.ts`
- [X] T006 [P] Add unit tests asserting each band's badge text/background pairing meets WCAG AA contrast (≥4.5:1, FR-013) and that the three band background colors are objectively distinguishable from one another (SC-001) in `frontend/tests/unit/ReleaseRatingBadge.test.tsx`

### Implementation for Foundational Work

- [X] T007 Create the shared rating helper for validation, formatting, and band selection in `frontend/src/lib/releaseRating.ts`
- [X] T008 Define the `--color-rating-low` (`#DC2626`), `--color-rating-medium` (`#FBBF24`), and `--color-rating-high` (`#15803D`) theme tokens per research.md §8 in `frontend/src/styles/global.css`
- [X] T009 Create the reusable rounded-square badge component consuming the new color tokens in `frontend/src/components/ui/ReleaseRatingBadge.tsx`
- [X] T010 Extend the backend search result type with optional community rating in `backend/src/discogs/types.ts`
- [X] T011 Update the frontend search result type with optional community rating in `frontend/src/services/discogsApi.ts`

**Checkpoint**: Shared rating logic, accessible color tokens, and the additive API contract are defined and testable

---

## Phase 3: User Story 1 - Scan a release's rating at a glance in search results (Priority: P1) 🎯 MVP

**Goal**: Search-result cards display a visible, correctly colored rating badge using backend-enriched Discogs community rating data, with per-release lookups bounded by a 2-second timeout.

**Independent Test**: Search for releases with mixed rating bands and confirm each eligible result card shows the rating badge in the thumbnail corner with correct color and without disturbing add/preview interactions; confirm a stubbed slow lookup still returns a usable card within budget.

### Tests for User Story 1

- [X] T012 [P] [US1] Update search-result card rendering assertions for badge presence, badge omission, and corner placement in `frontend/tests/unit/SearchResultCard.test.tsx`
- [X] T013 [P] [US1] Add integration coverage for enriched search payload rendering in the add-record flow in `frontend/tests/integration/addRecordFlow.test.tsx`
- [X] T014 [P] [US1] Add backend integration coverage for partial rating-enrichment omission and for a per-release lookup exceeding the 2-second timeout (SC-006), verifying the search response still returns `200` without blocking, in `backend/tests/integration/discogsCacheOutage.test.ts`
- [X] T015 [P] [US1] Add e2e coverage for visible, correctly colored rating badges in the search-result flow in `e2e/tests/caching-navigation.spec.ts`

### Implementation for User Story 1

- [X] T016 [US1] Extend Discogs search-result parsing to carry optional rating enrichment in `backend/src/discogs/discogsMapper.ts`
- [X] T017 [US1] Implement cached community-rating lookup with a 2-second per-lookup timeout (SC-006) and search-result enrichment in `backend/src/discogs/discogsClient.ts`
- [X] T018 [US1] Update the authenticated search route logging and response shaping for per-result rating enrichment in `backend/src/routes/discogs.ts`
- [X] T019 [US1] Render the shared rating badge inside the thumbnail overlay of search cards in `frontend/src/components/SearchResultCard.tsx`
- [X] T020 [US1] Preserve no-layout-shift loading behavior for rated search cards in `frontend/src/components/SearchResultCardSkeleton.tsx` (verified: badge is absolutely positioned inside the existing thumbnail wrapper, so no skeleton dimensions change)

**Checkpoint**: Search-result cards independently deliver the requested rating signal, degrade correctly on slow/failed lookups, and remain fully usable — this checkpoint is the shippable MVP slice, now with its own e2e coverage

---

## Phase 4: User Story 2 - Compare owned records by rating inside My Library (Priority: P1)

**Goal**: Library cards display the same badge component and placement, reusing the already available release community rating from library payloads.

**Independent Test**: Open My Library with rated and unrated entries and confirm the same badge appears in the same relative position on eligible cards, while unavailable catalog entries remain badge-free.

### Tests for User Story 2

- [X] T021 [P] [US2] Extend library card unit coverage for badge presence, badge omission, and unavailable-entry behavior in `frontend/tests/unit/RecordCard.test.tsx`
- [X] T022 [P] [US2] Add e2e coverage for visible rating badges on library cards in `e2e/tests/library-discogs-sync.spec.ts`

### Implementation for User Story 2

- [X] T023 [US2] Render the shared rating badge inside the thumbnail overlay of library cards in `frontend/src/components/RecordCard.tsx`
- [X] T024 [US2] Preserve skeleton alignment for library cards that will later show a badge in `frontend/src/components/RecordCardSkeleton.tsx` (verified: no change needed, same reasoning as T020)

**Checkpoint**: Search and library cards now share one consistent rating language across discovery and ownership views

---

## Phase 5: User Story 3 - Keep the badge informative but not invasive (Priority: P2)

**Goal**: The badge reads as a modern secondary accent across responsive layouts instead of dominating the card.

**Independent Test**: Review search and library cards on narrow and wide viewports and confirm the badge stays legible, contained in the thumbnail zone, and does not compete with core text or actions.

### Tests for User Story 3

- [X] T025 [P] [US3] Add unit assertions for the badge component's semantic band styling and compact label rendering in `frontend/tests/unit/ReleaseRatingBadge.test.tsx`
- [X] T026 [P] [US3] Add browser-level responsive assertions for badge containment on search and library grids in `e2e/tests/caching-navigation.spec.ts`

### Implementation for User Story 3

- [X] T027 [US3] Tune badge sizing and dark-mode treatment for all three bands, building on the WCAG AA-compliant tokens from T008, in `frontend/src/components/ui/ReleaseRatingBadge.tsx`
- [X] T028 [US3] Adjust search and library card thumbnail wrappers for consistent overlay anchoring in `frontend/src/components/SearchResultCard.tsx` and `frontend/src/components/RecordCard.tsx`
- [X] T029 [US3] Ensure the add-record and library grid pages preserve card readability with the new overlay at all breakpoints in `frontend/src/pages/AddRecordPage.tsx` and `frontend/src/pages/LibraryListPage.tsx` (verified: no change needed, grids only lay out card components unchanged)

**Checkpoint**: The rating badge feels integrated into the UI instead of bolted on

---

## Phase 6: User Story 4 - Handle unrated and boundary values predictably (Priority: P3)

**Goal**: Cards hide missing ratings and map exact threshold values to the correct red, yellow, or green band every time.

**Independent Test**: Validate cards and helper logic against no-rating, `2.50`, `2.51`, `4.09`, `4.10`, and `5.00` cases and confirm the correct show/hide and color behavior.

### Tests for User Story 4

- [X] T030 [P] [US4] Extend helper tests with explicit threshold, invalid-value, and lookup-timeout-as-omission cases in `frontend/tests/unit/releaseRating.test.ts`
- [X] T031 [P] [US4] Extend backend contract coverage for rated versus unrated search results in `backend/tests/contract/discogsSearch.contract.test.ts`

### Implementation for User Story 4

- [X] T032 [US4] Finalize omission rules and threshold boundaries in `frontend/src/lib/releaseRating.ts`
- [X] T033 [US4] Enforce omission of zero-vote, invalid, or timed-out rating enrichments during backend search mapping in `backend/src/discogs/discogsClient.ts` and `backend/src/discogs/discogsMapper.ts`

**Checkpoint**: Edge-case rating behavior is deterministic and independently testable

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Release hygiene, observability, and end-to-end validation required by the constitution

- [X] T034 [P] Add backend changelog entry and bump the package version for the additive search-rating contract change, including the 2-second timeout behavior, in `backend/CHANGELOG.md` and `backend/package.json`
- [X] T035 [P] Add frontend changelog entry and bump the package version for the new rating badge UI, including the WCAG AA-compliant color tokens, in `frontend/CHANGELOG.md` and `frontend/package.json`
- [X] T036 Add structured logging for per-result rating enrichment degradation, including timeout outcomes, in `backend/src/discogs/discogsClient.ts` and `backend/src/routes/discogs.ts`
- [X] T037 [P] Sweep for duplicate or dead inline rating logic after badge adoption in `frontend/src/components/SearchResultCard.tsx`, `frontend/src/components/RecordCard.tsx`, and `frontend/src/lib/releaseRating.ts`
- [ ] T038 Run the full quickstart validation flow from `specs/017-record-rating-cards/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 and T002 can run in parallel
- **Foundational (Phase 2)**: Depends on Setup; T004–T006 must fail before T007–T011 are considered complete; blocks all story work
- **User Story 1 (Phase 3)**: Depends on Foundational; backend enrichment tasks T016–T018 (including the 2-second timeout) should land before frontend rendering tasks T019–T020 are finalized; T015's e2e coverage makes this phase independently shippable as the MVP
- **User Story 2 (Phase 4)**: Depends on Foundational and can start after US1 contract changes are available; it reuses the same badge/helper work
- **User Story 3 (Phase 5)**: Depends on US1 and US2 because responsive tuning must cover both card types together
- **User Story 4 (Phase 6)**: Depends on Foundational and should follow US1 so boundary and timeout behavior is verified against the real enriched search payload
- **Polish (Phase 7)**: Depends on all desired stories being complete; T038 is the final task

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories; this is the suggested MVP slice for discovery-first delivery, and now carries its own e2e coverage (T015) so it is safely shippable on its own
- **US2 (P1)**: Functionally independent after Foundational, but the full requested increment is not complete until both US1 and US2 ship
- **US3 (P2)**: Depends on both card surfaces existing with the shared badge
- **US4 (P3)**: Depends on the helper and enriched search payload being in place

### Within Each User Story

- Write tests first and observe them failing before implementation
- Backend contract/client changes before frontend consumers for US1
- Shared helper, color tokens, and badge component before page-level polish
- Story checkpoint validation before moving to the next priority

### Parallel Opportunities

- Phase 1: T001 ∥ T002
- Phase 2: T004 ∥ T005 ∥ T006, then T008 ∥ T010 ∥ T011 while T007/T009 proceed
- US1: T012 ∥ T013 ∥ T014 ∥ T015, then backend track T016–T018 can proceed while frontend track T019–T020 is prepared
- US2: T021 ∥ T022, then T023 ∥ T024
- US3: T025 ∥ T026, then T027 can proceed before T029 once T028 is settled
- US4: T030 ∥ T031
- Phase 7: T034 ∥ T035 ∥ T037

---

## Parallel Example: User Story 1

```bash
# Red tests in parallel
Task: "Extend backend/tests/contract/discogsSearch.contract.test.ts for additive communityRating and timeout-as-omission coverage"
Task: "Add frontend/tests/integration/addRecordFlow.test.tsx assertions for enriched search-result badges"
Task: "Add backend/tests/integration/discogsCacheOutage.test.ts coverage for partial and timed-out rating enrichment"
Task: "Add e2e/tests/caching-navigation.spec.ts coverage for visible search-result badges"

# Then split backend and frontend implementation tracks
Task: "Implement backend search rating enrichment with a 2-second timeout in backend/src/discogs/discogsClient.ts and backend/src/routes/discogs.ts"
Task: "Render the shared badge in frontend/src/components/SearchResultCard.tsx and its skeleton"
```

## Parallel Example: User Story 2

```bash
# Tests in parallel
Task: "Extend frontend/tests/unit/RecordCard.test.tsx for rating badges"
Task: "Add e2e/tests/library-discogs-sync.spec.ts coverage for visible library card badges"

# Implementation in parallel after helper/badge are stable
Task: "Render the badge in frontend/src/components/RecordCard.tsx"
Task: "Preserve badge-ready spacing in frontend/src/components/RecordCardSkeleton.tsx"
```

## Parallel Example: User Story 3

```bash
# Responsive validation in parallel
Task: "Add frontend/tests/unit/ReleaseRatingBadge.test.tsx semantic styling assertions"
Task: "Add e2e/tests/caching-navigation.spec.ts responsive containment assertions"
```

## Parallel Example: User Story 4

```bash
# Edge-case validation in parallel
Task: "Extend frontend/tests/unit/releaseRating.test.ts with threshold and timeout-omission cases"
Task: "Extend backend/tests/contract/discogsSearch.contract.test.ts with unrated result coverage"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (includes its own e2e coverage, T015)
4. **Stop and validate**: confirm enriched search-result badges work independently, including the 2-second timeout fallback
5. Demo if needed as a discovery-first slice

### Full Requested Increment

1. Complete Setup + Foundational
2. Deliver US1 (search results)
3. Deliver US2 (library cards) so both requested surfaces are covered
4. Add US3 responsive polish
5. Add US4 edge-case hardening
6. Finish with changelogs, version bumps, logs, and quickstart validation

### Small-Team Strategy

1. One developer can take the backend enrichment track (T016–T018, T033, T036)
2. Another can take the shared frontend helper/tokens/badge and card rendering track (T007–T009, T019–T024, T027–T029)
3. Rejoin for e2e and polish tasks once both tracks land

---

## Notes

- `[P]` tasks operate on different files or can complete without waiting on another unfinished task
- `[US#]` labels map directly to the user stories in `spec.md`
- Every story remains independently testable
- Because the constitution requires Test-First, do not treat implementation tasks as started until their paired tests exist and fail
- Sorting/filtering by rating and changes to the record detail page's rating display are out of scope (spec "Out of Scope") — no tasks exist for either

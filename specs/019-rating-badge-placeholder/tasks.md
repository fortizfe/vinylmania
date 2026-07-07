# Tasks: Placeholder Rating Badge for Unrated Releases

**Input**: Design documents from `/specs/019-rating-badge-placeholder/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: INCLUDED and REQUIRED — the project constitution makes Test-First non-negotiable, and this feature changes rendered output for two existing frontend components plus their e2e coverage.

**Organization**: This feature has a single user story (US1). Tasks are grouped by phase; all user-facing implementation tasks are labeled [US1].

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[US1]**: Maps to "User Story 1 - Recognize an unrated release at a glance" in spec.md
- Every task includes an exact file path

## Path Conventions

Frontend-only change per plan.md: `frontend/src/`, `frontend/tests/`, `e2e/tests/`. No `backend/` paths are touched.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring the shared test fixtures this feature reuses up to date before writing new/updated assertions against them

- [X] T001 [P] Update the stale "badge must be omitted" doc comments on `buildUnratedSearchResult` and `buildUnratedLibraryEntry` in `frontend/tests/testUtils.tsx` to describe the new unrated-placeholder expectation (no behavior change; these fixtures already model "no valid rating" and are reused as-is)
- [X] T002 Run the current targeted suites as a baseline check: `frontend/tests/unit/releaseRating.test.ts`, `frontend/tests/unit/ReleaseRatingBadge.test.tsx`, `frontend/tests/unit/SearchResultCard.test.tsx`, `frontend/tests/unit/RecordCard.test.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared presentation model and theme tokens both card surfaces depend on

**⚠️ CRITICAL**: No user story work should begin until this phase is complete

### Tests for Foundational Work

- [X] T003 [P] Update `frontend/tests/unit/releaseRating.test.ts` so existing "hidden"/`null` expectations for missing rating, zero-count rating, out-of-range average, and non-finite average now assert `presentRating` returns `{ displayValue: '-', band: 'unrated' }` instead of `null` (per data-model.md §1)
- [X] T004 [P] Add unit tests to `frontend/tests/unit/ReleaseRatingBadge.test.tsx` asserting the `unrated` band renders `-`, applies the new gray background token, meets WCAG AA contrast (≥4.5:1) in both light and dark pairings, and exposes the `Rating not available` accessible label (per data-model.md §1–§2, research.md §2–§3); extend the existing `BAND_TOKENS` constant and its "distinguishable from one another" test with an `unrated: { background: '#D1D5DB', text: '#374151' }` entry, asserting its background is distinct from the low/medium/high hexes (spec SC-002); also assert the `unrated` badge keeps the same sizing/rounding/shadow classes (e.g. `h-8 w-8 rounded-md shadow-sm`) as the rated variants, differing only in background/text color (spec FR-004)

### Implementation for Foundational Work

- [X] T005 Define the `--color-rating-unrated` (`#D1D5DB`, light) and its `dark:` gray-600 (`#4B5563`) pairing as new theme tokens per research.md §2 in `frontend/src/styles/global.css`
- [X] T006 Extend `RatingBand` to include `'unrated'` and change `presentRating` to always return a `RatingPresentation` (never `null`), returning `{ displayValue: '-', band: 'unrated' }` whenever `isRatingVisible` is `false`, in `frontend/src/lib/releaseRating.ts`
- [X] T007 Add the `unrated` band's background/text Tailwind classes and its `Rating not available` accessible label branch to `frontend/src/components/ui/ReleaseRatingBadge.tsx`, keeping all non-color classes (sizing, rounding, shadow) identical to the rated variants (spec FR-004) (depends on T005, T006)

**Checkpoint**: `presentRating` is total and `ReleaseRatingBadge` can render all four bands — story implementation can now update its two call sites

---

## Phase 3: User Story 1 - Recognize an unrated release at a glance (Priority: P1) 🎯 MVP

**Goal**: Every search-result and library card always shows a rating badge; cards with no valid rating or a failed/timed-out lookup show `-` on a soft gray background instead of an empty thumbnail corner, while rated cards are visually unchanged.

**Independent Test**: Render a mix of rated and unrated/errored search-result and library cards; confirm every card shows a badge in the same position, rated cards keep their numeric value and color band, and unrated/errored cards show `-` on a soft gray background.

### Tests for User Story 1

- [X] T008 [P] [US1] In `frontend/tests/unit/SearchResultCard.test.tsx`, change the existing "omits the badge when there is no community rating" and "omits the badge when the community rating has no votes" tests to assert the placeholder badge (`-`, gray background) is rendered instead of omitted
- [X] T009 [P] [US1] In `frontend/tests/unit/RecordCard.test.tsx`, change the existing "omits the badge when the release has no community rating" and "omits the badge when the community rating has no votes" tests to assert the placeholder badge (`-`, gray background) is rendered instead of omitted; keep the existing "unavailable catalog entry" case badge-free (unchanged, out of scope per spec Assumptions)
- [X] T010 [P] [US1] Add an e2e case to the existing "Record rating badges on search-result cards (feature 017, US1)" describe block in `e2e/tests/caching-navigation.spec.ts` asserting a search result with no `communityRating` shows the placeholder badge
- [X] T011 [P] [US1] Add a sibling e2e case next to the existing feature-017 rating case in `e2e/tests/library-discogs-sync.spec.ts` asserting a library entry with no community rating shows the placeholder badge

### Implementation for User Story 1

- [X] T012 [US1] Remove the `rating &&` conditional guard in `frontend/src/components/SearchResultCard.tsx` so `ReleaseRatingBadge` always renders using `presentRating`'s (now total) result
- [X] T013 [US1] Remove the `rating &&` conditional guard in `frontend/src/components/RecordCard.tsx` so `ReleaseRatingBadge` always renders using `presentRating`'s (now total) result

**Checkpoint**: Both card surfaces always show a badge; unrated/errored releases show the gray placeholder in place of the previous empty gap — this is the shippable, independently testable increment

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Release hygiene and end-to-end validation required by the constitution

- [X] T014 Add a frontend changelog entry and bump the package version for the new unrated-placeholder badge state in `frontend/CHANGELOG.md` and `frontend/package.json`
- [X] T015 [P] Sweep `frontend/src/components/SearchResultCard.tsx`, `frontend/src/components/RecordCard.tsx`, and `frontend/src/lib/releaseRating.ts` for any now-dead nullable-rating handling left over from the `rating &&` guards
- [X] T016 Run the full quickstart validation flow from `specs/019-rating-badge-placeholder/quickstart.md` (frontend unit suite, production build, and e2e specs)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 and T002 can run in any order (T002 benefits from T001 landing first but does not require it)
- **Foundational (Phase 2)**: Depends on Setup; T003–T004 must fail before T005–T007 are considered complete; blocks Phase 3
- **User Story 1 (Phase 3)**: Depends on Foundational (T005–T007); T008–T011 must be updated/added and observed failing before T012–T013 land
- **Polish (Phase 4)**: Depends on Phase 3 completion; T016 is the final task

### Within Phase 2

- T003 ∥ T004 (different files) before T005–T007
- T005 before T007 (token must exist before the component references it)
- T006 can proceed in parallel with T005, but T007 depends on both

### Within Phase 3

- T008 ∥ T009 ∥ T010 ∥ T011 (four different files) before T012–T013
- T012 and T013 touch different files and can proceed in parallel once their tests are updated and failing

### Parallel Opportunities

- Phase 1: T001 ∥ T002
- Phase 2: T003 ∥ T004, then T005 ∥ T006, then T007
- Phase 3: T008 ∥ T009 ∥ T010 ∥ T011, then T012 ∥ T013
- Phase 4: T014 ∥ T015

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Red tests in parallel
Task: "Update frontend/tests/unit/releaseRating.test.ts for the total presentRating contract"
Task: "Add frontend/tests/unit/ReleaseRatingBadge.test.tsx unrated-band assertions"

# Implementation
Task: "Add --color-rating-unrated tokens to frontend/src/styles/global.css"
Task: "Extend RatingBand and make presentRating total in frontend/src/lib/releaseRating.ts"
# Then, once both land:
Task: "Add the unrated band branch to frontend/src/components/ui/ReleaseRatingBadge.tsx"
```

## Parallel Example: User Story 1

```bash
# Red tests in parallel
Task: "Update frontend/tests/unit/SearchResultCard.test.tsx omission tests to placeholder tests"
Task: "Update frontend/tests/unit/RecordCard.test.tsx omission tests to placeholder tests"
Task: "Add e2e/tests/caching-navigation.spec.ts placeholder-badge case"
Task: "Add e2e/tests/library-discogs-sync.spec.ts placeholder-badge case"

# Implementation in parallel once tests fail
Task: "Drop the rating && guard in frontend/src/components/SearchResultCard.tsx"
Task: "Drop the rating && guard in frontend/src/components/RecordCard.tsx"
```

---

## Implementation Strategy

### MVP First (and only) Slice

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (total `presentRating`, new theme tokens, badge component branch)
3. Complete Phase 3: User Story 1 (both card surfaces always render the badge)
4. **Stop and validate**: confirm placeholder badges render correctly on both surfaces, in light and dark mode, without layout shift
5. Complete Phase 4: Polish (changelog, version bump, quickstart validation)

This feature has only one user story, so there is no incremental multi-story rollout — Phase 3 delivers the entire requested increment.

---

## Notes

- `[P]` tasks operate on different files or can complete without waiting on another unfinished task
- Because the constitution requires Test-First, do not treat T005–T007 or T012–T013 as started until their paired tests (T003–T004, T008–T011) exist and fail
- No backend, API contract, or record-detail-page tasks exist — all are explicitly out of scope per spec.md Assumptions
- The "unavailable catalog entry" library fallback card (no `release`) intentionally keeps no badge at all — this is unchanged and is not a target for the placeholder

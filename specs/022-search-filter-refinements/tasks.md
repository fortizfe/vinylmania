# Tasks: Search Filter Refinements

**Input**: Design documents from `/specs/022-search-filter-refinements/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: INCLUDED and REQUIRED — the project constitution makes Test-First non-negotiable, and this feature changes a public API contract (`GET /api/discogs/search`) plus rendered/interactive behavior on an existing screen, which also triggers the mandatory e2e coverage gate for `/frontend` changes.

**Organization**: Tasks are grouped by user story from spec.md — US1 (P1, format multi-select from a fixed list), US2 (P2, Artist filter removal).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[US1]/[US2]**: Maps to the matching user story in spec.md
- Every task includes an exact file path

## Path Conventions

Web application per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a clean pre-change baseline for every suite this feature touches

- [X] T001 Run the current targeted suites as a baseline check: `backend/tests/contract/discogsSearch.contract.test.ts`, `frontend/tests/unit/useSearchQueryParams.test.tsx`, `frontend/tests/unit/SearchFiltersControl.test.tsx`, `frontend/tests/integration/searchResultsFlow.test.tsx`, `e2e/tests/search-result-filters.spec.ts` — confirm all pass before any change (these are the feature-021 suites this feature modifies; the pre-existing Genre/Style cases within them are the baseline this feature's FR-006 "unchanged" guarantee is measured against — see T027)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure required before any user story

No shared foundational infrastructure is required beyond Setup: US1 (format
multi-select) and US2 (Artist removal) touch largely disjoint concerns within
the same files established by feature 021, and each is independently
implementable once Setup's baseline is confirmed. Proceed directly to User
Story 1.

**Checkpoint**: Baseline confirmed — user story implementation can now begin

---

## Phase 3: User Story 1 - Select one or more formats from a fixed list (Priority: P1) 🎯 MVP

**Goal**: The Format filter becomes a fixed, multi-select checklist (opened from a compact trigger) instead of free text; selecting multiple values returns releases matching all of them together (AND — verified against live Discogs during T014; originally assumed to be OR, corrected after implementation); the selection persists in the URL and survives reload/sharing; unrecognized format values in old links are dropped gracefully.

**Independent Test**: Open the format filter, select two format values (e.g. "Vinyl" and "CD"), apply the filters, and confirm results include only releases available in both selected formats together (quickstart Scenario 1).

### Tests for User Story 1

- [X] T002 [P] [US1] Create `frontend/tests/unit/components/ui/Checkbox.test.tsx`: renders a labeled checkbox linked by `id`/`htmlFor`, reflects a `checked` prop, and calls `onChange` when clicked
- [X] T003 [P] [US1] Extend `frontend/tests/unit/useSearchQueryParams.test.tsx`: `useSearchQueryParams` parses a comma-joined `format` URL param into a `string[]` containing only values found in `FORMAT_OPTIONS`, silently dropping any that aren't (FR-010); the returned array is ordered per `FORMAT_OPTIONS`' canonical order regardless of the order values appeared in the URL (pinning the ordering contract left open in `contracts/search-results-filter-ui.md`); `buildSearchPath` accepts `format: string[]` and serializes it back into a single comma-joined `format` param in that same canonical order, omitting the param entirely when the array is empty (FR-005); a parse → build → parse round trip reproduces the identical array (FR-007) — replaces feature 021's single-string `format` parse/build cases
- [X] T004 [P] [US1] Extend `backend/tests/contract/discogsSearch.contract.test.ts`: a request with `format=Vinyl,CD` forwards that exact comma-joined string, unchanged, to the outbound `GET /database/search` call in a single request — no per-value splitting or multiple upstream calls (per `contracts/discogs-search-filters-api.md`)
- [X] T005 [P] [US1] Extend `frontend/tests/unit/SearchFiltersControl.test.tsx`: a Format trigger `Button` is rendered (not an `Input`), labeled "Format" with no selection and "Format (N)" with N selected; clicking it opens a modal listing every `FORMAT_OPTIONS` entry, in canonical order, as an unchecked `Checkbox` by default; checking two options and clicking the outer "Apply filters" calls `onApply` with `format` containing both selected values (Acceptance Scenarios 1–3); checking or unchecking a format checkbox WITHOUT clicking "Apply filters" MUST NOT call `onApply` by itself (FR-008, mirroring feature 021's "not called on every keystroke" guarantee); "Clear filters" resets the selection to an empty array (Acceptance Scenario 4) — replaces feature 021's "Format is a free-text field" assertions
- [X] T006 [P] [US1] Extend `frontend/tests/integration/searchResultsFlow.test.tsx`: selecting multiple format values and applying re-runs the search with a single comma-joined `format` value containing all selections (Acceptance Scenario 3); a results URL containing one valid and one invalid comma-separated format value (e.g. `format=Vinyl,NotARealFormat`) loads without error, keeps only "Vinyl" as active, and excludes the invalid value from the request (Edge Cases, FR-010); deselecting all formats and applying removes `format` from both the request and the URL (Acceptance Scenario 4) — replaces feature 021's single-string format cases
- [X] T007 [US1] Update `e2e/tests/search-result-filters.spec.ts`: replace the existing US2 (feature 021) interaction `page.getByLabel(/^format$/i).fill('Vinyl')` — which assumes a free-text Format input that no longer exists — with the new modal-checkbox flow (open the Format trigger, check "Vinyl", close the modal); add a new case covering quickstart Scenario 1 (check two formats, e.g. Vinyl and CD, apply, confirm results narrow to releases matching all of them together)

### Implementation for User Story 1

- [X] T008 [P] [US1] Create `frontend/src/constants/formatOptions.ts` exporting the static `FORMAT_OPTIONS: readonly string[]` list of the ~33 canonical Discogs format names (per `data-model.md`); this array's declared order is the canonical order referenced by T003/T005/T012 (depends on T003/T005/T006 referencing it and failing first)
- [X] T009 [P] [US1] Create `frontend/src/components/ui/Checkbox.tsx`: a labeled checkbox atom following `Input.tsx`'s conventions (Tailwind v4 utilities, dark-mode support, `id`/`label`/`checked`/`onChange` props) (depends on T002 failing first)
- [X] T010 [US1] Update `frontend/src/hooks/useSearchQueryParams.ts`: change `SearchFilters.format` to `string[]`; parsing splits the URL's comma-joined `format` value, trims each part, keeps only values present in `FORMAT_OPTIONS`, and re-orders the kept values to match `FORMAT_OPTIONS`' canonical order; building joins the array back with `,` in that same canonical order, omitting the param when the array is empty (depends on T003 failing first, and T008)
- [X] T011 [US1] Update `frontend/src/services/discogsApi.ts`'s `search()`: encode `filters.format` (now `string[]`) by joining with `,` into the `format` query param, replacing the generic `value.trim()` loop (which assumed every filter value is a plain string) with per-key handling for the array-valued `format` filter (depends on T004/T006 failing first, and T010)
- [X] T012 [US1] Rewrite the Format field in `frontend/src/components/SearchFiltersControl.tsx`: replace the `Input` with a trigger `Button` (label reflects selection count) that opens a `Modal` containing a scrollable list of `Checkbox` (T009) entries for every `FORMAT_OPTIONS` (T008) value, rendered in `FORMAT_OPTIONS`' canonical order; toggling a checkbox updates the control's local pending format selection immediately and MUST NOT call `onApply` (FR-008) — only the existing outer "Apply filters" button does; "Clear filters" resets the selection to empty (depends on T005 failing first, and T008–T010)
- [X] T013 [US1] Update the active-filter summary/empty-results message in `frontend/src/pages/SearchResultsPage.tsx` to render the Format filter's active value as a comma-joined list of selected labels (e.g. "Vinyl, CD") instead of a single string (depends on T006 failing first, and T010)
- [X] T014 [US1] Manually verify Discogs' actual `/database/search?format=A,B`-style comma-joined matching behavior against the real Discogs API (using `DISCOGS_TOKEN`, outside the mocked/stubbed test suites) before treating User Story 1 as production-ready; record the observed behavior in `specs/022-search-filter-refinements/research.md`. **Outcome**: comma-joined values do NOT yield OR-matching — verified AND-matching instead (`format=Vinyl` alone: 868 items; `format=CD` alone: 1756 items; `format=Vinyl,CD` combined: 14 items, each available in both formats). Per an explicit decision (user chose "Accept AND semantics, update spec" over the per-value-merge fallback), the fallback was NOT implemented; instead `spec.md`, `research.md`, `plan.md`, `quickstart.md`, and `contracts/discogs-search-filters-api.md` were all updated to describe AND semantics as the real, final, accepted behavior (depends on T011 and T012)

**Checkpoint**: Format multi-select (AND-matching — verified against live Discogs and accepted as final behavior in T014 — URL persistence, obsolete-value handling) is fully functional and independently testable — the Artist field still exists at this point; it is removed next in User Story 2.

---

## Phase 4: User Story 2 - Artist filter is removed (Priority: P2)

**Goal**: The search filter control no longer exposes an Artist field; old bookmarked/shared links carrying an obsolete `artist` value load normally with the value silently ignored.

**Independent Test**: Open the search filter control and confirm no Artist field is present, while the main search query box continues to work unaffected; load an old link with `artist=...` and confirm it loads without error (quickstart Scenario 2).

### Tests for User Story 2

- [X] T015 [P] [US2] Extend `backend/tests/contract/discogsSearch.contract.test.ts`: a request including `artist=Nirvana` does NOT forward `artist` to the outbound Discogs request — replaces the feature-021 case that asserted `artist` forwarding
- [X] T016 [P] [US2] Extend `frontend/tests/unit/useSearchQueryParams.test.tsx`: `useSearchQueryParams` no longer returns an `artist` key even when `?artist=Nirvana` is present in the URL; `buildSearchPath` no longer accepts/encodes an `artist` filter — replaces the feature-021 artist parse/build cases
- [X] T017 [P] [US2] Extend `frontend/tests/unit/SearchFiltersControl.test.tsx`: no Artist field is rendered (`queryByLabelText('Artist')` is null) — replaces the feature-021 "renders four fields including Artist" assertion
- [X] T018 [P] [US2] Extend `frontend/tests/integration/searchResultsFlow.test.tsx`: a results URL carrying an obsolete `artist=Nirvana` param (alongside a still-valid `genre=Rock`) loads without error, omits `artist` from the search request, and does not display Artist among the active filters (Acceptance Scenario 2, FR-009)
- [X] T019 [US2] Extend `e2e/tests/search-result-filters.spec.ts` (Constitution Dev Workflow e2e gate): a new case driving the real UI to confirm no Artist field is ever rendered in the filter control, and that navigating directly to a URL with an obsolete `artist` param (plus a valid `genre` param) loads without error while the genre filter remains active and visible (quickstart Scenario 2)

### Implementation for User Story 2

- [X] T020 [US2] Remove `artist` from `SearchCatalogOptions`, the cache-key construction, and the outbound request `params` in `backend/src/discogs/discogsClient.ts` (depends on T015 failing first)
- [X] T021 [US2] Remove `'artist'` from `FILTER_PARAM_NAMES` in `backend/src/routes/discogs.ts` (depends on T015 failing first, and T020)
- [X] T022 [US2] Remove `artist` from the `SearchFilters` interface and `FILTER_PARAM_NAMES` in `frontend/src/hooks/useSearchQueryParams.ts` (depends on T016 failing first)
- [X] T023 [US2] Remove the Artist `Input` field (and its `fields`/`EMPTY_FIELDS`/trim-loop entries) from `frontend/src/components/SearchFiltersControl.tsx` (depends on T017 failing first, and T012's Format rewrite from User Story 1)
- [X] T024 [US2] Remove the Artist entry from the active-filter summary/`FILTER_LABELS` in `frontend/src/pages/SearchResultsPage.tsx` (depends on T018 failing first, and T022)

**Checkpoint**: Artist is fully retired from both layers; old links carrying it load cleanly. Combined with User Story 1, the filter control now shows only Genre, Style, and the Format multi-select.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Release hygiene required by the constitution, plus final end-to-end validation

- [X] T025 [P] Add a backend changelog entry and bump `backend/package.json`'s version (MINOR) in `backend/CHANGELOG.md` and `backend/package.json`; the entry text MUST state the classification rationale explicitly: `artist` query param retired (old requests carrying it no longer error, the filter is simply inert — no API contract error introduced) and `format` gains comma-joined multi-value passthrough
- [X] T026 [P] Add a frontend changelog entry and bump `frontend/package.json`'s version (MINOR) in `frontend/CHANGELOG.md` and `frontend/package.json`; the entry text MUST state: Artist filter field removed from the UI, and the Format filter is now a fixed multi-select instead of free text
- [X] T027 Run the full quickstart validation flow from `specs/022-search-filter-refinements/quickstart.md` (backend contract suite, frontend unit + integration suites, and the updated `search-result-filters.spec.ts` e2e spec); explicitly confirm the pre-existing Genre/Style test cases carried over from feature 021 within these suites still pass unmodified, as the closing verification for FR-006

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 must complete (and pass) before any change lands
- **Foundational (Phase 2)**: No tasks — proceeds directly to User Story 1
- **User Story 1 (Phase 3)**: Depends on Setup; T002–T007 must be written and observed failing before T008–T013 are considered complete; T014 (live verification) closes out the phase after T011/T012 land
- **User Story 2 (Phase 4)**: Depends on Setup; benefits from User Story 1 being complete first (T023 edits the same `SearchFiltersControl.tsx` file T012 rewrote) but is independently testable against its own contract (Artist absence, obsolete-link handling)
- **Polish (Phase 5)**: Depends on both user stories being complete

### Within Each Phase

- Tests MUST be written and observed failing before their paired implementation tasks are considered complete (Constitution Principle I); note that T003/T005/T006 reference `FORMAT_OPTIONS`/`Checkbox` before they exist (T008/T009), so their initial "failing" state includes compile/import failures — this is an acceptable red state
- Within Phase 3: T008 ∥ T009 (different new files) before T010–T013; T010 before T011 and T012; T012 depends on T008–T010; T013 depends on T010; T014 depends on T011 and T012
- Within Phase 4: T020 depends on T015; T021 depends on T020; T022 depends on T016; T023 depends on T017 and T012; T024 depends on T018 and T022

### Parallel Opportunities

- Phase 3: T002 ∥ T003 ∥ T004 ∥ T005 ∥ T006 (tests, different files) before implementation; T008 ∥ T009 (implementation, different new files)
- Phase 4: T015 ∥ T016 ∥ T017 ∥ T018 (tests, different files) before implementation
- Phase 5: T025 ∥ T026 before T027

---

## Parallel Example: User Story 1

```bash
# Red tests in parallel
Task: "Create frontend/tests/unit/components/ui/Checkbox.test.tsx"
Task: "Extend frontend/tests/unit/useSearchQueryParams.test.tsx with format-array cases"
Task: "Extend backend/tests/contract/discogsSearch.contract.test.ts with comma-joined format case"
Task: "Extend frontend/tests/unit/SearchFiltersControl.test.tsx with format-modal cases"
Task: "Extend frontend/tests/integration/searchResultsFlow.test.tsx with multi-format scenarios"

# Implementation, parallel where files differ, then sequential
Task: "Create frontend/src/constants/formatOptions.ts"
Task: "Create frontend/src/components/ui/Checkbox.tsx"
# Then, once both land:
Task: "Update useSearchQueryParams.ts for format: string[]"
Task: "Update discogsApi.ts search() to join format array"
Task: "Rewrite Format field in SearchFiltersControl.tsx"
Task: "Update active-filter summary in SearchResultsPage.tsx"
# Then, once the real request/UI path works:
Task: "Manually verify Discogs' comma-joined format matching behavior"
```

## Parallel Example: User Story 2

```bash
# Red tests in parallel
Task: "Extend backend/tests/contract/discogsSearch.contract.test.ts to assert artist is dropped"
Task: "Extend frontend/tests/unit/useSearchQueryParams.test.tsx to assert artist is dropped"
Task: "Extend frontend/tests/unit/SearchFiltersControl.test.tsx to assert no Artist field"
Task: "Extend frontend/tests/integration/searchResultsFlow.test.tsx for obsolete artist links"
# (e2e case, T019, follows once the unit/integration red tests exist)

# Implementation, sequential (each touches a file another task already modified)
Task: "Remove artist from discogsClient.ts"
Task: "Remove artist from routes/discogs.ts FILTER_PARAM_NAMES"
Task: "Remove artist from useSearchQueryParams.ts"
Task: "Remove Artist field from SearchFiltersControl.tsx"
Task: "Remove Artist from FILTER_LABELS in SearchResultsPage.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1 (format multi-select works; Artist field still present)
3. **Stop and validate**: confirm multi-format AND-matching, URL persistence, and obsolete-value handling all work, including the live Discogs verification (T014)
4. Deploy/demo if ready — this alone delivers the feature's primary value

### Incremental Delivery

1. Setup → baseline confirmed
2. Add User Story 1 → format multi-select works, verified against real Discogs → validate → deploy/demo (MVP)
3. Add User Story 2 → Artist field fully retired, e2e-verified → validate → deploy/demo
4. Polish → changelogs (with explicit rationale), version bumps, full quickstart run including FR-006 regression check

---

## Notes

- `[P]` tasks touch different files and have no unfinished dependency between them
- Because the constitution requires Test-First, do not treat T008–T014 or T020–T024 as started until their paired tests (T002–T007, T015–T019 respectively) exist and fail
- `frontend/src/queries/discogsQueries.ts` needs no code change: it already forwards the `filters` object generically into both the query key and `discogsApi.search(...)`, and TanStack Query's key hashing handles the now-array-valued `format` field transparently
- The backend's `format` passthrough (`discogsClient.ts`) needs no code change for User Story 1 beyond the contract test (T004) confirming existing behavior already forwards an arbitrary string — including a comma-joined one — unchanged
- Format values are consistently ordered per `FORMAT_OPTIONS`' declared order end-to-end (URL serialization, checkbox rendering, active-filter display) to keep round-trip behavior (FR-007/SC-003) deterministic and tests non-flaky
- No changes to Genre/Style handling, pagination, rating enrichment, `ReleasePreviewModal`, `SearchResultCard`, or `HeaderSearchBox` — out of scope per spec.md Assumptions

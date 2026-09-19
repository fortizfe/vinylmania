# Implementation Plan: "My Library" Redesign — Sorting, Infinite Scroll, WCAG 2.1 AA & Apple HIG

**Branch**: `068-library-redesign-sort-scroll` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/068-library-redesign-sort-scroll/spec.md`

## Summary

Two slices on the existing library domain, **no new dependencies**:

1. **Backend (US1; FR-001–FR-007)**:
   - `GET /api/library` gains `sort`/`dir`. The use case collapses to a single path: full mirror → filter → sort → slice, and the Firestore offset query `repository.listEntries` is deleted.
   - A pure domain comparator in `domain/library/librarySort.ts` uses `Intl.Collator`, strips one leading article, puts missing keys last and ends every tie-break on `id`.
   - The album `title` is persisted by the existing Discogs collection sync next to `primaryArtist`, with zero extra requests or writes.
   - The response shape is unchanged, apart from an additive `title`.
2. **Frontend (US1–US4; FR-006–FR-029)**:
   - The Library list moves to `useInfiniteQuery` (Search's pattern) with a sentinel that has a 300 px margin, plus in-list skeletons, an end message, and an alert with Retry.
   - Sort lives in the URL, and record links carry the return path through router state.
   - The new `LibraryToolbar` renders a translucent floating capsule and bottom sheet below 640 px, and a sticky translucent toolbar with a native `<select>` and a Filters side drawer from 640 px up.
   - The bottom sheet is a new `bottom` variant of the existing `Overlay`/`Sheet`/`Modal` stack.
   - On Library only, filters apply live through one new `live` prop on the shared `FiltersControl`, which renders the facets as native `<details>` lists.
   - One polite status region announces every change.

Decision log: [research.md](./research.md) D1–D22. Data and ordering rules: [data-model.md](./data-model.md). Contracts: [library-list-api.md](./contracts/library-list-api.md), [library-ui.md](./contracts/library-ui.md). Validation: [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**:
- Backend: TypeScript 5.6 on Node (Vercel function).
- Frontend: TypeScript 6.0, React 19, Vite 8.

**Primary Dependencies**:
- Backend: `express`, `firebase-admin` (adapter only), `zod` (unused here).
- Frontend: `@tanstack/react-query` 5, `react-router-dom` 6, Tailwind CSS v4, `clsx`, `motion` 12 (only through `frontend/src/motion/`).
- Stdlib: `Intl.Collator` (full ICU in Node and in browsers).
- **No new dependencies.**

**Storage**:
- Firestore `users/{uid}/libraryEntries`: **additive** optional `title`, backfilled by the next sync, with no migration script (data-model §1).
- Redis sync marker unchanged.

**Testing**:
- Backend: Jest, with the Firebase emulator for contract and integration tests (`backend/tests/{unit,contract,integration}/library`).
- Frontend: Vitest + RTL (`frontend/tests/{unit,integration}`).
- e2e: Playwright (chromium + webkit) + `@axe-core/playwright` (`e2e/tests`).

**Target Platform**: Evergreen browsers from 360 px phones (with safe-area insets) to wide desktop. Backend runs as a Vercel serverless function.

**Project Type**: Web application (backend + frontend).

**Performance Goals**:
- New sort data is painted in under 100 ms (SC-002).
- CLS is 0 while batches load (SC-001).
- The next batch requests 300 px before the end (SC-008).
- Per request: one `listAllEntries` read of the whole mirror, plus an O(n log n) sort with n ≈ a few hundred.

**Constraints**:
- WCAG 2.1 AA, including over translucent material. The contrast floors were computed for the worst-case backdrop (research D17).
- Reduced motion, reduced transparency and increased contrast are all honoured.
- Every touch target is at least 44 px.
- Search's filter behaviour must not change.

**Scale/Scope**:
- Collections of a few hundred records per user (spec 038 assumption).
- 1 screen redesigned, and 1 detail page return path changed.
- 7 backend source files touched, 1 of them new.
- 16 frontend source files touched (plus `motion/README.md`), 2 of them new.

No NEEDS CLARIFICATION remains: clarify Q1–Q5 fixed the open structure, and research.md resolves every plan-level choice.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Result |
|---|---|---|
| I Test-First | Each story's Tests block (unit, flow **and** e2e) is written, seen failing and **reviewed/approved by the developer or reviewer** before its Implementation block starts; tasks.md has an explicit approval checkpoint per story, and the polish audit checks it. Named tests: domain sort table, use-case slicing, contract cases, hook/URL, toolbar RTL, flows, e2e. | PASS |
| II Discogs | `title` comes from the collection walk the sync already performs (`basic_information`). No new Discogs request, and no hand-curated catalog data. | PASS |
| III YAGNI/KISS | 0 new deps. 3 new source files, each justified below. 1 port method deleted. Reuses the `Intl.Collator`, native `<select>`/radio/`<details>`, Search's infinite query and `state.from` patterns, `Overlay`/`Sheet`/`Modal`, `pressable`, `focusRing` and the motion tokens. Cut: multi-detent sheet, reorder animation (FR-022), creation-time facet write (D5), shared sentinel hook (D9), request cancellation (FR-015 via per-key cache). | PASS |
| IV SOLID | Ordering is a pure domain function (single reason to change). The port shrinks (Interface Segregation). `FiltersControl` is extended with one opt-in prop without changing the default path (Open/Closed). | PASS |
| V Observability | The `/api/library` success log adds `sort`, `dir`, `page`, `totalItems` (D7). | PASS |
| VI Versioning | New optional query params and an additive response field → **MINOR**. Firestore field is additive, with sync-driven backfill. | PASS |
| Additional Constraints: reversible migration script | **Documented deviation**: there is no migration script for the new Firestore `title` field. Rationale: the field is additive and optional; the existing Discogs collection sync writes it (the backfill); readers treat its absence as "missing, sorts last"; rollback = ignore the field (no reader breaks, nothing to revert). Precedent: features 038 (`genre/style/format`) and 061 (`year/label/primaryArtist`, `specs/061-*/data-model.md` "Additive & backfilled … No migration"). Recorded in the PR description per Development Workflow ("any deviation … documented with rationale"). | PASS (justified) |
| VII Ratings/News | Not touched. | N/A |
| VIII Hexagonal | Comparator in `domain/library/`; orchestration in `application/library/listLibraryEntries.ts`; HTTP parsing in the route adapter; Firestore only in `adapters/library/`. No SDK import outside adapters. | PASS |
| IX Frontend → backend only | The only network call is `/api/library` through `authorizedFetch`. Covers load as passive `<img>` (out of scope). | PASS |
| X WCAG 2.1 AA | Native controls first. The names/roles/states table (library-ui §4), the announcement table (§5), and keyboard, focus-return and scroll-padding rules. The contrast table was computed against the worst case, with opaque fallbacks. axe runs in every state and theme. | PASS |
| XI Apple design | `apple-design`, `emil-design-eng` and `animate` were consulted. Decisions are recorded in D15–D20: material, symmetric sheet path on the existing spring tokens, and "no motion" where the gate rejects it. | PASS |
| UI Design System | Tailwind utilities first. Justified custom CSS is limited to the `.chrome-material` fallback blocks (same precedent as `.overlay-scrim`). **Values outside the default scale** (documented exceptions): `--capsule-clearance` is declared in `:root`, not `@theme`, because it contains `env()` (precedent `--header-h`); `bottom-[calc(1rem+env(safe-area-inset-bottom))]`, `pb-[env(safe-area-inset-bottom)]` and `max-h-[85dvh]` are arbitrary values because `env()` and `dvh` cannot be theme tokens (precedent `max-h-[90vh]` in `motion/Overlay.tsx`). Skeletons mirror the cards. `shadow-lg` is only on the floating bar in its capsule form. Stone palette with `surface` tokens in dark mode. | PASS |
| Workflow: e2e | New `library-sort-scroll` and `library-toolbar` specs. 7 existing specs updated (D22): Library-overlay cases move to the Library drawer; the centred-Modal / CollapsibleFilterPanel cases in `motion-performance`, `dark-mode-contrast` and `reduced-motion` move to `/app/search`. The e2e specs are written in each story's Tests block, before the code. | PASS |

**Post-design re-check** (after data-model, contracts and quickstart): no new violations. The one deliberate cost, a full-mirror read per batch, is inside the "few hundred records" assumption and is recorded as a `ponytail:` ceiling in D3. **Gate: PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/068-library-redesign-sort-scroll/
├── plan.md              # This file
├── research.md          # D1–D22 decisions (+ design-skill conclusions, contrast table)
├── data-model.md        # LibraryEntry.title, LibrarySort, ordering, view state, URL transitions
├── quickstart.md        # Backend / Vitest / Playwright validation scenarios
├── contracts/
│   ├── library-list-api.md   # GET /api/library diff (sort, dir, title)
│   └── library-ui.md         # URL params, sort options, layout, a11y names/roles/states, announcements
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
backend/src/
├── domain/library/
│   ├── types.ts                         # CHANGE: LibraryEntry.title?; LibrarySort + DEFAULT_LIBRARY_SORT; drop PaginatedLibraryEntries if unused (D3)
│   └── librarySort.ts                   # NEW (D1, D2): normaliseSortKey + sortLibraryEntries — pure rule, sibling of libraryFilters.ts
├── application/library/
│   ├── listLibraryEntries.ts            # CHANGE: single path listAll → filter → sort → slice; takes `sort` (D3)
│   └── syncLibrary.ts                   # CHANGE: collectionFacets adds non-empty `title` (D4)
├── ports/library/libraryRepositoryPort.ts   # CHANGE: − listEntries; persistCollectionFacets facets + title
└── adapters/library/
    ├── firestoreLibraryRepository.ts    # CHANGE: − listEntries; toLibraryEntry + persistCollectionFacets map `title`
    └── libraryRoutes.ts                 # CHANGE: parseLibrarySort (silent defaults, D6); pass sort; log meta (D7)

backend/tests/
├── unit/library/domain/librarySort.test.ts               # NEW
├── unit/library/application/listLibraryEntries.test.ts   # NEW
├── unit/library/syncLibrary.facets.test.ts               # CHANGE: title; drop listEntries stub
├── unit/library/application/{syncLibrary,createLibraryEntry,enrichLibraryEntry}.test.ts  # CHANGE: drop listEntries stub
├── unit/collectionStats/application/getCollectionStatistics.test.ts  # CHANGE: drop listEntries stub
├── contract/library/library.contract.test.ts             # CHANGE: 7 sort cases (contract §tests)
└── integration/library/adapters/firestoreLibraryRepository.integration.test.ts  # CHANGE: title round-trip

frontend/src/
├── constants/librarySortOptions.ts      # NEW (D14): the 6 options (value, group, label, announcement) — shared by select, radios, URL parser, announcer
├── hooks/useLibraryQueryParams.ts       # CHANGE: − page, + sort; buildLibraryPath(filters, sort) (D12)
├── services/libraryApi.ts               # CHANGE: list(…, sort) sends sort/dir
├── queries/libraryQueries.ts            # CHANGE: keys without page; useLibraryList → useInfiniteQuery; useRefreshLibrary resets to page 1 (D8, D10)
├── pages/LibraryListPage.tsx            # CHANGE: header (count, Refresh), infinite list + in-list skeletons, 300 px sentinel, end/retry, status announcer, scroll-padding effect, currentLibraryPath → from (D9, D18, D20, D21)
├── pages/RecordDetailPage.tsx           # CHANGE: backTo = state.from ?? '/app/library' for BackLinks, backTo, post-delete navigate (D12)
├── components/LibraryToolbar.tsx        # NEW (D15): ONE bar element (capsule < sm, sticky toolbar ≥ sm; ViewModeToggle mounted once) + one Modal (bottom | end) with sort radios + <FiltersControl live>; closes on breakpoint change
├── components/FiltersControl.tsx        # CHANGE: `live` prop — no collapsible/form/Apply, onApply per change, inline facets, "Clear all filters" (D13)
├── components/filters/SelectableListFilter.tsx  # CHANGE: `inline` prop → <details><summary> + same search/checkbox list (D13)
├── components/RecordCard.tsx, components/RecordListRow.tsx  # CHANGE: required `from` → Link state (Library-only components) (D12)
├── components/ui/ViewModeToggle.tsx     # CHANGE: opaque track bg-white dark:bg-surface (D17)
├── components/ui/Modal.tsx              # CHANGE: position 'bottom' → Sheet dismissAxis="y" (D16)
├── motion/Overlay.tsx                   # CHANGE: variant 'bottom' (layout + y spring) (D16)
├── motion/Sheet.tsx                     # CHANGE: variant derived from dismissAxis (D16)
├── motion/README.md                     # CHANGE: document `bottom` variant + chrome material
└── styles/global.css                    # CHANGE: --capsule-clearance; .chrome-material @supports / reduced-transparency / contrast fallbacks (D17, D18)

frontend/tests/
├── unit/LibraryToolbar.test.tsx                 # NEW
├── unit/hooks/useLibraryQueryParams.test.tsx    # CHANGE
├── unit/queries/libraryQueries.test.tsx         # CHANGE
├── unit/FiltersControl.test.tsx, unit/filters/SelectableListFilter.test.tsx  # CHANGE: live / inline
├── unit/motion/Overlay.test.tsx, unit/motion/Sheet.test.tsx, unit/ui/Modal.test.tsx  # CHANGE: bottom variant / position
├── unit/RecordCard.test.tsx, unit/RecordListRow.test.tsx, unit/ViewModeToggle.test.tsx  # CHANGE
└── integration/libraryListFlow.test.tsx, integration/recordDetailFlow.test.tsx  # CHANGE

e2e/tests/
├── library-sort-scroll.spec.ts          # NEW: global order ×6, deep link, prefetch, tall screen, retry, back nav, CLS, paint < 100 ms
├── library-toolbar.spec.ts              # NEW: capsule/sheet/toolbar/drawer, 44 px, keyboard walk, axe matrix, material contrast, reduced motion
└── library-list-responsive, library-filters, reduced-motion, overlay-focus-management, overlay-contrast, motion-performance, dark-mode-contrast .spec.ts  # CHANGE (D22)
```

**Structure Decision**: The feature uses the existing per-domain folders: backend `{domain,application,ports,adapters}/library`, and frontend `pages/`, `components/`, `hooks/`, `queries/`, `motion/`. Three new source files, each justified:
- `librarySort.ts`: a domain rule that needs its own unit table.
- `librarySortOptions.ts`: one source for the 6 options used in 4 places.
- `LibraryToolbar.tsx`: owns both responsive control layouts and the panel.

Nothing else is new. One port method is deleted (`listEntries`).

### Implementation notes for agents (pinned decisions; do not redesign)

- **Agents**: `backend-agent` owns `backend/**`. `frontend-agent` owns `frontend/**`. `qa-agent` owns `e2e/**` and TDD review. `docs-agent` has no end-user doc change beyond an optional FAQ line.
- **Order**: backend `librarySort` + `listLibraryEntries` + the route and contract tests land first. The frontend depends only on the API contract, so it can start in parallel against mocks.
- Bar spacing (one element): capsule form `p-2 gap-2 rounded-full`; toolbar form (`sm:`) `h-15 px-3 gap-3 rounded-2xl`.
- Stacking: the bar at `z-30` (header `z-40`, overlays `z-50`).
- Motion: no new motion token and no new animation beyond the sheet variant (D19).
- `ponytail:` markers to leave in code:
  - D3, full-mirror read per batch, in `listLibraryEntries.ts`;
  - D9, duplicated sentinel effect, in `LibraryListPage.tsx`;
  - D11, all-pages refetch after mutations, in `libraryQueries.ts`.

## Complexity Tracking

No violations; nothing to justify.

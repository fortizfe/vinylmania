# Implementation Plan: Vinyl Search Results — Cards, Actions & Pagination

**Branch**: `006-vinyl-search-results` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-vinyl-search-results/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace the plain text list of Discogs search results on the existing
add-record screen with a responsive grid of cards (cover thumbnail, title,
artist, year, format), each offering an "add to library" action and a
"preview details" action via a shared card-actions component. Results are
paginated using Discogs' own server-side pagination (already supported by the
backend's `searchCatalog`, just not yet wired to the route), so no full
result set is fetched or held in memory at once. The preview action opens a
new reusable `Modal` overlay showing the release's fuller details, backed by a
new backend endpoint that exposes the existing (but not yet public)
`getRelease()` catalog lookup. Adding a record no longer navigates away from
the search results.

## Technical Context

**Language/Version**: No change — backend TypeScript ~5.6 (Express), frontend
TypeScript ~6.0 (React 19, Vite, Tailwind v4)

**Primary Dependencies**: No new dependency on either side. Backend reuses
existing `discogsClient.getRelease`/`searchCatalog`, `zod`, `axios`. Frontend
adds one new shared atomic component (`Modal`) built with Tailwind utilities
only, and hand-rolled inline SVG icons for the two card actions (add,
preview) rather than pulling in an icon library — two icons don't justify a
new dependency (Principle III).

**Storage**: N/A — search results are not persisted; the add action still
goes through the existing `POST /api/library` endpoint unchanged.

**Testing**: Backend — Jest + Supertest + `nock` contract tests (existing
pattern in `backend/tests/contract/`), extended for the updated
`/api/discogs/search` (pagination pass-through, parsed `artist`) and the new
`/api/discogs/releases/:id` endpoint. Frontend — Vitest + React Testing
Library, new unit tests for the new components and updated integration tests
for the add-record flow.

**Target Platform**: Web browser; existing Express API (now deployed as its
own Vercel project per feature 005) and Vite/React frontend. No deployment
topology change.

**Project Type**: Web application — changes are confined to the existing
`backend/` and `frontend/` directories; no new top-level directory.

**Performance Goals**: Page navigation and the preview overlay must feel
immediate — a skeleton grid (reusing the `Skeleton` primitive from feature
004) while a page's results are loading, no blank screen; the preview modal
opens as soon as its data resolves, with its own loading state if the fetch
is still pending.

**Constraints**: Must follow the constitution's UI Design System rules
(Tailwind v4 utilities, reuse `Card`/`Button`/`Badge`/`Avatar`/`Skeleton`
before introducing anything new, dark-mode support, no layout shift between
loading/loaded states); Test-First — contract tests for the new/changed
backend routes and unit tests for new frontend components MUST exist and
fail before implementation; MUST NOT change the existing `/api/library`
contract or any existing route path; MUST NOT regress the existing
add-record integration test's core flow (search → add → record appears in
library), even though its assertions change to match the new UI.

**Scale/Scope**: 1 new backend route (`GET /api/discogs/releases/:id`), 2
small backend changes (route now passes `page`/`perPage` through; mapper now
parses `artist` out of the combined Discogs title), ~4 new frontend
components (`SearchResultCard`, `ResultCardActions`, `Modal`,
`ReleasePreviewModal`), 1 rewired page (`AddRecordPage`), 1 extended service
(`discogsApi.ts`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Section | Requirement | This feature's compliance |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Tests before implementation | New/changed backend routes get contract tests first (extending the existing `nock`+`supertest` pattern); new frontend components get Vitest+RTL unit tests first; existing add-record integration test is updated alongside the UI it covers |
| II. Library-First & Modularity | Self-contained modules, single purpose | `Modal` is a generic, reusable overlay primitive (no release-specific knowledge); `ResultCardActions` only renders the two actions and delegates behavior via props; `ReleasePreviewModal` is the only piece that knows how to render a `Release` inside a `Modal` |
| III. Simplicity, YAGNI & KISS | Simplest design for the stated requirement | No new npm dependency on either side; pagination reuses Discogs' existing server-side paging instead of building a client-side virtualized list; icons are inline SVG, not a new icon-library dependency |
| IV. SOLID Design | Single responsibility, no leaking internals | `SearchResultCard` only renders one result's data + the actions component; it does not know how "add" or "preview" are implemented, only that it calls the callbacks it's given |
| V. Observability | Structured logs for key operations | The new `/api/discogs/releases/:id` route logs success/not-found/error the same way the existing `/api/discogs/search` route does |
| VI. Versioning & Breaking Changes | Breaking changes documented | `/api/discogs/search`'s response gains an additional optional `artist` field on each result (backward compatible — additive) and starts honoring `page`/`perPage` query params it previously ignored (backward compatible — old callers omitting them get today's defaults); `/api/discogs/releases/:id` is a new, additive route. No MAJOR change. |
| Technology Stack — Vinyl Data Source | All catalog metadata MUST come from Discogs | The new preview endpoint and the parsed `artist` field both come from Discogs data already being fetched — no hand-authored catalog metadata is introduced |
| UI Design System & Styling (Tailwind v4) | Card-based layout, reusable atomics, skeleton loading, no layout shift, dark mode, v4 naming | `SearchResultCard` is built on the existing `Card`; the results grid shows `Skeleton`-based placeholders while a page loads; the new `Modal` supports dark mode via the same `dark:` convention as every other atomic component |
| Development Workflow | Conventional Commits; PR review | Followed at commit time; not a design-time gate |

**Result**: PASS — no violations requiring Complexity Tracking.

**Post-Design Re-check** (after Phase 1 data-model.md/contracts/quickstart.md):
Design confirmed no new dependency, cross-project coupling, or deviation
beyond what this table already covers (the new `Modal` atomic component, the
additive `/api/discogs/releases/:id` endpoint, and the additive `artist`
field/`page`/`perPage` pass-through on `/api/discogs/search`). Gate remains
**PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/006-vinyl-search-results/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── discogs/
│   │   ├── discogsClient.ts      # Unchanged — searchCatalog/getRelease already support what's needed
│   │   ├── discogsMapper.ts      # CHANGED: mapSearchResult now also parses `artist`
│   │   └── types.ts              # CHANGED: CatalogSearchResult gains optional `artist`
│   └── routes/
│       └── discogs.ts            # CHANGED: /search now passes page/perPage through;
│                                  # NEW: GET /releases/:id (preview endpoint)
└── tests/
    └── contract/
        ├── discogsSearch.contract.test.ts    # CHANGED: pagination + artist assertions
        └── discogsRelease.contract.test.ts   # NEW: preview endpoint contract test

frontend/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   └── Modal.tsx                # NEW: generic overlay atomic component
│   │   ├── SearchResultCard.tsx         # NEW: one search result as a card
│   │   ├── SearchResultCardSkeleton.tsx # NEW: matching skeleton (feature 004 pattern)
│   │   ├── ResultCardActions.tsx        # NEW: the "botonera" — add + preview icon actions
│   │   └── ReleasePreviewModal.tsx      # NEW: Modal + full release details
│   ├── pages/
│   │   └── AddRecordPage.tsx            # CHANGED: results now render as a paginated card grid
│   └── services/
│       └── discogsApi.ts                # CHANGED: search() takes page/perPage, adds getRelease()
└── tests/
    ├── unit/
    │   ├── SearchResultCard.test.tsx        # NEW
    │   └── ui/Modal.test.tsx                # NEW
    └── integration/
        └── addRecordFlow.test.tsx           # CHANGED: assertions updated for card grid + no
                                              # auto-navigation after add
```

**Structure Decision**: No new top-level directory. This feature extends the
existing `backend/src/discogs/` and `backend/src/routes/discogs.ts` (both
already own catalog-search concerns) and the existing `frontend/src/pages/AddRecordPage.tsx`
flow, adding new presentational components under `frontend/src/components/`
(one new shared atomic component, `Modal`, under `components/ui/`) rather than
introducing a separate "search" module — this is still the same add-record
feature area, just with a richer results presentation.

## Complexity Tracking

*No violations — table intentionally omitted.*

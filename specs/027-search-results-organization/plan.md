# Implementation Plan: Search Results Organization

**Branch**: `027-search-results-organization` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-search-results-organization/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Three coordinated UX changes to the search results experience: (1) the shared `AppHeader` becomes sticky (`position: sticky; top: 0`) across every authenticated page instead of scrolling away with content; (2) `SearchResultsPage` replaces its Previous/Next pagination with infinite scroll, implemented via TanStack Query's `useInfiniteQuery` and an `IntersectionObserver` sentinel, keeping the existing 20-results-per-page size and Discogs request shape; (3) the backend `/api/discogs/search` route reorders each page's response so `master` results precede `release` results (using the `releaseResults`/`masterResults` split it already computes for logging), and `SearchResultCard` stops rendering the format badge for master results. No new dependencies, no data model changes, no additional Discogs API calls — ordering and pagination stay within the existing per-page request/response shape (per clarifications: best-effort per-batch ordering, unchanged batch size).

## Technical Context

**Language/Version**: TypeScript (frontend: TS ~6.0 strict, React 19; backend: TS ^5.6, Node.js/Express, CommonJS)

**Primary Dependencies**: React 19, React Router 6, `@tanstack/react-query` v5 (frontend — `useInfiniteQuery` replaces `useQuery` for search); Express 4, Axios-based Discogs client, `ioredis` cache-aside layer (backend, unchanged)

**Storage**: N/A for this feature — no schema or persisted-data changes; the existing Redis cache-aside layer in front of Discogs search responses is unaffected (ordering is applied in the route handler, after cache read, so cached entries remain the raw Discogs-shaped payload)

**Testing**: Vitest + React Testing Library (frontend unit/component), Jest + Supertest + Firebase emulator (backend route/integration), Playwright (`/e2e`, mandatory for frontend-affecting PRs per constitution)

**Target Platform**: Web browser (React SPA) + Node.js server (Express API), deployed to Vercel

**Project Type**: Web application (existing `frontend/` + `backend/` split)

**Performance Goals**: New batch of results visibly appended within ~2s of reaching the scroll trigger under normal network conditions (spec SC-003); no additional Discogs requests introduced by header or ordering changes

**Constraints**: No extra Discogs API calls to achieve stricter-than-per-batch master ordering (clarified); infinite-scroll batch size stays at 20 results (clarified, unchanged from today's `PAGE_SIZE`); sticky header must sit below the existing `Modal` overlay (`z-50`) in stacking order; no virtualization of accumulated result cards (YAGNI per constitution Principle III)

**Scale/Scope**: Touches `AppHeader.tsx` (1 component, app-wide effect), `SearchResultsPage.tsx` + a new fetch-more/infinite-scroll hook, `SearchResultCard.tsx` (1 conditional), and `backend/src/routes/discogs.ts` (reorder before responding); no new routes, no new entities

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First**: PASS (planned) — new/updated Vitest specs for `AppHeader` (sticky classes), `SearchResultsPage` (infinite-scroll fetch-more behavior, no pagination buttons), `SearchResultCard` (no format badge on masters); backend Jest test for `/api/discogs/search` asserting masters precede releases in the response; Playwright e2e coverage updated for the new scroll-driven flow. Tests MUST be written before implementation per Principle I.
- **II. Discogs Integration-First & Modularity**: PASS — no new data source; reuses `searchCatalog`'s existing `releaseResults`/`masterResults` split already computed in the route handler. No new Discogs requests are introduced (ordering is a client of the existing response, not a new query), preserving rate-limit-aware behavior.
- **III. Simplicity, YAGNI & KISS**: PASS — sticky header uses a single Tailwind utility change (`sticky top-0`), infinite scroll uses TanStack Query's built-in `useInfiniteQuery` (already a project dependency) plus a plain `IntersectionObserver`, no new pagination/virtualization library added. Master-first ordering reuses an array partition the route already computes.
- **IV. SOLID Design**: PASS — the reordering is confined to the route handler (single responsibility: response shaping), the fetch-more logic is isolated in the search results page/hook, and `SearchResultCard`'s existing `isGrouped` flag is extended (not duplicated) to also gate the format badge.
- **V. Observability**: PASS — existing structured logging in `/api/discogs/search` (release/master counts) is unaffected and continues to reflect the (now reordered) response composition.
- **VI. Versioning & Breaking Changes**: PASS — additive/behavioral change, not a breaking schema or contract change (response shape is identical; only element order and one optional badge's visibility change). Classified MINOR; `frontend/CHANGELOG.md` and `backend/CHANGELOG.md` entries + version bumps required per Development Workflow gates.
- **UI Design System (Tailwind v4)**: PASS (planned) — sticky header keeps its existing `border-b` styling and adds `bg-white dark:bg-gray-950` (matching the app's existing body background classes in `main.tsx`) so scrolled content doesn't show through; loading-more and end-of-results indicators reuse the existing skeleton/`Card` patterns rather than introducing spinners; no new custom CSS.
- **e2e coverage gate**: Existing `e2e/tests/search-result-filters.spec.ts` pattern will be extended/added to cover scrolling-triggered loading and the removal of pagination controls, per Development Workflow's mandatory e2e requirement for `/frontend` PRs.

No violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/027-search-results-organization/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── search-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── routes/
│   │   └── discogs.ts               # MODIFIED: reorder result.results (masters first) before res.json
│   └── discogs/
│       └── discogsClient.ts         # UNCHANGED: searchCatalog already returns per-page results
└── tests/
    └── routes/discogs.search.test.ts  # MODIFIED/NEW: assert masters precede releases per page

frontend/
├── src/
│   ├── components/
│   │   ├── AppHeader.tsx            # MODIFIED: sticky positioning
│   │   └── SearchResultCard.tsx     # MODIFIED: hide format badge when resultType === 'master'
│   ├── pages/
│   │   └── SearchResultsPage.tsx    # MODIFIED: infinite scroll replaces Previous/Next pagination
│   └── queries/
│       └── discogsQueries.ts        # MODIFIED: useCatalogSearch → useInfiniteQuery variant (or new hook)
└── tests/
    ├── components/AppHeader.test.tsx        # NEW/MODIFIED
    ├── components/SearchResultCard.test.tsx # MODIFIED
    └── pages/SearchResultsPage.test.tsx     # MODIFIED

e2e/
└── tests/
    └── search-result-filters.spec.ts  # MODIFIED, or a new sibling spec for scroll/ordering behavior
```

**Structure Decision**: Existing `backend/` + `frontend/` web application split (Option 2). This feature is a targeted modification of already-existing files in both packages — no new top-level directories, services, or packages are introduced.

## Complexity Tracking

> No Constitution Check violations — section intentionally left without entries.

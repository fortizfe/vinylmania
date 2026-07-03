# Implementation Plan: Vinyl Library CRUD

**Branch**: `003-vinyl-library-crud` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-vinyl-library-crud/spec.md`

## Summary

Let a signed-in collector manage a personal library of vinyl records: add a
record by searching the Discogs catalog (feature 002's client) and picking a
match, view the list and full detail of their own records, update personal
condition/notes, and remove a record — all scoped to the authenticated user
(feature 001's auth). Firestore persists only collector-specific fields
(Discogs release ID, date added, condition, notes); every catalog field
(title, artist, tracklist, images, …) is fetched live from Discogs and merged
in in the API response, never duplicated in storage. This is the first
feature to touch both `backend/` and `frontend/` together since feature 001.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (`backend/`); React 18
+ TypeScript 5.x (`frontend/`) — both existing projects, unchanged.

**Primary Dependencies**:
- Backend: existing `express`, `firebase-admin` (Firestore), and feature
  002's `axios`/`zod`-based Discogs client — no new backend dependency.
- Frontend: existing `react-router-dom`, `firebase` — no new frontend
  dependency.

**Storage**: Firestore, new subcollection `users/{uid}/libraryEntries/{entryId}`
— scoped under each user's existing profile document from feature 001. Fields
limited to `discogsReleaseId`, `addedAt`, `condition?`, `notes?` (see
data-model.md). No catalog data is stored (spec FR-007).

**Testing**: Jest (backend, existing) — contract tests via `nock` for the new
Express routes and the Discogs-enrichment merge logic; integration tests
against the Firestore emulator (existing pattern from feature 001) plus a
handful of live-Discogs-ID integration tests (existing pattern from feature
002) for the enrichment path. Vitest + React Testing Library (frontend,
existing) for the new pages/components.

**Target Platform**: Same Node.js/Express backend (Vercel Serverless
Function) and React/Vite frontend (Vercel static build) — unchanged.

**Project Type**: Web application — this feature touches both `backend/`
and `frontend/`.

**Performance Goals**: Library list loads within a few seconds for up to a
few hundred records (spec SC-002); adding a record from search takes under
30s end-to-end (spec SC-001).

**Constraints**: Every list/detail response must degrade gracefully,
per-entry, when Discogs can't be reached (spec FR-009) rather than failing
the whole request. Every library operation must be scoped to
`req.auth.uid` from the existing `requireAuth` middleware (spec FR-006). No
bulk "fetch many releases" endpoint exists in the Discogs API (confirmed in
feature 002's research), so enriching a page of entries means one Discogs
call per entry — bounded by pagination and limited concurrency (see
research.md).

**Scale/Scope**: Personal collections up to a few hundred records (spec
SC-002); same solo/small-team project scale otherwise.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Constraint | Check | Result |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Tasks phase sequences a failing test (contract, unit, or integration) before each implementation task, for both backend and frontend | PASS |
| II. Library-First & Modularity | New `backend/src/library/` module (service + enrichment + types) has a narrow interface; routes depend on it rather than touching Firestore/Discogs directly; frontend gets a small `services/libraryApi.ts` + `services/discogsApi.ts` | PASS |
| III. Simplicity, YAGNI & KISS | Offset-based Firestore pagination (not cursor tokens) at this scale; a small in-house concurrency-limiter instead of a new dependency; no folders/tags/valuation features beyond what the spec asks for | PASS |
| IV. SOLID Design | Routes depend on `libraryService`/`libraryEnrichment` abstractions (Dependency Inversion); enrichment (Discogs merge) is separate from persistence (Single Responsibility); frontend pages depend on API-service modules, not raw `fetch` | PASS |
| V. Observability | Library CRUD outcomes and per-entry Discogs-enrichment failures are logged via the existing `backend/src/config/logger.ts` | PASS |
| VI. Versioning & Breaking Changes | New, additive Firestore subcollection; no existing schema changed | PASS |
| Additional Constraints (API contracts documented first) | The 6 new REST endpoints are documented in `contracts/` before implementation | PASS |
| Additional Constraints (user-facing vs internal errors) | Not-found/unauthorized/unavailable are distinguished from internal errors in every response, matching the existing auth-route pattern | PASS |
| Tech Stack: Backend Express.js / Frontend React+TS | Both existing projects extended, no new stack elements | PASS |
| Tech Stack: Vinyl Data Source (Discogs) | Directly implements it: no catalog data is hand-stored; it's fetched live from the feature 002 Discogs client on every read | PASS |
| Tech Stack: Database Firebase | Firestore, scoped per-user under the existing `users/{uid}` document | PASS |
| Development Workflow: Conventional Commits | Task commits will follow `type: description` | PASS |

No violations identified. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-vinyl-library-crud/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── library-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── library/
│   │   ├── types.ts                # LibraryEntry (persisted), EnrichedLibraryEntry (API response)
│   │   ├── libraryService.ts       # Firestore CRUD under users/{uid}/libraryEntries
│   │   ├── libraryEnrichment.ts    # merges entries with live Discogs data (bounded concurrency)
│   │   └── concurrency.ts          # small mapWithConcurrency helper (no new dependency)
│   ├── routes/
│   │   ├── library.ts              # GET/POST /api/library, GET/PATCH/DELETE /api/library/:id
│   │   └── discogs.ts              # GET /api/discogs/search (thin, auth-gated proxy)
│   └── app.ts                      # (existing) mounts the two new routers
└── tests/
    ├── contract/
    │   ├── library.contract.test.ts
    │   └── discogsSearch.contract.test.ts
    ├── integration/
    │   └── library.integration.test.ts   # Firestore emulator + live Discogs enrichment
    └── unit/
        └── libraryEnrichment.test.ts      # per-entry success/unavailable merge logic

frontend/
├── src/
│   ├── components/
│   │   ├── AppHeader.tsx           # sign-out + nav, shared by all authenticated pages
│   │   └── RecordCard.tsx          # title/artist/cover/condition summary card
│   ├── pages/
│   │   ├── LibraryListPage.tsx     # replaces AuthenticatedPlaceholderPage as the /app home
│   │   ├── AddRecordPage.tsx       # search + select + add flow
│   │   └── RecordDetailPage.tsx    # merged detail + edit condition/notes + delete
│   └── services/
│       ├── apiClient.ts            # shared authorizedFetch() helper (attaches Firebase ID token)
│       ├── libraryApi.ts           # calls /api/library*
│       └── discogsApi.ts           # calls /api/discogs/search
└── tests/
    ├── unit/
    │   └── RecordCard.test.tsx
    └── integration/
        ├── addRecordFlow.test.tsx
        ├── libraryListFlow.test.tsx
        └── recordDetailFlow.test.tsx
```

**Structure Decision**: Extends both existing projects. Backend gets a new
`library/` module (Library-First) plus two thin route files, reusing feature
001's `requireAuth` and feature 002's `discogsClient`/mapper. Frontend
replaces the feature-001 placeholder authenticated page with the real
library UI, adding a small shared `apiClient.ts` helper so new API calls
don't duplicate the ID-token-attaching logic already living inside
`AuthContext` (that existing code is left untouched — only new code uses the
shared helper).

## Complexity Tracking

*No constitution violations — table intentionally omitted.*

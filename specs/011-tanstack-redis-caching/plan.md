# Implementation Plan: Application Caching (Frontend State & Backend Responses)

**Branch**: `011-tanstack-redis-caching` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-tanstack-redis-caching/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add two independent, standardized caching layers to eliminate redundant network work: (1) a **TanStack Query** client-state cache in the frontend so revisiting an already-loaded screen (library list, record detail) renders instantly from cache with background revalidation, and (2) a **Redis (via ioredis)** response cache in the backend in front of the slow/rate-limited Discogs catalog client (`searchCatalog`, `getRelease`, `getArtist`), including the per-entry `getRelease` calls made during library-list enrichment (`backend/src/library/libraryEnrichment.ts`), so identical catalog lookups are served without re-hitting Discogs. User-owned Firestore data (library CRUD) is only cached client-side (via TanStack Query, invalidated on mutation) and is explicitly excluded from the shared Redis cache per FR-006.

## Technical Context

**Language/Version**: TypeScript (frontend: ~6.0, backend: ^5.6), Node.js (backend, Vercel serverless functions)

**Primary Dependencies**: Frontend — `@tanstack/react-query` (new), existing `react-router-dom`, `firebase` (auth). Backend — `ioredis` (new), existing `express`, `axios` (Discogs client), `firebase-admin`.

**Storage**: Redis (new, response cache only — TTL-based key/value store; no durability requirements, data is always re-derivable from Discogs). Firestore remains system of record for user/library data (unchanged).

**Testing**: Frontend — Vitest + Testing Library (`frontend/tests/unit`, `frontend/tests/integration`), Playwright e2e (`e2e/`). Backend — Jest + Supertest + `ioredis-mock` (new, for unit/contract tests) against `backend/tests/{unit,contract,integration}`.

**Target Platform**: Vercel serverless functions (backend, single entry `backend/api/index.ts`), static SPA (frontend, Vite build) — both already deployed as separate Vercel projects.

**Project Type**: Web application (existing `frontend/` + `backend/` split, this feature adds no new top-level project)

**Performance Goals**: Cached catalog lookups (search, release, artist) return without an outbound Discogs call within their TTL; cached frontend screens paint from memory with 0 network round-trips on revisit (background revalidation may still fire per FR-002).

**Constraints**: Backend runs as short-lived serverless functions — the Redis client MUST be a lazily-initialized, reused-across-invocations singleton (same pattern as `getFirebaseApp()` in `backend/src/config/firebase-admin.ts`) to avoid exhausting connections; cache MUST be bypassed (not error) when Redis is unreachable (FR-008); no caching of per-user Firestore data in Redis (FR-006).

**Scale/Scope**: Two new cross-cutting infrastructure modules (`frontend/src/lib/queryClient.ts` + query hooks per resource; `backend/src/cache/redisClient.ts` + a caching wrapper applied to the three Discogs client functions) plus refactors of the existing pages/hooks and routes that currently call those functions directly. No new user-facing screens or Firestore schema changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS (must be honored in tasks) | New Redis cache wrapper and query hooks need failing tests first: backend cache-hit/miss/bypass-on-outage tests (Jest + `ioredis-mock`), frontend query-hook tests (Vitest + Testing Library, mocking `@tanstack/react-query`'s cache) verifying instant-from-cache + invalidation-on-mutation behavior. |
| II. Library-First & Modularity | PASS | Redis access is isolated behind a single `backend/src/cache/` module (get/set/wrap helpers) — routes and `discogsClient.ts` depend on that interface, not on `ioredis` directly. Frontend query concerns live in dedicated hook modules (e.g. `frontend/src/queries/`), not scattered `useQuery` calls with inline keys. |
| III. Simplicity, YAGNI & KISS | PASS | Uses each library's standard defaults (TanStack Query's `QueryClient`/`useQuery`/`useMutation` with sane `staleTime`/`gcTime`; a plain `GET`-before/`SET`-after cache-aside wrapper around the three Discogs functions) rather than a custom cache framework, cache tags, or a distributed-invalidation system. |
| IV. SOLID Design | PASS | Cache-aside wrapper added via composition around existing `discogsClient` functions (Open/Closed — no modification of `searchCatalog`/`getRelease` internals); routes/enrichment code keep calling the same function signatures. |
| V. Observability | PASS (must be honored in tasks) | FR-009 requires logging cache hit/miss events; will reuse the existing structured `logger` (`backend/src/config/logger.ts`) with a new `outcome` value (e.g. `cache_hit`/`cache_miss`) rather than inventing a new logging mechanism. |
| VI. Versioning & Breaking Changes | PASS | No API contract or Firestore schema changes; this is additive/internal (MINOR-level per `frontend/CHANGELOG.md` / `backend/CHANGELOG.md`, both of which MUST be updated per the changelog quality gate). |
| Web App Standards (API contracts, migrations, error separation) | PASS | No new/changed REST contracts (same request/response shapes per FR-010); no schema migration needed (Redis is a cache, not a source of truth); Redis outages MUST surface as a normal cache-miss fallback, never as a user-facing error (FR-008), keeping internal failures out of user-facing responses. |
| Tech Stack lock (React+TS, Tailwind v4, Express, Firebase, Discogs, GitHub, Vercel) | PASS — additive only | `@tanstack/react-query` and `ioredis`/Redis are additive libraries within the existing React/Express stack, not a stack replacement. Redis is introduced purely as a cache in front of Discogs data (per the Vinyl Data Source rule, Firestore/caches "MAY cache Discogs responses for performance" but MUST NOT become a source of truth) — satisfied since Redis entries are always re-derivable from Discogs and expire via TTL. |
| Frontend e2e coverage gate | PASS (must be honored in tasks) | Since `/frontend` code changes (query hooks + page refactors), an e2e scenario proving cached-then-instant navigation and post-edit freshness MUST be added/updated under `/e2e` before the feature is complete. |
| Changelog gate | PASS (must be honored in tasks) | Tasks MUST add entries to both `frontend/CHANGELOG.md` and `backend/CHANGELOG.md` (Added: TanStack Query state caching / Redis response caching). |

No violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/011-tanstack-redis-caching/
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
│   ├── cache/
│   │   ├── redisClient.ts       # NEW: lazy singleton ioredis connection (mirrors getFirebaseApp() reuse pattern)
│   │   └── cacheAside.ts        # NEW: get-or-set wrapper (key, ttl, fetcher) + hit/miss/bypass logging
│   ├── discogs/
│   │   └── discogsClient.ts     # MODIFIED: searchCatalog/getRelease/getArtist wrapped with cacheAside
│   ├── library/
│   │   └── libraryEnrichment.ts # UNCHANGED code path, benefits transitively (calls getRelease)
│   └── config/
│       └── logger.ts            # MODIFIED: add cache_hit/cache_miss LogOutcome values
└── tests/
    ├── unit/cache/               # NEW: cacheAside unit tests (hit, miss, Redis-down bypass)
    ├── contract/discogs.test.ts  # MODIFIED: assert cached responses match uncached shape
    └── integration/              # MODIFIED: verify repeated search/getRelease calls don't double-hit Discogs mock

frontend/
├── src/
│   ├── lib/
│   │   └── queryClient.ts        # NEW: shared QueryClient (default staleTime/gcTime)
│   ├── queries/
│   │   ├── libraryQueries.ts     # NEW: useLibraryList/useLibraryEntry hooks + mutation hooks w/ invalidation
│   │   └── discogsQueries.ts     # NEW: useCatalogSearch/useRelease hooks
│   ├── pages/
│   │   ├── LibraryListPage.tsx   # MODIFIED: use useLibraryList instead of manual useEffect/useState
│   │   └── RecordDetailPage.tsx  # MODIFIED: use useLibraryEntry + mutation hooks (replaces manual fetch in useEffect, lines ~22-42)
│   └── main.tsx                  # MODIFIED: wrap <App /> in <QueryClientProvider>
└── tests/
    ├── unit/queries/              # NEW: query/mutation hook tests
    └── integration/               # MODIFIED: recordDetailFlow.test.tsx etc. adapted to QueryClientProvider wrapper

e2e/
└── tests/
    └── caching-navigation.spec.ts # NEW: revisit library → detail → library is instant; edit reflects immediately
```

**Structure Decision**: Existing `frontend/` + `backend/` web application split is unchanged. This feature adds two new cross-cutting modules — `backend/src/cache/` (Redis access, isolated behind a small interface per Principle II) and `frontend/src/queries/` (TanStack Query hooks, isolated from components per the same principle) — and refactors the specific pages/routes/services identified above to use them instead of ad-hoc `fetch`/`useEffect` calls. No new top-level projects.

## Complexity Tracking

*No constitution violations requiring justification — table intentionally omitted.*

# Implementation Plan: Discogs-Integrated Wantlist (Lista de Deseos)

**Branch**: `060-discogs-wantlist-integration` | **Date**: 2026-09-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/060-discogs-wantlist-integration/spec.md`

## Summary

Add a Discogs-synchronized wantlist as the "records I want" counterpart to the existing library. The wantlist is a **sync-on-read view of the user's real Discogs wantlist** (`/users/{username}/wants`), not a locally stored list: no Firestore collection is introduced. Reads are served from a short-lived Redis cache (~5 min, same window as the library) plus a manual refresh; writes (add, edit notes/personal rating, remove) go straight to Discogs and bust the cache.

Technically this is an extension of the existing OAuth + Discogs domain. A new `DiscogsWantlistPort` and its OAuth-signed adapter reuse the exact resilience machinery already wrapping the collection client (`createClient` in `discogsCollectionAdapter.ts`: shared circuit breaker, preventive throttle, retry/backoff, 401/403 → `DiscogsAuthError`). A new `wantlist` application slice exposes four `/api/wantlist` routes whose error mapping mirrors `libraryRoutes.ts`. Wantlist cards reuse the catalog enrichment path and the existing `ReleaseRatingBadge` (still showing the **community** rating); the personal per-entry rating is a separate `StarRating` control edited — with the notes — in a new wantlist panel on the release detail page, styled on `MyCopySection`. The `createLibraryEntry` use case gains a best-effort "remove from wantlist on purchase" step (FR-012/FR-013).

Frontend keeps the existing route `/app/wishlist` and nav label ("My wishlist"); the backend slice and Discogs client use Discogs' own term, "wantlist"/"wants".

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js (backend: Express.js; frontend: React 19 + Vite)

**Primary Dependencies**: Backend — Express, `firebase-admin` (unused by this slice), `axios` (adapter only), `zod`, `ioredis` (via `cacheAdapter`). Frontend — React 19, React Router, TanStack Query v5, Tailwind CSS v4.

**Storage**: **None new.** Wantlist membership + per-entry notes/rating live only in the user's Discogs wantlist. Redis (via `cacheAdapter`) holds a short-lived cache of the enriched wantlist payload and/or a freshness marker per uid. No Firestore documents, no schema migration.

**Testing**: Backend — Jest + `supertest`, Firebase emulator (not needed here; Discogs stub is). Frontend — Vitest + React Testing Library. E2E — Playwright against the real backend with `e2e/helpers/discogsOauthStub.ts` extended for `/users/:username/wants`.

**Target Platform**: Web application deployed on Vercel (frontend + backend as separate projects, feature 005).

**Project Type**: Web application — `backend/` (hexagonal Express API) + `frontend/` (React SPA) + `e2e/` (Playwright).

**Performance Goals**: Opening the wantlist within the cache window issues **zero** new Discogs requests (SC-008). A cold wantlist load performs one paginated `GET /wants` walk plus catalog enrichment reusing existing per-release catalog caching. Add/edit/remove are single Discogs writes.

**Constraints**: Wantlist calls share the same per-IP Discogs rate-limit budget and circuit breaker as the catalog and collection clients — no separate quota (spec Assumptions). Every failure path must surface a clear, retryable error and never report a failed write as succeeded (FR-017). WCAG 2.1 AA + Apple HIG interaction/motion standards apply to all new UI (Principles X, XI).

**Scale/Scope**: Personal wantlists — typically tens to low hundreds of entries; `GET /wants` is paginated at 100/page. ~1 new backend slice (4 routes, 1 port, 1 adapter, ~4 use cases), ~1 modified use case (`createLibraryEntry`), ~6–8 new/modified frontend components, 1 rebuilt page.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Test-First (NON-NEGOTIABLE)** | PASS (planned). Every task is authored test-first: adapter contract tests against the extended Discogs stub, use-case unit tests with fake ports, route integration tests with `supertest`, RTL component/page tests, and Playwright e2e. No implementation task starts before its failing test. |
| **II. Discogs Integration-First & Modularity** | PASS. Wantlist membership + per-entry data are sourced from and written to Discogs as the system of record; nothing is curated locally. The port/adapter split keeps the integration reusable and independently testable; rate-limit/retry/circuit-breaker behavior is **reused**, not reinvented (FR-016). |
| **III. Simplicity, YAGNI & KISS** | PASS. No Firestore mirror (the library's reconciliation complexity exists only because it had pre-016 local data to migrate — the wantlist has none). No new caching policy — the library's marker/TTL pattern is reused. Out-of-scope items (price alerts, folders, reordering, push) are explicitly deferred. |
| **IV. SOLID** | PASS. New `DiscogsWantlistPort` is a focused interface (ISP); use cases depend on ports not adapters (DIP); `createLibraryEntry` is extended by injecting one more port, its existing behavior unchanged on the happy path (OCP-friendly). |
| **V. Observability** | PASS. Structured logs for `entry_added`, `entry_removed`, `entry_updated`, `wantlist_removed_on_purchase`, `sync_started/skipped/completed`, and every error, with `uid` + `releaseId` context (FR-019), matching `syncLibrary.ts` log shapes. |
| **VI. Versioning & Breaking Changes** | PASS. Additive only — new routes, new frontend surface, one backward-compatible response field added to `POST /api/library` (`wantlistRemoval`). No schema or contract break → MINOR version bump. |
| **VII. Curated Ratings & Music News** | PASS. The community rating badge keeps its meaning; the personal wantlist rating is user-specific state held in Discogs (consistent with how feature 016 treats the library rating), not catalog data. |
| **VIII. Hexagonal Architecture — Backend** | PASS. Four layers: `domain/discogsOauth/wantlistTypes.ts` + `domain/wantlist/wantlistErrors.ts` (no SDKs); `application/wantlist/*` use cases (ports only); `ports/discogsOauth/discogsWantlistPort.ts`; `adapters/discogsOauth/discogsWantlistAdapter.ts` + `adapters/wantlist/wantlistRoutes.ts` (driving adapter). Routes translate HTTP↔use-case and map domain errors to status codes via a shared helper — no business logic. |
| **IX. Frontend Network Requests — Backend-Only** | PASS. All new frontend requests target `/api/wantlist` (and existing `/api/library`); no Discogs SDK or direct Discogs call from `frontend/`. |
| **X. Accessibility — WCAG 2.1 AA (NON-NEGOTIABLE)** | PASS (planned). New controls get accessible names ("Add to wishlist", "Remove from wishlist", "Personal rating"); the remove-confirmation uses the existing accessible `Modal`; the two card actions are distinguished by label + icon, never color alone; contrast reuses tokens already audited in features 058/059. |
| **XI. Apple Design Principles Compliance** | PASS (planned). Reuses established components (`Card`, `Button`, `StarRating`, `InlineEditableField`, `ReleaseRatingBadge`); the `apple-design`/`emil-design-eng`/`animate` skills are consulted before building the wantlist panel, the confirmation dialog, and the "added" state transition; motion uses the project's spring/easing patterns and respects `prefers-reduced-motion`. |

**Additional Constraints**: API request/response contracts are documented in `contracts/` before implementation (Principle I / Web App Standards). No persistence migration needed.

**Result**: PASS — no violations, Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/060-discogs-wantlist-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── wantlist-api.md              # /api/wantlist HTTP contract
│   └── discogs-wantlist-client.md   # DiscogsWantlistPort ↔ Discogs /wants contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/src/
├── domain/
│   ├── discogsOauth/
│   │   └── wantlistTypes.ts            # NEW — WantlistItem (raw shape), WantEntry
│   └── wantlist/
│       └── wantlistErrors.ts           # NEW — re-exports DiscogsNotLinkedError; ReleaseNotFoundForWantError
├── application/
│   ├── wantlist/
│   │   ├── listWantlist.ts             # NEW — sync-on-read + cache marker + enrichment
│   │   ├── addToWantlist.ts            # NEW — PUT /wants + already-in-library flag
│   │   ├── updateWantEntry.ts          # NEW — per-field notes/rating write
│   │   ├── removeFromWantlist.ts       # NEW — DELETE /wants
│   │   └── getWantEntry.ts             # NEW — single-entry fetch for the detail page
│   └── library/
│       └── createLibraryEntry.ts       # MODIFIED — best-effort remove-from-wantlist on purchase
├── ports/
│   └── discogsOauth/
│       └── discogsWantlistPort.ts       # NEW — listWants / putWant / deleteWant
└── adapters/
    ├── discogsOauth/
    │   └── discogsWantlistAdapter.ts    # NEW — OAuth-signed client, reuses resilience pattern
    ├── discogs/
    │   └── respondCollectionError.ts    # NEW — extracted from libraryRoutes.ts, shared by both routers
    ├── library/
    │   └── libraryRoutes.ts             # MODIFIED — use shared error helper; surface wantlistRemoval flag
    └── wantlist/
        └── wantlistRoutes.ts            # NEW — GET / POST / PATCH /:releaseId / DELETE /:releaseId / GET /:releaseId
backend/src/app.ts                       # MODIFIED — app.use('/api/wantlist', wantlistRouter)

frontend/src/
├── services/
│   └── wantlistApi.ts                   # NEW — list/add/update/remove/getOne
├── queries/
│   └── wantlistQueries.ts               # NEW — TanStack Query hooks + keys
├── pages/
│   ├── WishlistPage.tsx                 # MODIFIED — real list (replaces UnderConstruction)
│   └── ReleaseDetailPage.tsx            # MODIFIED — add-to-wishlist action + wantlist panel
├── components/
│   ├── ResultCardActions.tsx           # MODIFIED — second action: Add to wishlist
│   ├── WantlistCard.tsx                 # NEW — release-linked card + remove action
│   ├── WantlistPanel.tsx               # NEW — notes + personal StarRating, per-field autosave
│   ├── RemoveFromWantlistDialog.tsx    # NEW — confirmation (wraps ui/Modal)
│   └── WantlistLinkRequired.tsx        # NEW or reuse LibraryLinkRequired with wishlist copy
└── (nav already present: headerNavLinks.ts / HeaderNavIcons.tsx / AppHeader mobile menu — verify mobile parity)

e2e/
├── helpers/discogsOauthStub.ts          # MODIFIED — /users/:username/wants GET/PUT/DELETE + /__stub/wants control
└── tests/wishlist-discogs-sync.spec.ts  # NEW — primary user journeys
    tests/wishlist-responsive.spec.ts    # MODIFIED — existing file, update for real page
```

**Structure Decision**: Web application, existing hexagonal `backend/` + React `frontend/` + Playwright `e2e/`. The wantlist follows the exact layering the codebase already uses for the library and the OAuth collection: the OAuth-signed Discogs client (port + types + adapter) lives in the `discogsOauth` slice next to `discogsCollectionAdapter.ts`; the application use cases and the driving HTTP adapter form a new `wantlist` slice. No Firestore repository/port is created because the wantlist has no locally-owned state.

## Complexity Tracking

> No Constitution Check violations — this section is intentionally empty.

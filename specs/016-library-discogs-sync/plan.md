# Implementation Plan: Sync Vinyl Library with Discogs Collection

**Branch**: `016-library-discogs-sync` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-library-discogs-sync/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

The personal library becomes a synchronized mirror of the linked user's Discogs collection. Per-copy data (rating, media condition, sleeve condition, notes) moves out of Firestore and lives exclusively in the Discogs collection instance, edited from the record detail through per-field autosave. The backend gains an OAuth-signed Discogs collection client (reusing the OAuth 1.0a PLAINTEXT signing from feature 015) and a sync service that reconciles Firestore library entries against the Discogs collection: one-time union merge with legacy notes/condition migration on first sync, Discogs as sole source of truth afterwards. Library reads are gated on link status (`discogs_not_linked` error for unlinked users → frontend shows a "link your accounts" state), sync is throttled by a 5-minute Redis marker with an explicit manual-refresh escape hatch, and add/remove/edit operations write through to Discogs before mutating local state.

## Technical Context

**Language/Version**: TypeScript ~5.6 (backend, Node.js 20 / Express), TypeScript ~6.0 (frontend, React 19 + Vite 8)

**Primary Dependencies**: Express 4, axios 1 (Discogs HTTP + OAuth 1.0a PLAINTEXT signing in `backend/src/discogs/oauth/oauthSignature.ts`), firebase-admin (Firestore), ioredis 5 (cache-aside via `backend/src/cache/cacheAside.ts`), @tanstack/react-query 5, Tailwind CSS 4, zod (route body validation)

**Storage**: Firestore — `users/{uid}/libraryEntries` (membership mirror; loses `condition`/`notes`, gains `discogsInstanceId`/`discogsFolderId`), `discogsConnections/{uid}` (existing OAuth tokens; gains `initialLibrarySyncAt`). Redis — per-user sync throttle marker + existing catalog caches. Discogs collection — system of record for rating, media condition, sleeve condition, notes.

**Testing**: Backend: Jest + nock (`backend/tests/{contract,integration,unit}`, helpers in `backend/tests/helpers`). Frontend: Vitest + React Testing Library (`frontend/tests`). E2E: Playwright (`e2e/tests`) against Firebase emulators + env-overridable Discogs stub.

**Target Platform**: Web (Vercel: static React frontend + Express API), Firebase emulators + local Redis for development

**Project Type**: Web application (`backend/` + `frontend/` + `e2e/`)

**Performance Goals**: Library load for a synced user within normal page-load expectations (skeleton-first); full sync of a 1,000-record collection completes without hitting Discogs' authenticated rate limit (60 req/min) — collection pages of 100 items ⇒ ~10 requests; per-field edit round-trip < 2s perceived (SC-006 gives 30s for a full edit session)

**Constraints**: Discogs rate limit 60 req/min (authenticated); sync throttle ~5 min (FR-014) with manual refresh; write-through consistency — never report saved/removed without Discogs confirmation (FR-011); one managed instance per release (earliest); condition values restricted to Discogs' closed grading set

**Scale/Scope**: Single-user collections up to low thousands of records; ~6 backend files new/reworked (collection client, sync service, library service/routes), ~8 frontend files (library page gate, detail per-copy panel, star rating component, queries/api), 1 new e2e spec + updates to the inline-edit spec

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Test-First | Contract tests (nock-stubbed Discogs collection endpoints), unit tests (sync reconciliation, condition mapping, migration), integration tests (library routes with emulator), e2e for the library-sync flow are planned before implementation; tasks phase must order them red→green. | PASS |
| II. Discogs Integration-First & Modularity | The feature's core is making Discogs the source of truth for collection membership and per-copy data. New collection client is a separate, independently testable module with rate-limit-aware error handling (reuses `DiscogsError` taxonomy), per-user cache/throttle to minimize redundant requests, and env-overridable base URL for stubs. | PASS |
| III. Simplicity, YAGNI & KISS | No background/scheduled sync, no multi-instance management, no folder management, no wantlist. Field IDs resolved from Discogs' List Custom Fields (cached) instead of building a custom-fields feature. Sync-on-read with a TTL marker instead of a job system. | PASS |
| IV. SOLID | Collection client (HTTP + signing) separated from sync service (reconciliation policy) separated from library routes (transport). Existing `oauthSignature.ts` extended with one generic protected-resource header builder rather than duplicating signing logic. | PASS |
| V. Observability | Structured logs for sync outcomes (records added/removed, migration performed, per-entry failures), Discogs auth failures, and cache/throttle decisions (FR-013), following the existing `logger.info({route, outcome, uid})` convention. | PASS |
| VI. Versioning & Breaking Changes | BREAKING: `POST /api/library` body and `PATCH /api/library/:id` body/response change; Firestore entries lose `condition`/`notes`. Migration path is designed-in (FR-010 first-sync migration, per-entry legacy-field deletion only after confirmed Discogs write). Changelogs + version bumps required in both packages; commit flagged `feat!`. | PASS (with documented migration) |
| Web App Standards | API contract documented in `contracts/library-sync-api.md` before implementation; migration is code-driven and reversible per entry (legacy fields retained until confirmed); user-facing errors distinguished from internal ones. | PASS |
| UI Design System | New `StarRating` atomic component; per-copy panel reuses `InlineEditableField`, `Card`, `Button`; skeletons keep shape (no layout shift); dark mode via existing theme variables; e2e coverage for the changed frontend flow. | PASS |

**Post-design re-check (after Phase 1)**: No new violations introduced. The design adds one new backend module directory (`discogs/collection/`) and one Firestore field on an existing doc — no new projects, no new storage systems, no speculative abstractions. Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/016-library-discogs-sync/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── library-sync-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── discogs/
│   │   ├── discogsClient.ts            # existing catalog client (unchanged)
│   │   ├── discogsErrors.ts            # + DiscogsAuthError (401/403 on signed calls)
│   │   ├── oauth/
│   │   │   ├── oauthSignature.ts       # + buildProtectedResourceHeader (generalize identity header)
│   │   │   └── discogsOauthService.ts  # existing (getConnection reused)
│   │   └── collection/                 # NEW module
│   │       ├── collectionClient.ts     # OAuth-signed calls: folders, releases pages, add, delete, rating, fields
│   │       ├── collectionTypes.ts      # CollectionInstance, CollectionField, grading enum
│   │       └── conditionGrading.ts     # closed grading set + legacy-condition mapping
│   ├── library/
│   │   ├── libraryService.ts           # entries lose condition/notes; gain instance/folder ids
│   │   ├── librarySyncService.ts       # NEW: reconcile Firestore ⇄ Discogs, first-sync migration, throttle
│   │   ├── libraryEnrichment.ts        # existing (unchanged)
│   │   └── types.ts                    # updated entry + per-copy (discogs) shapes
│   ├── cache/
│   │   └── cacheAside.ts               # + invalidateCache(key) helper (Redis DEL)
│   └── routes/
│       └── library.ts                  # link gate, sync-on-read, refresh param, discogs-fields PATCH
└── tests/
    ├── contract/                       # library.contract updates + collectionClient contract (nock)
    ├── integration/                    # librarySync.integration (emulator + nock)
    └── unit/                           # sync reconciliation, condition mapping, migration rules

frontend/
├── src/
│   ├── components/
│   │   ├── MyCopySection.tsx           # rating + media/sleeve condition + notes, autosave per field
│   │   ├── LibraryLinkRequired.tsx     # NEW: "link your accounts" state card
│   │   └── ui/
│   │       └── StarRating.tsx          # NEW: 5-star atomic component
│   ├── pages/
│   │   ├── LibraryListPage.tsx         # link gate + manual refresh action
│   │   ├── RecordDetailPage.tsx        # wires per-copy panel to Discogs fields
│   │   └── AddRecordPage.tsx           # add gated on link status; no condition/notes on create
│   ├── queries/
│   │   └── libraryQueries.ts           # updated mutations (per-field), refresh, link-error handling
│   └── services/
│       └── libraryApi.ts               # updated request/response types
└── tests/                              # component/unit updates for the above

e2e/
└── tests/
    ├── library-discogs-sync.spec.ts    # NEW: gate message, sync, add/remove propagation
    └── record-detail-inline-edit.spec.ts  # updated: rating/conditions/notes against Discogs stub
```

**Structure Decision**: Existing web-application layout (`backend/` + `frontend/` + `e2e/`) is retained. The only structural addition is `backend/src/discogs/collection/`, a sibling of the existing `oauth/` module, keeping catalog (app-token) and collection (user-token) clients separate because they authenticate differently and fail differently.

## Complexity Tracking

> No constitution violations requiring justification. Table intentionally empty.

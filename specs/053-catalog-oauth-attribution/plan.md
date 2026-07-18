# Implementation Plan: Identificar toda petición a Discogs con la cuenta vinculada del usuario

**Branch**: `053-catalog-oauth-attribution` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/053-catalog-oauth-attribution/spec.md`

## Summary

Catalog requests to Discogs (search, release, master, master versions, artist, rating) currently always sign with the shared `DISCOGS_TOKEN`, regardless of whether the requesting user has linked their own Discogs account — unlike collection (library) endpoints, which already resolve and sign with the user's linked OAuth 1.0a credentials. This feature extends the same credential-resolution rule to catalog: before each catalog request, the backend resolves whether the authenticated user has an active linked Discogs account (reusing the existing `DiscogsConnectionPort`) and signs the outgoing Discogs call with that account's credentials when present, or with `DISCOGS_TOKEN` when absent. A revoked linked account (Discogs 401/403) must surface the same `discogs_link_invalid` "relink required" contract collection already returns — never a silent fallback to `DISCOGS_TOKEN`. Every actual Discogs HTTP call gets an added `credentialType` field in its structured log for auditability. The frontend's catalog data-fetching hooks/pages gain the same relink-prompt handling collection's "add to library" flow already has, since a linked-but-revoked user can now hit this state while merely browsing (not just adding).

## Technical Context

**Language/Version**: TypeScript (Node.js, backend) / TypeScript + React (frontend) — existing stack, no change.

**Primary Dependencies**: Express (backend routing), axios (Discogs HTTP client), the project's hand-rolled OAuth 1.0a PLAINTEXT signer (`backend/src/adapters/discogsOauth/oauthSignature.ts`, already used by collection — reused, not reimplemented), Firestore (`discogsConnections/{uid}` — existing, read-only for this feature), TanStack Query (frontend catalog hooks).

**Storage**: No new storage. Reads the existing `discogsConnections/{uid}` Firestore collection (already populated by the OAuth link flow, feature 015/048). No schema change.

**Testing**: Jest (unit/integration/contract) + `nock` for Discogs HTTP mocking (existing helper `backend/tests/helpers/nock.ts`) + Firebase emulator for Firestore-backed route tests (`supertest` + `createApp()` + `createTestSession`) — same conventions as the collection domain's existing tests. Frontend: Vitest/RTL for hook/page unit tests (existing pattern), Playwright under `/e2e` for the new relink-while-browsing flow (required by the Development Workflow gate below, since `/frontend` is touched).

**Target Platform**: Existing Vercel-hosted Node backend + React SPA — no change.

**Project Type**: Web application (backend + frontend), matching the existing repo layout.

**Performance Goals**: No new performance target. Must not add a network round-trip to the resolution path beyond the one Firestore read already paid by collection's `requireConnection` (a `discogsConnections/{uid}` lookup) — for catalog this read happens once per incoming vinylmania HTTP request (or once per search request server-side), not once per individual Discogs call within a request's enrichment fan-out.

**Constraints**: Must not duplicate the ~150-line resilience interceptor pipeline (circuit breaker, retry, rate-limit tracking) that `discogsCatalogAdapter.ts`'s `createDiscogsHttpClient()` already implements and that collection's `discogsCollectionAdapter.ts` already duplicates once — a second full duplication for a "user-scoped catalog client" would compound that existing debt (Constitution Principle III/IV). Catalog and collection already intentionally share the same circuit breaker and rate-limit throttle instances (feature 040) — that sharing MUST be preserved.

**Scale/Scope**: Same request volume as today; this changes *which credential* signs a request, not request frequency, caching, or the set of exposed endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle II (Discogs Integration-First & Modularity)** — PASS. Credential resolution reuses the existing `DiscogsConnectionPort`/`DiscogsConnection` (no new Discogs integration surface); the catalog client keeps its rate-limit-aware, cached, modular shape. No new redundant Discogs requests are introduced (see Storage/Performance above).
- **Principle III (Simplicity, YAGNI & KISS)** — PASS. No speculative abstraction: `CatalogCredential` is a two-variant discriminated union sized exactly to this feature's two cases (spec explicitly rules out a third "in-between" state). No new caching dimension is added (spec Assumption: catalog content is credential-independent).
- **Principle IV (SOLID Design)** — PASS, with one explicit refactor: `createDiscogsHttpClient()` gains an optional `getAuthorization` parameter (default = today's `DISCOGS_TOKEN` behavior) so the *same* interceptor pipeline serves both credential types via Dependency Inversion, instead of a second adapter class duplicating it (Open/Closed: existing call sites and tests keep working unchanged since the parameter is optional and defaults to current behavior).
- **Principle V (Observability)** — PASS, is the explicit subject of User Story 4 / FR-005: every actual Discogs HTTP call already has a structured log site (`logRateLimit` and the response-interceptor's warn/error branches in `discogsCatalogAdapter.ts`); this feature adds a `credentialType: 'vinylmania' | 'user'` field to that existing `meta`, never a token/secret value.
- **Principle VIII (Hexagonal Architecture)** — PASS, with one deliberate layering decision: credential resolution ("does this uid have an active link, and is it still valid?") is a business rule, not infrastructure — it lives in a new Application-layer function (`application/discogsCatalog/`), calling the existing `DiscogsConnectionPort`, mirroring `application/library/syncLibrary.ts`'s `requireConnection`. `DiscogsCatalogPort` methods gain a `credential: CatalogCredential` parameter so the Adapter stays a dumb translator (it accepts whatever credential it's given and never itself decides "should I fall back?" — there is structurally no fallback code path, which is how FR-004's "never a silent substitute" guarantee is actually enforced, not by a runtime check). Routes remain thin: they resolve the credential (via the new Application function) and pass it straight to the port, same shape as today's direct route→adapter calls for release/master/master-versions.
- **Principle IX (Frontend Network Requests — Backend-Only)** — PASS. Frontend changes only add client-side handling of an existing backend error *code* (`discogs_link_invalid`) already used elsewhere in the app; no new third-party SDK or direct Discogs call is introduced in `frontend/`.
- **Development Workflow gate (e2e for `/frontend` PRs)** — APPLIES. This feature's frontend changes (catalog pages/hooks surfacing `discogs_link_invalid`) require e2e coverage under `/e2e` for the affected flow (browsing catalog with a revoked link), per the Constitution's mandatory gate — tracked in Phase 1/tasks, not skipped.

*Post-design re-check*: Phase 0 research (Decision 6) surfaced a correctness requirement not obvious from the spec alone — a bare `err instanceof DiscogsAuthError` check in `discogsRoutes.ts` would also fire when `DISCOGS_TOKEN` itself is invalid (the `vinylmania` credential, used by unlinked users), incorrectly telling an unlinked user their Discogs *link* needs re-establishing. The mapping is therefore gated on `credential.type === 'user'` in addition to the error type, preserving Principle IV's Single Responsibility (the new branch handles exactly the case FR-003 describes, nothing broader) without weakening Principle V (the `vinylmania`-credential failure still logs, just via the existing unmatched-error path). No new Constitution Check gate is triggered by this; it's a precision fix within the already-approved design, not a new violation.

No violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/053-catalog-oauth-attribution/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/src/
├── domain/discogsCatalog/
│   └── types.ts                          # existing — add CatalogCredential union
├── application/discogsCatalog/
│   ├── resolveCatalogCredential.ts       # NEW — Application-layer credential resolution (mirrors syncLibrary.ts's requireConnection)
│   └── searchCatalogWithRatings.ts       # existing — thread credential through to internal getMasterRelease/getReleaseRating calls
├── ports/discogsCatalog/
│   └── discogsCatalogPort.ts             # existing — every method gains a `credential: CatalogCredential` param
├── adapters/discogsCatalog/
│   ├── discogsCatalogAdapter.ts          # existing — parameterize createDiscogsHttpClient(getAuthorization?), add user-scoped client path, add credentialType to log meta
│   └── discogsRoutes.ts                  # existing — resolve credential before each adapter/use-case call; map DiscogsAuthError -> 401 discogs_link_invalid ONLY when the resolved credential was the user's own (a vinylmania-credential auth failure keeps falling through to the existing 500, unchanged)
├── adapters/discogsOauth/
│   └── oauthSignature.ts                 # existing — reused as-is (buildProtectedResourceHeader) for the user-scoped catalog client
└── adapters/library/
    └── libraryRoutes.ts                  # existing — extract the DiscogsAuthError -> discogs_link_invalid mapping into a small shared helper reused by discogsRoutes.ts

backend/tests/
├── unit/discogsCatalog/application/resolveCatalogCredential.test.ts     # NEW
├── contract/discogsCatalog/discogsCatalogCredential.contract.test.ts    # NEW — asserts outgoing Authorization header per credential type (nock)
└── contract/discogsCatalog/ (existing files) + contract/library/library.contract.test.ts pattern reused for route-level 401 discogs_link_invalid

frontend/src/
├── queries/discogsQueries.ts             # existing — no query-key/shape change; hooks already surface `error` from ApiError
├── components/
│   └── DiscogsRelinkNotice.tsx           # NEW — extracts the relink-prompt text/link pattern already duplicated in ReleaseDetailPage/SearchResultsPage, now needed a 3rd/4th time (Constitution's "extract once repeated" rule)
└── pages/
    ├── SearchResultsPage.tsx             # existing — detect discogs_link_invalid on the search query itself, not just the add-mutation
    ├── ReleaseDetailPage.tsx             # existing — same, for the release fetch
    └── (master/master-versions equivalents, if present)

e2e/
└── (new spec) discogs-catalog-relink.spec.ts   # NEW — browsing catalog with a revoked link shows the reconnect prompt, per Development Workflow gate
```

**Structure Decision**: Existing backend hexagonal layout (`domain/`, `application/`, `ports/`, `adapters/` under `backend/src/discogsCatalog/*`) is reused as-is — no new top-level layer or domain folder. Frontend changes are additive within the existing `queries/`, `pages/`, and a new small `components/` entry, following the established "extract once a pattern repeats" rule rather than introducing a new UI subsystem.

## Complexity Tracking

*No entries — Constitution Check reported no unjustified violations.*

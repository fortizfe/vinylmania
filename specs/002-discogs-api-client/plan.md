# Implementation Plan: Discogs Catalog Client & Data Model

**Branch**: `002-discogs-api-client` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-discogs-api-client/spec.md`

## Summary

Add a backend module that talks to the real Discogs REST API (`api.discogs.com`)
to search the catalog and fetch full Release/Artist detail, mapping Discogs'
raw JSON into Vinylmania's own internal domain model. No new HTTP endpoints
are exposed yet — this is a library other backend code (a future search
route) will depend on. Uses `axios` as the HTTP client, `zod` to validate
Discogs' response shape at the boundary, and a small internal error taxonomy
(not-found / rate-limited / unavailable / validation) so callers never have
to know Discogs' HTTP status codes.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (existing `backend/`
project from feature 001)

**Primary Dependencies**:
- `axios` — HTTP client (new)
- `zod` — runtime validation of Discogs responses before mapping (new)
- Existing: `express`, `firebase-admin`, `dotenv`, `cors` (unchanged; this
  feature adds no new routes)

**Storage**: N/A — this feature only fetches and maps data in-memory; no
persistence is added (per spec Assumptions, caching is explicitly out of
scope for this version).

**Testing**: Jest (existing backend test runner).
- `nock` (new) — deterministic, offline HTTP mocking for contract/unit tests
  against the Discogs client, so CI never depends on network access or
  Discogs' real rate limit.
- A small, separate **live integration** suite that calls the real
  `api.discogs.com` for a couple of permanent, well-known IDs (artist `1`,
  release `1`), mirroring this project's existing preference (from feature
  001's Firebase-emulator tests) for exercising real behavior over mocks
  wherever practical — Discogs has no local emulator, so "real, stable,
  public, read-only IDs" is the closest equivalent.

**Target Platform**: Same Node.js/Express backend, deployed as a Vercel
Serverless Function (unchanged from feature 001).

**Project Type**: Web application — this feature only touches `backend/`.

**Performance Goals**: Searches/lookups complete in under 3s under normal
network conditions (spec SC-001); stay within Discogs' documented rate
limits (60 req/min authenticated).

**Constraints**: Every request MUST carry a descriptive `User-Agent` and an
`Authorization: Discogs token=...` header (Discogs API requirement, verified
empirically — see research.md). No response caching. No per-end-user Discogs
credentials (single app-level token, per spec Assumptions).

**Scale/Scope**: Same small-scale solo/small-team project; this feature adds
one internal module (client + mapper + error types), no new scale
requirements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Constraint | Check | Result |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Tasks phase sequences a failing test (nock-based contract test or mapping unit test) before each implementation task; a small live-integration suite validates real behavior | PASS |
| II. Library-First & Modularity | Discogs client (`discogsClient.ts`), response mapper (`discogsMapper.ts`), and error types (`discogsErrors.ts`) are separate modules with a narrow exported interface (`searchCatalog`, `getRelease`, `getArtist`) | PASS |
| III. Simplicity, YAGNI & KISS | No caching, no auto-retry/backoff library, no per-user OAuth, no deep search-filter support — only what the spec requires | PASS |
| IV. SOLID Design | Future route/service code depends on the client's exported functions and typed errors, not on `axios` or raw Discogs JSON directly (Dependency Inversion); mapping logic is isolated from HTTP transport (Single Responsibility) | PASS |
| V. Observability | Every Discogs request outcome (verified/not-found/rate-limited/error) is logged via the existing `backend/src/config/logger.ts`, including Discogs' own rate-limit headers | PASS |
| VI. Versioning & Breaking Changes | New, additive internal types (Release/Artist/Track/Label/CatalogSearchResult) — no existing schema changes | PASS |
| Additional Constraints (API contracts documented first) | No new public HTTP endpoint in this feature; the *library* interface (function signatures, inputs/outputs, error types) is documented in `contracts/` before implementation, satisfying the same spirit | PASS |
| Additional Constraints (user-facing vs internal errors) | Internal error taxonomy carries diagnostic detail in logs only; nothing in the thrown/returned error types leaks Discogs internals to future callers beyond a safe classification | PASS |
| Tech Stack: Backend Express.js | Module lives inside the existing `backend/` Express+TypeScript project | PASS |
| Tech Stack: Vinyl Data Source (Discogs) | This feature *is* the constitutional Discogs integration — the whole point is to source release/artist data from Discogs and map it, not hand-author it | PASS |
| Tech Stack: Source control / Deployment | No change — same GitHub/Vercel setup | PASS |
| Development Workflow: Conventional Commits | Task commits will follow `type: description` | PASS |

No violations identified. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-discogs-api-client/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── discogs-client.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── discogs/
│   │   ├── discogsClient.ts      # axios instance + searchCatalog/getRelease/getArtist
│   │   ├── discogsMapper.ts      # raw Discogs JSON -> internal domain model (zod-validated)
│   │   ├── discogsErrors.ts      # DiscogsNotFoundError, DiscogsRateLimitError, etc.
│   │   └── types.ts              # CatalogSearchResult, Release, Artist, Track, Label, ...
│   └── config/
│       └── logger.ts             # (existing) reused for Discogs request logging
└── tests/
    ├── contract/
    │   └── discogsClient.contract.test.ts   # nock-mocked: search/getRelease/getArtist happy + error paths
    ├── integration/
    │   └── discogsClient.live.test.ts       # real api.discogs.com calls against stable, permanent IDs
    └── unit/
        └── discogsMapper.test.ts            # pure mapping-logic tests (missing fields, multi-artist, aliases)
```

**Structure Decision**: Everything lives under the existing `backend/`
project from feature 001 — no new top-level project, no frontend changes.
The Discogs integration is isolated in its own `backend/src/discogs/`
directory (Library-First modularity) so future features (a search route,
"add to collection") depend on a small, typed interface rather than reaching
into `axios`/raw Discogs JSON directly.

## Complexity Tracking

*No constitution violations — table intentionally omitted.*

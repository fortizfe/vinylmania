# Implementation Plan: Over-engineering Audit Cleanup

**Branch**: `066-overengineering-audit-cleanup` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/066-overengineering-audit-cleanup/spec.md`

## Summary

This is a behavior-preserving cleanup based on the 2026-09-18 over-engineering audit:
- Drop `dotenv` (backend and e2e) in favor of a guarded `process.loadEnvFile()`.
- Drop `cross-env`, since Jest already defaults `NODE_ENV` to `test`.
- Move the duplicated library/search URL-filter code into one shared module.
- Remove a delegate-only cache wrapper, an unused hook value, and exports that are only used in their own file.

Planning research disproved two audit findings, so they were moved out of scope in the spec:
- **Native `<dialog>` (research R2):** in Chromium and WebKit, Tab escapes the modal to the page body.
- **motion's `useReducedMotion` (research R3):** it doesn't update when the OS setting changes.

## Technical Context

**Language/Version**: TypeScript 5.6 (backend, Node 24 in CI and on Vercel); TypeScript 6.0 + React 19 (frontend)

**Primary Dependencies**: Express 4, Jest 29 (backend); Vite 8, Vitest 4, react-router-dom 6 (frontend); Playwright 1.61 (e2e). Removed: `dotenv` ×2, `cross-env`.

**Storage**: N/A (no data changes)

**Testing**: Jest + Firebase emulators (backend), Vitest + RTL (frontend), Playwright chromium + webkit (e2e)

**Target Platform**: Node 24 serverless (Vercel) / local Node; evergreen browsers

**Project Type**: Web application (backend + frontend + e2e)

**Performance Goals**: N/A (no runtime path changes)

**Constraints**: Zero user-visible change; public hook/function APIs are kept so call sites and existing tests stay untouched.

**Scale/Scope**: About 10 source files changed, 1 module added, 3 dependency declarations removed, net ≤ −50 lines.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Test-First | PASS | Every change is covered by existing, green tests that pin current behavior (the query-param hook tests, cache unit tests, layout unit and e2e tests, the full backend suite for env/NODE_ENV). The shared filter module gets its own unit test written first. |
| II. Discogs Integration-First | N/A | No Discogs behavior touched. |
| III. Simplicity / YAGNI / KISS | PASS | This feature exists for this principle. The rejected findings (R2, R3) were dropped because the "simpler" option did not meet the same requirement. |
| IV. SOLID | PASS | Shared filter logic gets a single owner, and the public APIs don't change. |
| V. Observability | PASS | No log paths touched. |
| VI. Versioning | PASS | PATCH: no breaking change. |
| VII. Ratings & News | N/A | |
| VIII. Hexagonal (backend) | PASS | The cache change stays inside the adapter, and the port is unchanged. The env loading stays in the entrypoints (composition roots). |
| IX. Frontend requests backend-only | N/A | |
| X. WCAG 2.1 AA | PASS | No UI change. Finding 1 was excluded and finding 2 rejected specifically to protect focus order and focus containment. |
| XI. Apple design | N/A | No visual or motion change. |

**Post-design re-check**: PASS. The design adds one module and no new abstractions, layers or dependencies.

## Project Structure

### Documentation (this feature)

```text
specs/066-overengineering-audit-cleanup/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R8 (R2, R3 = rejected findings)
├── data-model.md        # Phase 1: no data changes; CatalogFilters alias only
├── quickstart.md        # Phase 1: validation guide
└── tasks.md             # Phase 2 (/speckit-tasks)
```

No `contracts/` folder: the feature exposes no new or changed external interface (FR-008).

### Source Code (repository root)

```text
backend/
├── package.json                          # −dotenv, −cross-env; test script drops cross-env
├── api/index.ts                          # dotenv/config → guarded process.loadEnvFile()
└── src/
    ├── server.ts                         # same
    ├── adapters/cache/cacheAdapter.ts    # drop delegate-only wrappers (R6)
    └── **/*.ts                           # drop file-local exports (R8)

frontend/src/
├── hooks/
│   ├── catalogFilterParams.ts            # NEW: single copy of filter parse/build (R5)
│   ├── useLibraryQueryParams.ts          # thin: page + shared filters
│   ├── useSearchQueryParams.ts           # thin: q + page + shared filters
│   └── useIndependentColumnLayout.ts     # drop unused `ready` (R7)
└── **/*.ts(x)                            # drop file-local exports (R8)
frontend/tests/unit/hooks/catalogFilterParams.test.ts   # NEW, written first

e2e/
├── package.json                          # −dotenv
└── playwright.config.ts                  # dotenv.config → guarded process.loadEnvFile(path)
```

**Structure Decision**: The existing web-app layout (`backend/`, `frontend/`, `e2e/`). One new module holds the shared filter logic. Everything else is edits and deletions in place.

## Complexity Tracking

No constitution violations, so nothing to justify.

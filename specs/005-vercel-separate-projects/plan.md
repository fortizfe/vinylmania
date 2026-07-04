# Implementation Plan: Separate Vercel Deployments for Backend and Frontend

**Branch**: `005-vercel-separate-projects` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-vercel-separate-projects/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Split the current single combined Vercel deployment (root `vercel.json` building
the frontend and routing `/api/*` to the backend within one project) into two
independent Vercel projects — one rooted at `backend/`, one rooted at
`frontend/` — each with its own `vercel.json`, its own environment variables, and
its own production URL. No application code or route changes are required: the
frontend already calls the backend through a configurable `VITE_API_BASE_URL`,
and the backend already restricts CORS through a configurable `FRONTEND_ORIGIN`
allow-list. This feature adds the two per-project `vercel.json` files, removes
the now-superseded root one, and produces a step-by-step deployment guide
(`docs/deployment-vercel.md`) that never prints a real secret value.

## Technical Context

**Language/Version**: No change — backend TypeScript ~5.6 (Node, Express),
frontend TypeScript ~6.0 (React 19, Vite 8); this feature only touches
deployment configuration and documentation, not application source.

**Primary Dependencies**: Vercel platform primitives only — `@vercel/node`
serverless runtime for the backend's existing `api/index.ts` entry point, and
Vercel's static/Vite build output for the frontend. No new npm package is
introduced.

**Storage**: N/A — Firebase/Firestore usage is unchanged and out of scope.

**Testing**: No new automated test framework. Verification is deployment-level
(documented in quickstart.md): curl/browser checks against each live project,
since a `vercel.json` and Vercel project settings cannot be exercised by a unit
test. This is a deliberate, scoped adaptation of Principle I — see Constitution
Check below.

**Target Platform**: Vercel, as two independent projects: `backend/` deployed as
Node.js serverless functions, `frontend/` deployed as a static single-page
application build.

**Project Type**: Web application — deployment/infrastructure configuration
change across the existing `backend/` and `frontend/` directories; no new
source directories are introduced.

**Performance Goals**: N/A beyond preserving current behavior — FR-009 requires
zero change to existing user-facing performance or functionality.

**Constraints**: No real secret value may ever be committed, printed in the
guide, or appear in git history (FR-005/FR-008); no existing API route path or
frontend route may change (FR-009); production deployments only — preview
(PR/branch) connectivity between the two projects is explicitly out of scope
per the resolved clarification; both projects use Vercel's default
`*.vercel.app` URLs, no custom domain work.

**Scale/Scope**: 2 Vercel projects (backend, frontend), 2 new `vercel.json`
files, 1 removed root `vercel.json`, 1 new guide document, environment variable
configuration only (6 backend vars, 7 frontend vars — see data-model.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Section | Requirement | This feature's compliance |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Tests before implementation | Adapted: there is no application code to unit-test here. The "test" is the quickstart.md deployment verification (curl `/health`, sign-in, library load, deep-link refresh), written before the config is considered done, and re-run after each `vercel.json` change. No source-level test suite is bypassed — the existing backend/frontend test suites are unaffected and continue to gate any future code change. |
| II. Library-First & Modularity | Self-contained modules, single purpose | Each Vercel project's `vercel.json` is fully scoped to its own directory (`backend/vercel.json`, `frontend/vercel.json`) with no cross-references, mirroring the existing `backend/`/`frontend/` module boundary. |
| III. Simplicity, YAGNI & KISS | Simplest design for the stated requirement | Reuses the two mechanisms that already exist for exactly this purpose (`VITE_API_BASE_URL`, `FRONTEND_ORIGIN`) — zero new dependencies, zero new abstractions. |
| IV. SOLID Design | N/A here | No object/module design is introduced by this feature. |
| V. Observability | Structured logs for key operations | Unchanged — existing backend error logging (`logger.error` in `app.ts`) is preserved as-is; the guide adds a step to check Vercel's function logs when verifying a deployment. |
| VI. Versioning & Breaking Changes | Breaking changes documented | No API contract or data schema changes; this is an infra-only change. Removing the root `vercel.json` is a deployment-process change, not a versioned contract, and is called out explicitly in FR-006. |
| Technology Stack — Deployment | Vercel required; deployments SHOULD trace to GitHub | Both new projects MUST be created via Vercel's "Import Git Repository" flow against the existing GitHub repo (per-project Root Directory setting), not the CLI alone, so both stay traceable to reviewed commits. |
| Technology Stack — Vinyl Data Source / Database | Discogs API + Firebase unchanged | Untouched; this feature only relocates *how* their existing credentials are supplied (per-project Vercel env vars instead of one shared set). |
| Development Workflow | Conventional Commits; PR review | Followed at commit time; not a design-time gate. |

**Result**: PASS, with one documented adaptation of Principle I (see row above) —
not a violation requiring Complexity Tracking, since no simpler alternative
(e.g., a fabricated unit test around a JSON config file) would add real
verification value over the deployment-level checks in quickstart.md.

**Post-Design Re-check** (after Phase 1 data-model.md/contracts/quickstart.md):
No new dependency, abstraction, or deviation was introduced during design beyond
what this table already accounts for (two scoped `vercel.json` files, reuse of
`VITE_API_BASE_URL`/`FRONTEND_ORIGIN`, and the quickstart-as-test adaptation).
Gate remains **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/005-vercel-separate-projects/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
vercel.json                       # REMOVED by this feature (superseded, FR-006)

backend/
├── vercel.json                   # NEW: this project's own config (root = backend/)
├── api/index.ts                  # Unchanged — existing serverless entry point
└── src/                          # Unchanged — existing Express app/routes

frontend/
├── vercel.json                   # NEW: this project's own config (root = frontend/)
├── vite.config.ts                # Comment update only (no longer references root vercel.json)
└── src/                          # Unchanged — existing app code, already uses
                                   # VITE_API_BASE_URL for all backend calls

docs/
└── deployment-vercel.md          # NEW: step-by-step guide (FR-007/FR-008), no secret values
```

**Structure Decision**: No new source directories. This feature adds exactly two
new `vercel.json` files (one per existing `backend/`/`frontend/` directory, each
becoming its own Vercel project's Root Directory), removes the single root
`vercel.json` that unified them, and adds one new documentation file. This
matches the existing Option 2 (web application: `backend/` + `frontend/`)
structure already in place across the repo.

## Complexity Tracking

*No violations — table intentionally omitted (see the one documented Principle I
adaptation in the Constitution Check table above, which is not a complexity
violation).*

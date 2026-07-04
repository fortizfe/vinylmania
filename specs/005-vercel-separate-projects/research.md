# Phase 0 Research: Separate Vercel Deployments for Backend and Frontend

All Technical Context fields were resolvable from the existing codebase, the
constitution, and the clarifications resolved during `/speckit-specify`. No
`NEEDS CLARIFICATION` markers remain. This document records the concrete
decisions and why each was chosen.

## 1. Two-project split mechanism

- **Decision**: Delete the root `vercel.json` and add one `vercel.json` inside
  `backend/` and one inside `frontend/`. Each becomes a separate Vercel project
  with its Root Directory set to that folder.
- **Rationale**: This is Vercel's standard supported pattern for deploying
  multiple independent apps from one monorepo — each project only ever "sees"
  its own subtree once Root Directory is set, so each project's `vercel.json`
  must be self-contained (no `../` references to the sibling app).
- **Alternatives considered**: Keeping one root `vercel.json` with two separate
  "Project" entries (rejected — Vercel does not support multiple projects from a
  single `vercel.json`; one config file maps to one project); a Vercel
  "monorepo" turborepo-style setup with a build-graph tool (rejected — massive
  overkill for two independent apps with no shared build step, violates
  Principle III).

## 2. Backend routing inside its own project

- **Decision**: `backend/vercel.json` declares the existing `api/index.ts` as
  the function entry point (`@vercel/node@3` runtime, same as today) and adds a
  catch-all rewrite: every incoming path (`/(.*)`) is rewritten to
  `/api/index.ts`.
- **Rationale**: The Express app in `src/app.ts` does its own internal routing
  (`/health`, `/api/auth`, `/api/discogs`, `/api/library`). Vercel's zero-config
  file-based routing would only expose `api/index.ts` at `/api` by default —
  not at `/health` or at nested `/api/*` paths — so an explicit catch-all
  rewrite is required to preserve every existing route path unchanged (FR-009).
  This is exactly what the current root `vercel.json`'s
  `"/api/(.*)" → "/backend/api/index.ts"` rewrite already does for the
  `/api/*` case; standing the backend up as its own project just means the
  rewrite's destination path loses the `backend/` prefix (it's already the
  project root) and its source must widen from `/api/(.*)` to `/(.*)` so
  `/health` (which has no `/api` prefix) keeps working too.
- **Alternatives considered**: Renaming `/health` to `/api/health` (rejected —
  changes an existing route path, forbidden by FR-009); one Vercel function per
  route instead of a single Express catch-all (rejected — large unrelated
  refactor of the backend's routing, not needed to satisfy this feature).

## 3. Frontend SPA routing inside its own project

- **Decision**: `frontend/vercel.json` adds a catch-all rewrite (`/(.*)` →
  `/index.html`) so React Router can handle deep links and refreshes on any
  client-side route (e.g. `/app/records/:entryId`).
- **Rationale**: Vite's static output has no server-side awareness of
  client-side routes; without this rewrite, a direct navigation or refresh on a
  nested route 404s. The current combined config never actually added this
  rewrite either (it only had the `/api/*` one) — this was a latent gap in
  today's deployment that this feature closes as part of giving the frontend
  its own explicit config, directly satisfying FR-002/SC-003.
- **Alternatives considered**: Relying on Vercel's automatic Vite framework
  detection to add SPA fallback implicitly (rejected — Vercel's zero-config
  preset for Vite does not assume a client-side router is in use; an explicit
  rewrite is the documented, reliable way to support one).

## 4. Cross-project communication (frontend → backend)

- **Decision**: No code change. Continue using the frontend's existing
  `VITE_API_BASE_URL` (read once in `frontend/src/services/apiClient.ts`,
  defaulting to `''` for same-origin calls) and the backend's existing
  `FRONTEND_ORIGIN` CORS allow-list (read in `backend/src/app.ts`). Set both as
  literal per-project Vercel environment variables once each project's
  production URL is known.
- **Rationale**: Both mechanisms already exist in the codebase for exactly this
  purpose (confirmed while researching this feature) — this is precisely the
  kind of case Principle III warns against re-solving with new abstractions.
- **Alternatives considered**: Introducing a shared config package or a
  build-time URL injection step (rejected — unnecessary; a plain environment
  variable per project is simpler and already wired end-to-end).

## 5. Secret handling

- **Decision**: Every credential (`FIREBASE_SERVICE_ACCOUNT_KEY`,
  `FIREBASE_PROJECT_ID`, `DISCOGS_TOKEN`, `DISCOGS_USER_AGENT`) is entered
  directly into the backend Vercel project's Environment Variables UI (or via
  `vercel env add` from an operator's authenticated machine), scoped to
  Production only. `FIREBASE_SERVICE_ACCOUNT_KEY`'s value is the service
  account JSON collapsed to a single line (Vercel's admin SDK code already does
  `JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)`, confirmed in
  `backend/src/config/firebase-admin.ts`). The guide (`docs/deployment-vercel.md`)
  names every variable and its purpose but never contains a real value —
  confirmed no secret is currently committed anywhere in the repo (checked
  `.gitignore` coverage and `git log` for tracked `.env*` files: only
  `frontend/.env.test` is tracked, and it contains only placeholder/dummy
  Firebase values used for the test suite, not real credentials).
- **Rationale**: Directly satisfies FR-005/FR-008/SC-004; Vercel's environment
  variable storage is encrypted at rest and is the constitution-compliant way
  to supply secrets to a Vercel-deployed service.
- **Alternatives considered**: A `.env.production` file committed to the repo
  (rejected — exactly what FR-005 forbids); a third-party secrets manager
  (rejected — introduces a new external dependency not required by the spec's
  scope, violates Principle III).

## 6. Project creation method

- **Decision**: Both Vercel projects are created via Vercel's "Import Git
  Repository" flow (GitHub App integration) against the existing
  `fortizfe/vinylmania` repository, each with a distinct Root Directory
  (`backend`, `frontend`) chosen during import.
- **Rationale**: The constitution requires deployments to trace back to a
  reviewed GitHub commit; importing via the GitHub integration (rather than
  deploying ad hoc from the CLI) is what makes every production deployment of
  both projects automatically tied to `main`.
- **Alternatives considered**: `vercel --prod` CLI-only deployment with no Git
  integration (rejected — works, but breaks the "traceable to GitHub" rule
  from the Technology Stack section and requires manual redeploys instead of
  automatic ones on push).

## 7. Existing deployment state

- **Decision**: Treat this as a from-scratch setup — no existing Vercel
  project is assumed to exist for this repository (confirmed: no `.vercel/`
  directory locally, and the user confirmed nothing is deployed yet). No
  migration or decommissioning steps are included.
- **Rationale**: Matches the resolved clarification directly; keeps the guide
  focused only on the steps that are actually needed.

## 8. Preview deployments

- **Decision**: Out of scope for this feature, per the resolved clarification.
  The guide notes this explicitly as a known limitation: a frontend preview
  deployment (e.g. for a pull request) will either fail to reach a backend (if
  `VITE_API_BASE_URL` is only set for Production) or reach the Production
  backend (if inherited) — either way, no dynamic per-preview wiring is
  configured by this feature.
- **Rationale**: Matches the resolved clarification; keeps this pass's scope
  bounded to what was explicitly asked for (production deployment of both
  projects).
- **Alternatives considered**: Wildcard CORS matching Vercel's preview URL
  pattern, or a script to sync preview URLs between projects (rejected for this
  pass — real future enhancement, but explicitly deferred by the clarification).

## Outcome

All unknowns are resolved. No `NEEDS CLARIFICATION` markers remain. Proceeding
to Phase 1 design (data-model.md, contracts/, quickstart.md).

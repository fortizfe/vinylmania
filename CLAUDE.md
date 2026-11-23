# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Vinylmania

Vinyl-collector web app: Discogs catalog data + collector ratings + rock/metal music news.
Three independent npm projects (no workspace): `backend/`, `frontend/`, `e2e/`. The root `package.json`
only holds release tooling tests. Governing rules live in `CONSTITUTION.md` — read it
before non-trivial design work; reviewers reject PRs that break it.

## Commands

```bash
docker compose up -d redis              # optional; backend falls back to uncached fetches without it

# backend/ (Express + TS, Jest)
npm run dev | build | lint | format
npm test                                # wraps Jest in `firebase emulators:exec` (auth 9099, firestore 8080), 300s cap
npm test -- tests/contract/library      # args are forwarded to jest
npx jest tests/unit/cache/cacheAside.test.ts   # pure unit tests run fine without emulators

# frontend/ (React 19 + Vite + Tailwind v4, Vitest + RTL)
npm run dev | build | lint (oxlint) | format
npm test                                # vitest run
npx vitest run tests/unit/AppHeader.test.tsx  # single file

# e2e/ (Playwright; boots emulators, Google/Discogs OAuth stubs, backend and frontend itself)
npm test
npm test -- tests/library-filters.spec.ts

# root
npm test                                # node --test for scripts/ (release + test tooling)
```

- Backend and e2e `pretest` fails fast if emulator ports are already held — don't run both suites concurrently.
- Local e2e loads `backend/.env`, so Redis must be listening on its `REDIS_URL` (otherwise every test fails at
  sign-in with `internal_error`; a throwaway `redis-server --daemonize yes --save "" --appendonly no` works).
  Cached `discogs:release:*` keys survive between runs, so a local-only failure on Discogs data (e.g.
  `discogs-catalog-relink.spec.ts`) is likely stale Redis, not a regression. CI has no Redis and is unaffected.
- 2 tests in `backend/tests/contract/discogsCatalog/discogsSearch.contract.test.ts` fail locally unless
  `DISCOGS_TOKEN` is exported in the shell (`.env` alone isn't enough):
  `export $(grep "^DISCOGS_TOKEN=" backend/.env | xargs)`. CI sets it and is unaffected.
- Backend env vars are documented in `backend/README.md`.

## Architecture

**Backend — hexagonal (constitution §VIII, mandatory).** Global layer folders under `backend/src/`, one
subfolder per business domain (`library`, `wantlist`, `discogsCatalog`, `discogsOauth`, `feeds`,
`collectionStats`, `streaming`, `googleAuth`, `users`, `auth`):
- `domain/` — types, rules, domain errors (no HTTP, no SDKs).
- `application/` — use cases as `createXxxUseCase(deps)` factories taking ports.
- `ports/` — interfaces only.
- `adapters/` — the only place allowed to import `firebase-admin`, `axios`, `ioredis`, `rss-parser`, etc.
  Each domain's `*Routes.ts` is the composition root: it instantiates adapters, wires use cases, validates
  input with `zod`, and maps domain errors to HTTP (e.g. `respondCollectionError`).
- `src/discogs/` holds the shared Discogs rate limiter, retry-with-backoff, circuit breaker and `DiscogsError`
  hierarchy (typed `code`). `config/logger.ts` and `shared/` are transversal and usable from any layer.
- `app.ts` mounts all routers under `/api/*`; `server.ts` runs locally, `api/index.ts` is the Vercel entry.
- Tests: `tests/unit`, `tests/integration`, `tests/contract` (per domain), helpers in `tests/helpers` (nock, auth emulator).

**Frontend.** `services/*Api.ts` (all calls go through `apiClient.ts`) → `queries/*Queries.ts`
(TanStack Query hooks) → `pages/` + `components/`. Constitution §IX: the frontend talks **only** to our
backend — no Firebase/Discogs SDKs. Login is a backend-mediated full-page Google OAuth redirect.

**UI rules (constitution §X, §XI, Tailwind section) are merge gates:** WCAG 2.1 AA, 44×44px touch targets
(`min-h-11 min-w-11`), purpose-built desktop *and* mobile layouts, skeleton loaders matching final shape
(no spinners), no layout shift between states, dark mode via `@theme` tokens, `stone` neutrals with
indigo primary / amber accent, Tailwind v4 CSS-first config (no `tailwind.config.js`), shared atomic
components instead of repeated utility strings. Consult the `apple-design` / `emil-design-eng` / `animate`
skills before building or restyling UI.

## Workflow

- Test-first is non-negotiable (constitution §I): failing test before implementation.
- `specs/NNN-slug/` holds the design history of past features (spec, plan, contracts, quickstart).
  Spec-kit is no longer used (no slash commands, hooks or per-phase auto-commits). New design docs, when a
  feature needs them, are plain Markdown written by `architect-agent` in the same layout.
- Commits are conventional commits: CI on `main` derives the version bump and `CHANGELOG.md` from them
  (`scripts/release/`; `feat` → minor, `fix` → patch, `chore/docs/test/ci/style/refactor` → no release).
  Backend and frontend are versioned in lockstep.
- CI (`.github/workflows/ci.yml`): backend, frontend, e2e (chromium + webkit) and CodeQL; Critical/High
  CodeQL alerts block deploy. Backend and frontend deploy as two separate Vercel projects
  (`docs/deployment-vercel.md`).

## HU desde Jira

- Sitio: `fortizfe.atlassian.net` · Proyecto Jira: `VINYLMANIA` (tickets `VINYLMANIA-XXX`).
- Si el usuario da una clave `VINYLMANIA-XXX` o una URL de ese Jira como descripción de una tarea, lee el ticket
  con las herramientas MCP `atlassian` (`getJiraIssue` / `searchJiraIssuesUsingJql`): summary + description +
  criterios de aceptación + comentarios relevantes. No pidas al usuario que pegue el contenido.
- Sin clave explícita, no consultes Jira. No muevas tarjetas de estado salvo que el usuario lo pida.
- Las HU refinadas viven en `.hu/` con las reglas de `.hu/AGENTS.md` (BDD Given-When-Then, constitución).

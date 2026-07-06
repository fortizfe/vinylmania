# Implementation Plan: Link Vinylmania Account with Discogs (OAuth)

**Branch**: `015-discogs-oauth-link` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-discogs-oauth-link/spec.md`

## Summary

Add the ability for a signed-in Vinylmania user (Google/Firebase login, unchanged) to link their account with their personal Discogs account via Discogs' OAuth 1.0a flow, from a new "Discogs connection" card in the Profile section. The backend (Express) drives the three-step OAuth exchange (request token → user authorization on Discogs → access token), verifies the resulting credentials against Discogs' identity endpoint, and persists the connection server-side in Firestore (`discogsConnections/{uid}`) so future features can act on the user's behalf. The frontend renders connection status from stored state only (no live Discogs call on profile load), offers link/unlink actions, and handles the return leg from Discogs on a dedicated callback route. Consumer key/secret live exclusively in backend environment variables.

## Technical Context

**Language/Version**: TypeScript 5.6 (backend, Node.js/CommonJS), TypeScript 6.0 (frontend)

**Primary Dependencies**: Backend: Express 4, axios, zod, firebase-admin, dotenv. Frontend: React 19, react-router-dom 6, TanStack Query 5, Tailwind CSS v4, firebase (Auth only). No new runtime dependency required — OAuth 1.0a PLAINTEXT headers are built in-project (see research.md R1).

**Storage**: Firestore (Admin SDK, backend-only access): new `discogsConnections/{uid}` collection for durable connections; new `discogsOAuthRequests/{oauthToken}` collection for short-lived pending link attempts (~15 min validity). Redis is not used for this feature (research.md R4).

**Testing**: Backend: Jest + supertest + nock (Discogs HTTP mocked) + Firebase emulators (`firebase emulators:exec`). Frontend: Vitest + Testing Library. E2E: Playwright with the Firebase Auth/Firestore emulators plus a local Discogs OAuth stub server (research.md R6).

**Target Platform**: Web (two Vercel projects: frontend static + backend Express); local dev via Vite dev server + ts-node-dev.

**Project Type**: Web application (existing `backend/` + `frontend/` + `e2e/` workspaces)

**Performance Goals**: Profile connection status renders from Firestore only — no Discogs round-trip on profile load (spec clarification, Session 2026-07-06). Full link flow completes in well under 2 minutes (SC-001); Discogs OAuth calls use the existing 10s axios timeout pattern.

**Constraints**: OAuth verifier/request token expire ~15 minutes after issuance (Discogs-imposed); consumer key/secret only via backend env vars, never committed, never sent to browser (FR-009); user access token/secret never leave the backend (FR-010); one connection per user, re-link blocked until disconnect (FR-008); all Discogs requests need a `User-Agent` header (existing `DISCOGS_USER_AGENT` convention).

**Scale/Scope**: Single-user-scale hobby app; 4 new backend endpoints, 2 Firestore collections, 1 new profile card + 1 callback route on the frontend, 3–4 e2e scenarios.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Status | Notes |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS | Contract tests for the 4 endpoints (supertest + nock + Firestore emulator), unit tests for the OAuth header builder and service, frontend component tests for the connection card and callback page — all written before implementation. |
| II. Library-First & Modularity | PASS | OAuth logic isolated in `backend/src/discogs/oauth/` (signature builder + service) with a clear interface consumed by a dedicated router; frontend follows the existing services → queries → components layering. |
| III. Simplicity, YAGNI & KISS | PASS | PLAINTEXT signature over HTTPS (Discogs-recommended) hand-built in ~40 lines instead of adding an OAuth library (research.md R1). No token encryption layer beyond Firestore's at-rest encryption (research.md R5). No speculative sync features — only the connection lifecycle. |
| IV. SOLID Design | PASS | Signature building, OAuth service (Discogs I/O + persistence), and HTTP routing are separate single-responsibility modules; the service exposes an interface future sync features consume without touching routes. |
| V. Observability | PASS | Structured `logger` entries for link started / completed / failed (with cause) / disconnected (FR-012), following the existing `{ route, outcome, uid, message }` shape; internal details never reach user-facing messages. |
| VI. Versioning & Breaking Changes | PASS | Additive only: new endpoints, new Firestore collections, no changes to existing document shapes. Backend 0.2.0 → 0.3.0 (MINOR), frontend 0.5.0 → 0.6.0 (MINOR), with dated CHANGELOG entries in the same PR. |
| Tech stack (React+TS, Tailwind v4, Express, Firebase, Discogs as vinyl source, Vercel) | PASS | No deviation; Discogs OAuth is the constitution-mandated data source's own auth mechanism. |
| UI Design System (cards, atomic components, skeletons, dark mode, no layout shift) | PASS | Connection card built from existing `Card`/`Button` atoms; skeleton mirrors the card's final shape; all states share sizing classes; dark mode via existing theme variables. |
| Workflow gates (Conventional Commits, e2e for frontend changes, CHANGELOG + version bump) | PASS | E2E specs added under `/e2e` for link/deny/unlink flows via a Discogs stub (research.md R6); both changelogs + version bumps in the same PR. |

**Post-Phase-1 re-check (after data-model.md, contracts/, quickstart.md)**: PASS — no violations introduced; no Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/015-discogs-oauth-link/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── discogs-oauth-api.md   # REST contract for the 4 new endpoints
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── app.ts                          # MODIFIED: mount discogsOauthRouter at /api/discogs/oauth (before /api/discogs)
│   ├── discogs/
│   │   └── oauth/
│   │       ├── oauthSignature.ts       # NEW: OAuth 1.0a PLAINTEXT Authorization header builder
│   │       ├── oauthHttpClient.ts      # NEW: axios instance for Discogs OAuth endpoints (form-urlencoded, User-Agent, error mapping)
│   │       ├── discogsOauthService.ts  # NEW: startLink / completeLink / getConnection / disconnect
│   │       └── types.ts                # NEW: DiscogsConnection, PendingOAuthRequest, status DTO
│   └── routes/
│       └── discogsOauth.ts             # NEW: 4 endpoints (request, complete, status, connection)
├── tests/
│   ├── unit/discogsOauthSignature.test.ts      # NEW
│   ├── unit/discogsOauthService.test.ts        # NEW (nock + Firestore emulator)
│   └── contract/discogsOauthRoutes.test.ts     # NEW (supertest + nock + emulator)
├── CHANGELOG.md                        # MODIFIED: 0.3.0 entry
└── package.json                        # MODIFIED: version 0.3.0

frontend/
├── src/
│   ├── App.tsx                         # MODIFIED: add /app/profile/discogs/callback route
│   ├── pages/
│   │   ├── ProfilePage.tsx             # MODIFIED: replace UnderConstruction with profile content + connection card
│   │   └── DiscogsCallbackPage.tsx     # NEW: completes the link on return from Discogs, then redirects to profile
│   ├── components/
│   │   ├── DiscogsConnectionCard.tsx   # NEW: skeleton / not-connected / connected / error states
│   │   └── DiscogsConnectionCardSkeleton.tsx  # NEW (same dimensions as final card)
│   ├── services/
│   │   └── discogsOauthApi.ts          # NEW: authorizedFetch wrappers for the 4 endpoints
│   └── queries/
│       └── discogsOauthQueries.ts      # NEW: TanStack Query hooks (status query + link/complete/disconnect mutations)
├── tests/ (co-located *.test.tsx per existing convention)
├── CHANGELOG.md                        # MODIFIED: 0.6.0 entry
└── package.json                        # MODIFIED: version 0.6.0

e2e/
├── helpers/
│   └── discogsOauthStub.ts             # NEW: local stub for request_token / authorize / access_token / identity
├── tests/
│   └── discogs-account-link.spec.ts    # NEW: link happy path, deny, unlink, re-link-blocked
└── playwright.config.ts                # MODIFIED: backend env points Discogs OAuth base URLs at the stub
```

**Structure Decision**: Follows the existing web-application split (`backend/`, `frontend/`, `e2e/`). Backend OAuth code lives under `backend/src/discogs/oauth/` as a self-contained module beside the existing catalog client (`discogsClient.ts`), which stays untouched — the catalog client keeps using the app-level `DISCOGS_TOKEN`; per-user OAuth credentials are a separate concern consumed by future features through `discogsOauthService`.

## Environment Variables (new)

| Variable | Where | Purpose |
|---|---|---|
| `DISCOGS_CONSUMER_KEY` | `backend/.env` / Vercel backend project | Application's Discogs consumer key (never committed, never sent to browser) |
| `DISCOGS_CONSUMER_SECRET` | `backend/.env` / Vercel backend project | Application's Discogs consumer secret (same handling) |
| `DISCOGS_OAUTH_CALLBACK_URL` | `backend/.env` / Vercel backend project | Absolute URL of the frontend callback route, e.g. `http://localhost:5173/app/profile/discogs/callback` (prod: the deployed frontend origin) |
| `DISCOGS_OAUTH_BASE_URL` (optional) | backend env, tests/e2e only | Overrides `https://api.discogs.com` for the request/access-token and identity endpoints so e2e can target the local stub; defaults to the real host |
| `DISCOGS_AUTHORIZE_BASE_URL` (optional) | backend env, tests/e2e only | Overrides `https://www.discogs.com/oauth/authorize`; defaults to the real host |

The user places the real key/secret values in `backend/.env` themselves; no secret values appear in the repo or in this spec's artifacts.

## Complexity Tracking

No constitution violations — table intentionally empty.

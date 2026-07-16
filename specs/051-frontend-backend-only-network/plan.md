# Implementation Plan: Frontend habla solo con el backend propio

**Branch**: `051-frontend-backend-only-network` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/051-frontend-backend-only-network/spec.md`

## Summary

Ratify a new constitution Core Principle restricting `frontend/` to
network requests aimed only at Vinylmania's own backend (User Story 1), then
make the codebase actually comply by replacing the Firebase Auth client SDK
login with a fully backend-mediated Google OAuth 2.0 flow (User Story 2):
full-page redirect to a backend-issued authorize URL, server-to-server code
exchange with Google, a new opaque backend session (bearer token, sliding
expiry for silent renewal, one independent session per device), and a
`requireAuth` port/adapter swap so the backend verifies its own session
instead of a Firebase ID token. This is the only real violation of the new
principle found by the codebase audit (`.hu/frontend-backend-only-network-requests.md`);
everything else in `frontend/src` already complies today.

## Technical Context

**Language/Version**: TypeScript 5.6 (backend, Node.js/CommonJS, ES2022
target); TypeScript ~6.0 (frontend, Vite 8)

**Primary Dependencies**: Express 4.19 + `firebase-admin` 12.3 + `zod`
(backend, unchanged); React 19 + `react-router-dom` 6 +
`@tanstack/react-query` 5 (frontend, unchanged). No new production
dependency is required for the Google OAuth exchange or userinfo call — both
are plain HTTP requests the backend already knows how to make (same pattern
as `oauthHttpClient.ts` for Discogs).

**Storage**: Firebase Firestore — two new collections, `sessions/{sessionId}`
and `pendingGoogleLogins/{state}` (see `data-model.md`); no change to
existing `users`/`discogsConnections`/library collections.

**Testing**: Jest + `supertest` + Firebase emulators (backend, `firestore`
required, `auth` required only for the Firebase-Admin-resolution tests per
`research.md` R5); Vitest + React Testing Library (frontend component/unit);
Playwright (`e2e/`, full login/session/logout journeys against a new
`googleOauthStub.ts`, mirroring `discogsOauthStub.ts`).

**Target Platform**: Web — two independently deployed Vercel projects
(`specs/005-vercel-separate-projects`), cross-origin by design.

**Project Type**: Web application (existing `frontend/` + `backend/` split).

**Performance Goals**: No new performance target; session verification must
stay within the existing per-request latency budget (one Firestore
read/write per authenticated request, replacing today's one Firebase Admin
`verifyIdToken` call — comparable cost, no external network call added to
the hot path since Google is only contacted during login, not on every
request).

**Constraints**: Cross-origin frontend/backend deployment (rules out
same-site cookies without extra complexity, R1); must preserve every
existing user's Firebase-managed `uid` so their library/ratings/collection
data is untouched (R3b); `authorizedFetch`'s call shape must not change for
any of its five existing consumers (FR-010).

**Scale/Scope**: Two new backend domains (`googleAuth`, plus an extension of
the existing `auth` domain), one frontend auth-module rewrite
(`AuthContext.tsx`, `apiClient.ts`, `firebaseClient.ts` removed), one new
frontend page (`LoginCallbackPage`), one new e2e stub, one constitution
amendment. Solo/small-team project scale (per constitution) — no
multi-tenant or high-concurrency concern.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Test-First | Plan requires failing Jest tests for `startLogin`/`completeLogin`/`sessionAuthVerifierAdapter` and a failing e2e login spec before implementation, per the existing project convention (e.g. `completeLink.test.ts` pattern for Discogs). | PASS (enforced in tasks.md, not this plan) |
| II. Discogs Integration-First & Modularity | Not touched — Discogs OAuth link flow is explicitly out of scope and unmodified. | PASS (N/A) |
| III. Simplicity, YAGNI & KISS | Sliding-window session TTL was chosen specifically to avoid building a separate refresh-token flow (R7); Firestore reused instead of adding Redis-as-session-store (R2); userinfo HTTP call chosen over adding a JWT/JWKS-verification dependency (R3). | PASS |
| IV. SOLID | New `SessionStorePort`/`GoogleIdentityPort`/`IdentityResolverPort` isolate three distinct infrastructure concerns (session persistence, Google HTTP calls, Firebase Admin user resolution) instead of one god-adapter; `AuthVerifierPort`'s existing single-method shape is preserved, only its semantics change (R4). | PASS |
| V. Observability | Every new use case logs `outcome` (`login_started`, `login_completed`, `login_failed`, `logged_out`) with `uid` where known, mirroring the existing `discogsOauth` logging pattern exactly. | PASS |
| VI. Versioning & Breaking Changes | The auth mechanism change (Firebase ID token → own session token) is a breaking change to what `Authorization: Bearer` means. Its migration path is fully specified by the spec's clarifications: no dual-verification window; rejected legacy tokens are treated as ordinary session expiration (FR-019). This MUST be called out explicitly in the PR description as a MAJOR-classified change to the auth contract, even though no *public* request/response shape (beyond the endpoints in `contracts/google-login-api.md`) changes. | PASS, with an explicit call-out required at merge time (see Complexity Tracking) |
| VII. Curated Ratings & Music News | Not touched. | PASS (N/A) |
| VIII. Hexagonal Architecture (Backend) | New code follows the four-layer structure exactly (`domain/googleAuth`, `ports/googleAuth`+`ports/auth`, `adapters/googleAuth`+`adapters/auth`, `application/googleAuth`+`application/auth`); routes stay thin (translation only, mirroring `discogsRoutes.ts`'s `handleFailure` pattern). | PASS |
| Additional Constraints (API documented first) | `contracts/google-login-api.md` written in this planning phase, before implementation. | PASS |
| Technology Stack | No stack deviation — Express/React/Firebase/Vercel/GitHub all unchanged; `firebase-admin` stays a backend dependency (R3b); only the frontend's `firebase` (client SDK) package is removed. | PASS |
| Development Workflow (e2e gate) | New/changed frontend flow (`LoginCallbackPage`, `AuthContext`) gets explicit e2e coverage (`quickstart.md` scenarios 2–6) before merge. | PASS (enforced in tasks.md) |

No unjustified violations. The one item requiring an explicit written
call-out (Principle VI) is not a deviation from the principle — it is the
principle's own required disclosure step — so it is tracked as a merge-time
checklist item, not a Complexity Tracking entry.

## Project Structure

### Documentation (this feature)

```text
specs/051-frontend-backend-only-network/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── google-login-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/src/
├── domain/
│   ├── auth/
│   │   ├── types.ts              # existing AuthenticatedUser — unchanged
│   │   └── session.ts            # NEW: Session type
│   └── googleAuth/
│       ├── types.ts              # NEW: GoogleIdentity
│       └── googleAuthErrors.ts   # NEW: GoogleAuthFlowError
├── ports/
│   ├── auth/
│   │   ├── authVerifierPort.ts       # CHANGED: verifyIdToken → verifySession
│   │   ├── sessionStorePort.ts       # NEW
│   │   └── identityResolverPort.ts   # NEW
│   └── googleAuth/
│       └── googleIdentityPort.ts     # NEW
├── adapters/
│   ├── auth/
│   │   ├── requireAuth.ts                    # unchanged (depends on the port, not the adapter)
│   │   ├── sessionAuthVerifierAdapter.ts      # NEW (replaces firebaseAuthVerifierAdapter's role here)
│   │   ├── firestoreSessionStoreAdapter.ts    # NEW
│   │   └── firebaseIdentityResolverAdapter.ts # NEW
│   ├── googleAuth/
│   │   ├── googleAuthRoutes.ts        # NEW: GET /google/authorize, POST /google/complete
│   │   └── googleIdentityAdapter.ts   # NEW: Google HTTP calls
│   └── users/
│       ├── authRoutes.ts              # CHANGED: remove POST /session, add DELETE /session (logout); /me, /preferences keep working via the swapped port
│       └── firestoreUserRepository.ts # unchanged
├── application/
│   ├── auth/
│   │   └── logoutSession.ts   # NEW
│   ├── googleAuth/
│   │   ├── startLogin.ts      # NEW
│   │   └── completeLogin.ts   # NEW (reuses existing userProfileUseCases logic to sync UserProfile)
│   └── users/
│       └── userProfileUseCases.ts   # unchanged, called from completeLogin.ts
└── app.ts   # CHANGED: mount googleAuthRoutes, both public (no requireAuth) at /api/auth/google

frontend/src/
├── services/
│   ├── apiClient.ts           # CHANGED: token source becomes a session store, not firebaseAuth.currentUser
│   ├── firebaseClient.ts      # REMOVED
│   └── sessionStore.ts        # NEW: tiny localStorage-backed token holder
├── auth/
│   └── AuthContext.tsx        # REWRITTEN: no SDK listener; drives the redirect flow + 401-triggered sign-out
├── pages/
│   └── LoginCallbackPage.tsx  # NEW: mirrors DiscogsCallbackPage.tsx
└── App.tsx                    # CHANGED: add public /login/callback route

e2e/
├── helpers/
│   ├── googleOauthStub.ts      # NEW: mirrors discogsOauthStub.ts
│   └── fakeGoogleSignIn.ts     # REWRITTEN: drives the full-page redirect flow instead of a popup
├── playwright.config.ts        # CHANGED: add googleOauthStub webServer entry + GOOGLE_* env
└── tests/*.spec.ts             # existing specs using signInAsFakeGoogleUser keep passing against the rewritten helper

.specify/memory/constitution.md   # CHANGED: new Principle IX, version 2.5.0 → 2.6.0
```

**Structure Decision**: Existing `backend/` (hexagonal: domain/application/
ports/adapters) + `frontend/` (React/TS) + `e2e/` (Playwright) layout is
reused as-is. This feature adds two new backend domain folders
(`googleAuth`, and an extension of `auth`) following the exact convention
`discogsOauth` already established, per Principle VIII and `research.md` R8.
No new top-level project or package is introduced.

## Complexity Tracking

> No unjustified constitution violations. This table documents the one
> deliberate, spec-driven exception that still merits explicit visibility
> per Principle VI.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Breaking change to the meaning of `Authorization: Bearer` (Firebase ID token → own session token), with no dual-verification transition window | The spec's clarifications (Session 2026-07-16) explicitly chose this over a transition mechanism, treating the one-time forced re-login as ordinary session expiration | A dual-verification window (accept both old and new credentials temporarily) was considered and explicitly rejected in spec clarification — it would require building and then tearing down a second, temporary verification path in `AuthVerifierPort` for a single-deploy transient window, adding real implementation and test surface for a one-time, low-severity user impact (one re-login) |

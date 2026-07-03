# Implementation Plan: Landing Page & Google Sign-In

**Branch**: `001-landing-google-login` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-landing-google-login/spec.md`

## Summary

Build a flat, modern landing page that communicates Vinylmania's purpose within the
first viewport and offers a "Sign in with Google" call to action that never
requires scrolling. Authenticate visitors against Firebase Authentication's Google
provider; on first sign-in, create a Firestore user profile; on every sign-in,
verify the visitor server-side and land them on a placeholder authenticated screen
showing their Google name/photo. Support explicit sign-out back to the anonymous
landing state. This is a multi-user app: any Google account may sign in and will
own its own, isolated collection in later features.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (backend); React 18 +
TypeScript 5.x (frontend)

**Primary Dependencies**:
- Frontend: React 18, Vite, `firebase` (client SDK, `firebase/auth`), react-router-dom
  (landing route + placeholder authenticated route)
- Backend: Express.js 4.x, `firebase-admin` (ID token verification + Firestore
  access), `cors`, `dotenv`

**Storage**: Firebase Firestore — single `users/{uid}` collection for user
profiles (see [data-model.md](./data-model.md)). No relational database.

**Testing**: Frontend: Vitest + React Testing Library (native Vite integration,
same config/toolchain, satisfies Principle I Test-First). Backend: Jest +
Supertest for route/middleware tests; Firebase emulator suite (Auth + Firestore)
for integration tests per constitution's Technology Stack rationale.

**Target Platform**: Web browser (frontend, evergreen desktop + mobile browsers)
and a Node.js server exposed as a Vercel Serverless Function (backend API).

**Project Type**: Web application (separate `frontend/` and `backend/` projects)

**Performance Goals**: Landing page interactive well within typical web
expectations (no heavy assets, flat design); sign-in round trip (click → 
recognized as signed in) under 10s per SC-003.

**Constraints**: "Sign in with Google" CTA and value-proposition copy MUST render
inside the first viewport with no scrolling across common breakpoints (~360px–
1920px wide), per FR-001/FR-002. Backend MUST verify every session server-side
(no trusting client-only auth state) per Principle V/Additional Constraints.

**Scale/Scope**: Solo/small-team project; initial expected load is low
(tens–low hundreds of concurrent users), no high-scale requirement for this
feature.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Constraint | Check | Result |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Tasks phase will sequence a failing test before each implementation task, for both frontend (Vitest+RTL) and backend (Jest+Supertest) | PASS |
| II. Library-First & Modularity | Auth logic isolated into a frontend `auth` module (Firebase client wrapper + context) and a backend `auth` module (Firebase Admin wrapper + middleware), each with a narrow interface | PASS |
| III. Simplicity, YAGNI & KISS | No custom session store, no roles/permissions system, no admin console — only what FR-001…FR-010 require | PASS |
| IV. SOLID Design | Route handlers depend on an auth-verification abstraction rather than reaching into `firebase-admin` directly from every handler; UI components depend on an auth context, not on Firebase SDK calls scattered through components | PASS |
| V. Observability | Backend logs structured events for: token verification success/failure, first-time user creation, sign-out | PASS (see contracts) |
| VI. Versioning & Breaking Changes | `users/{uid}` document shape defined once in data-model.md; this is a new collection, no migration needed yet | PASS |
| Additional Constraints (API contracts) | Backend endpoints documented in `contracts/` before implementation | PASS |
| Additional Constraints (user vs internal errors) | Contracts define public error responses distinct from internal log detail | PASS |
| Tech Stack: Frontend React+TS | Vite + React 18 + TypeScript | PASS |
| Tech Stack: Backend Express.js | Express 4.x on Node 20 | PASS |
| Tech Stack: Database Firebase | Firestore for user profiles; Firebase Auth for identity | PASS |
| Tech Stack: Vinyl Data Source (Discogs) | Not applicable — this feature has no vinyl/release data | N/A |
| Tech Stack: Source control GitHub / Deployment Vercel | Existing repo on GitHub; backend deployed as Vercel Serverless Function, frontend as Vercel static build | PASS |
| Development Workflow: Conventional Commits | All task commits will follow `type: description` format | PASS |

No violations identified. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-landing-google-login/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── auth-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── config/
│   │   └── firebase-admin.ts     # Firebase Admin SDK initialization
│   ├── middleware/
│   │   └── requireAuth.ts        # Verifies Firebase ID token from Authorization header
│   ├── services/
│   │   └── userService.ts        # Get-or-create user profile in Firestore
│   ├── routes/
│   │   └── auth.ts               # /api/auth/session, /api/auth/me
│   └── app.ts                    # Express app wiring (routes, cors, error handling)
└── tests/
    ├── contract/
    │   └── auth.contract.test.ts
    ├── integration/
    │   └── auth.integration.test.ts
    └── unit/
        └── userService.test.ts

frontend/
├── src/
│   ├── components/
│   │   ├── LandingHero.tsx       # Value proposition, no-scroll layout
│   │   └── GoogleSignInButton.tsx
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   └── AuthenticatedPlaceholderPage.tsx
│   ├── services/
│   │   └── firebaseClient.ts     # Firebase app + Auth (GoogleAuthProvider) init
│   └── auth/
│       └── AuthContext.tsx       # Signed-in state, sign-in/sign-out actions
└── tests/
    ├── components/
    │   └── LandingHero.test.tsx
    ├── integration/
    │   └── signInFlow.test.tsx
    └── unit/
        └── AuthContext.test.tsx
```

**Structure Decision**: Web application layout (Option 2) with independent
`frontend/` and `backend/` projects, matching the constitution's separate
React+TypeScript frontend and Express.js backend requirement. Each has its own
`package.json`, test suite, and is deployed to Vercel as its own build target
(frontend as a static Vite build, backend as a Serverless Function reachable
under `/api/*`).

## Complexity Tracking

*No constitution violations — table intentionally omitted.*

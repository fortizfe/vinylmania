---

description: "Task list template for feature implementation"
---

# Tasks: Landing Page & Google Sign-In

**Input**: Design documents from `/specs/001-landing-google-login/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/auth-api.md](./contracts/auth-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED. The constitution's Principle I (Test-First,
NON-NEGOTIABLE) overrides the template default of "tests optional" — every
implementation task below is preceded by a test task that must be written and
failing first.

**Organization**: Tasks are grouped by user story (from spec.md) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description

## Path Conventions

Web application layout per [plan.md](./plan.md#project-structure):
`backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization for both the frontend and backend projects

- [X] T001 Create `frontend/` and `backend/` project directories at the repo root per [plan.md](./plan.md#project-structure)
- [X] T002 Initialize the frontend Vite + React 18 + TypeScript project in `frontend/` (`package.json`, `tsconfig.json`, `vite.config.ts`)
- [X] T003 Initialize the backend Express + TypeScript project in `backend/` (`package.json`, `tsconfig.json`, dev script via `ts-node-dev` or `nodemon`)
- [X] T004 [P] Configure ESLint + Prettier for `frontend/` (oxlint, Vite's scaffolded default, kept in place of ESLint; Prettier added for formatting)
- [X] T005 [P] Configure ESLint + Prettier for `backend/`
- [X] T006 [P] Add root `vercel.json` rewriting `/api/*` to the backend Serverless Function and defining the frontend static build output, per [research.md](./research.md#8-backend-deployment-shape-on-vercel)

**Checkpoint**: Both projects install and run an empty dev server/app.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Implement Firebase Admin SDK initialization in `backend/src/config/firebase-admin.ts`, reading `FIREBASE_SERVICE_ACCOUNT_KEY` and `FIREBASE_PROJECT_ID` per [quickstart.md](./quickstart.md#environment-variables)
- [X] T008 [P] Implement Firebase client SDK initialization in `frontend/src/services/firebaseClient.ts`, reading `VITE_FIREBASE_*` env vars and exporting the app instance + a `GoogleAuthProvider`
- [X] T009 [P] Implement structured logging utility in `backend/src/config/logger.ts` emitting `timestamp`, `route`, `outcome`, `uid` per [contracts/auth-api.md](./contracts/auth-api.md#observability-requirements-principle-v)
- [X] T010 Implement the Express app skeleton with `cors`, JSON body parsing, and centralized error-handling middleware in `backend/src/app.ts`, plus the entry point in `backend/src/server.ts` (depends on T007, T009)
- [X] T011 [P] Configure Vitest + React Testing Library for the frontend (`frontend/vitest.config.ts`, `frontend/tests/setup.ts`)
- [X] T012 [P] Configure Jest + Supertest + the Firebase Local Emulator Suite for the backend (`backend/jest.config.js`, `firebase.json` emulator config, `backend/tests/helpers/setupEnv.ts`)
- [X] T013 [P] Set up React Router and the app shell with `/` and `/app` routes in `frontend/src/App.tsx` and `frontend/src/main.tsx`

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Understand the app at a glance (Priority: P1) 🎯 MVP

**Goal**: A first-time visitor sees Vinylmania's purpose and the sign-in CTA
fully within the first viewport, with a simple, flat, modern layout — no
scrolling required.

**Independent Test**: Load the landing page on a fresh browser session at
common desktop and mobile widths and confirm the value proposition and CTA are
both visible without scrolling.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, and confirm they FAIL before implementation.

- [X] T014 [P] [US1] Component test: `LandingHero` renders the app's value-proposition copy, in `frontend/tests/components/LandingHero.test.tsx`
- [X] T015 [P] [US1] Integration test: `LandingPage` keeps hero copy and CTA inside a single-viewport layout container (no scroll wrapper) at a 375px and a 1440px width, in `frontend/tests/integration/landingLayout.test.tsx`

### Implementation for User Story 1

- [X] T016 [P] [US1] Create the `GoogleSignInButton` presentational component (visual only: accepts `onClick`/`loading`/`error` props) in `frontend/src/components/GoogleSignInButton.tsx`
- [X] T017 [P] [US1] Create the `LandingHero` component with flat/modern styling and the Vinylmania value-proposition copy in `frontend/src/components/LandingHero.tsx`
- [X] T018 [US1] Create `LandingPage` composing `LandingHero` + `GoogleSignInButton` in a single-viewport flex/grid layout, in `frontend/src/pages/LandingPage.tsx` (depends on T016, T017)
- [X] T019 [US1] Add flat/modern global styling (reset, typography, color tokens, full-viewport-height layout utility) in `frontend/src/styles/global.css`
- [X] T020 [US1] Wire `LandingPage` as the `/` route in `frontend/src/App.tsx` (depends on T013, T018)

**Checkpoint**: User Story 1 is fully functional and testable independently — the landing page communicates the app's purpose with a visible (not yet wired) sign-in CTA.

---

## Phase 4: User Story 2 - Sign in with Google (Priority: P1)

**Goal**: A visitor signs in with their Google account and is recognized as an
authenticated user, landing on a placeholder authenticated screen; returning
visitors are recognized automatically.

**Independent Test**: From the landing page, click "Sign in with Google",
complete the Google account chooser, and confirm the visitor is recognized as
authenticated and lands on the placeholder screen.

### Tests for User Story 2 ⚠️

> Write these tests FIRST, and confirm they FAIL before implementation.

- [X] T021 [P] [US2] Contract test for `POST /api/auth/session` (valid, missing, invalid token) per [contracts/auth-api.md](./contracts/auth-api.md#post-apiauthsession), in `backend/tests/contract/auth.contract.test.ts`
- [X] T022 [P] [US2] Contract test for `GET /api/auth/me` (valid token, missing token, no-profile-yet case) per [contracts/auth-api.md](./contracts/auth-api.md#get-apiauthme), in `backend/tests/contract/auth.contract.test.ts`
- [X] T023 [P] [US2] Integration test: get-or-create `User` against the Firestore emulator — first verified sign-in creates the `users/{uid}` doc with `createdAt`; a second verified sign-in reuses it and updates `lastSignInAt` — in `backend/tests/integration/auth.integration.test.ts`
- [X] T024 [P] [US2] Unit test for the `requireAuth` middleware (valid, malformed, missing, non-Bearer token) in `backend/tests/unit/requireAuth.test.ts`
- [X] T025 [P] [US2] Unit test for `AuthContext` sign-in flow and state transitions with a mocked Firebase Auth SDK, in `frontend/tests/unit/AuthContext.test.tsx`
- [X] T026 [P] [US2] Integration test for the full sign-in flow (click CTA → mocked Google popup resolves → session call → navigate to placeholder), in `frontend/tests/integration/signInFlow.test.tsx`

### Implementation for User Story 2

- [X] T027 [P] [US2] Implement the `User` get-or-create service against Firestore per [data-model.md](./data-model.md#user), in `backend/src/services/userService.ts`
- [X] T028 [US2] Implement the `requireAuth` middleware verifying the Firebase ID token via `firebase-admin`, in `backend/src/middleware/requireAuth.ts` (depends on T007, T024)
- [X] T029 [US2] Implement `POST /api/auth/session` and `GET /api/auth/me` with structured logging, in `backend/src/routes/auth.ts`; mount the router in `backend/src/app.ts` (depends on T027, T028, T009)
- [X] T030 [US2] Implement `AuthContext` (`signInWithPopup` + `GoogleAuthProvider`, calls `POST /api/auth/session`, exposes `user`/`loading`/`signingIn`/`error`, restores session on load via `GET /api/auth/me`; also includes `signOut` for type-cohesion with T036), in `frontend/src/auth/AuthContext.tsx` (depends on T008)
- [X] T031 [US2] Wire `GoogleSignInButton` to the `AuthContext` sign-in action with inline loading/error handling for cancel, deny, network-failure, and popup-blocked cases (FR-007, edge cases), in `frontend/src/pages/LandingPage.tsx` (depends on T016, T030)
- [X] T032 [US2] Create `AuthenticatedPlaceholderPage` showing the signed-in user's Google name and photo, in `frontend/src/pages/AuthenticatedPlaceholderPage.tsx` (depends on T030)
- [X] T033 [US2] Wire the `/app` route with auto-redirect logic (an already-authenticated visitor skips the landing page; a successful sign-in navigates to `/app`), in `frontend/src/App.tsx` (depends on T020, T030, T032)

**Checkpoint**: User Stories 1 AND 2 both work independently — real Google sign-in is functional end to end.

---

## Phase 5: User Story 3 - Sign out (Priority: P3)

**Goal**: A signed-in user can explicitly end their session and return to the
anonymous landing page.

**Independent Test**: While signed in, trigger sign-out and confirm the user
returns to the landing page as an anonymous visitor, and that reloading does
not restore the authenticated state.

### Tests for User Story 3 ⚠️

> Write these tests FIRST, and confirm they FAIL before implementation.

- [X] T034 [P] [US3] Unit test for the `AuthContext` `signOut` action clearing user state, in `frontend/tests/unit/AuthContext.test.tsx`
- [X] T035 [P] [US3] Integration test: from `AuthenticatedPlaceholderPage`, sign out returns to the anonymous landing page, and a reload does not restore the session, in `frontend/tests/integration/signOutFlow.test.tsx`

### Implementation for User Story 3

- [X] T036 [US3] Implement the `signOut` action (Firebase Auth `signOut()`) in `AuthContext`, in `frontend/src/auth/AuthContext.tsx` (implemented alongside T030 for type-cohesion; verified here by dedicated T034 test)
- [X] T037 [US3] Add a sign-out control to `AuthenticatedPlaceholderPage`, wired to the `AuthContext` `signOut` action (the `Navigate` guard in the same component sends a signed-out visitor back to `/`), in `frontend/src/pages/AuthenticatedPlaceholderPage.tsx` (depends on T032, T036)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and hardening across all user stories

- [X] T038 [P] Run the full manual validation script in [quickstart.md](./quickstart.md#validate-the-feature-end-to-end) across desktop and mobile viewport widths, including all edge cases (automated coverage done via T015/T026/T035; smoke-tested both dev servers boot and serve correctly — see completion notes for what still needs the user's real Firebase project and a real browser)
- [X] T039 [P] Add a local-setup section to the project README linking to [quickstart.md](./quickstart.md)
- [X] T040 Verify no secrets are committed and that `frontend/.env.local` and `backend/.env` are ignored, cross-checked against the root `.gitignore`
- [X] T041 Verify the Vercel project configuration (`vercel.json` rewrites, environment variables for both projects); added the missing `backend/api/index.ts` Serverless Function entry point that `vercel.json` referenced. Live preview deployment itself needs the user's Vercel account and was not run.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion only
- **User Story 2 (Phase 4)**: Depends on Foundational completion; reuses the `LandingPage`/`GoogleSignInButton` shell built in US1 (T016, T018, T020) but adds no new dependency on US1's tests
- **User Story 3 (Phase 5)**: Depends on Foundational completion and on `AuthContext`/`AuthenticatedPlaceholderPage` existing (built in US2, T030/T032) — cannot be implemented before US2
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories — independently testable as soon as Foundational is done
- **User Story 2 (P1)**: Builds its UI on top of the components US1 creates (shared files `LandingPage.tsx`, `GoogleSignInButton.tsx`), so in practice implement US1 first; its own independent test (real sign-in works) does not require US1's tests to exist
- **User Story 3 (P3)**: Depends on US2's `AuthContext` and `AuthenticatedPlaceholderPage` existing — must follow US2

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Principle I)
- Backend: services before middleware before routes
- Frontend: presentational components before pages before routing/wiring
- Story complete before moving to the next priority

### Parallel Opportunities

- Setup tasks T004, T005, T006 can run in parallel
- Foundational tasks T008, T009, T011, T012, T013 can run in parallel (different files); T007 and T010 are sequential prerequisites for backend work
- US1 tests T014/T015 can run in parallel; US1 components T016/T017 can run in parallel
- US2 tests T021–T026 can all run in parallel (different files); implementation T027 can run in parallel with the test tasks' setup but must follow them logically (write test, see it fail, then implement)
- US3 tests T034/T035 can run in parallel

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "Contract test for POST /api/auth/session in backend/tests/contract/auth.contract.test.ts"
Task: "Contract test for GET /api/auth/me in backend/tests/contract/auth.contract.test.ts"
Task: "Integration test for get-or-create User in backend/tests/integration/auth.integration.test.ts"
Task: "Unit test for requireAuth middleware in backend/tests/unit/requireAuth.test.ts"
Task: "Unit test for AuthContext sign-in flow in frontend/tests/unit/AuthContext.test.tsx"
Task: "Integration test for full sign-in flow in frontend/tests/integration/signInFlow.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: confirm the landing page communicates the app's purpose and shows the CTA without scrolling
5. Demo if ready — note that without US2, the CTA is not yet functional

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently → demo (landing shell only)
3. Add User Story 2 → validate independently → demo (real Google sign-in works — this is the first fully usable increment)
4. Add User Story 3 → validate independently → demo (sign-out completes the loop)
5. Polish → run quickstart validation, confirm secrets hygiene, verify Vercel deployment

---

## Notes

- [P] tasks touch different files and have no unmet dependencies
- [Story] labels map every implementation task back to spec.md's user stories
- Commit after each task or logical group, using Conventional Commits per the constitution
- Tests must fail before their corresponding implementation task is started
- Avoid: vague tasks, two tasks editing the same file in parallel, cross-story dependencies that break independent testability (beyond the noted US1→US2→US3 UI file reuse)

---

description: "Task list template for feature implementation"
---

# Tasks: End-to-End Testing Without Real Google Sign-In

**Input**: Design documents from `/specs/008-e2e-auth-testing/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/e2e-sign-in-helper.md, contracts/backend-test-command.md,
quickstart.md

**Tests**: Included for User Story 1, since the deliverable itself is a set
of automated tests (the e2e suite) — constitution Principle I (Test-First)
is honored by writing each spec file so it fails against the current,
unmodified `firebaseClient.ts` before the small emulator-opt-in change (T007)
makes it pass. User Story 2 has no *new* tests to write — its 74 target
tests already exist and already pass under `test:emulators` (confirmed
during specification); the fix is to the test *command*, not the code under
test, so its phase is verification-only.

**Organization**: Tasks are grouped by user story. User Story 1 (P1) and
User Story 2 (P2) are fully independent — one touches `e2e/` and
`frontend/src/services/firebaseClient.ts`, the other only touches
`backend/package.json` — so there are no shared blocking prerequisites
between them (Setup and Foundational phases below are intentionally empty).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Existing **web app** structure (`backend/`, `frontend/`), plus a new
top-level `e2e/` project (sibling to both) per plan.md's Project Structure
section.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: N/A — nothing is shared between the two stories' setup needs;
User Story 1's own scaffolding (the new `e2e/` project) is carried in its
phase below instead. This phase is intentionally empty.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A — the two stories are independent (see Organization above);
neither blocks the other. This phase is intentionally empty.

---

## Phase 3: User Story 1 - Automated end-to-end verification of the Google sign-in journey (Priority: P1) 🎯 MVP

**Goal**: A headless Playwright suite drives the real "Sign in with Google"
button against the Firebase Auth emulator's fake identity-provider popup,
proving the sign-in → session → authenticated-view → sign-out journey works,
without any real Google account or human interaction.

**Independent Test**: Run `cd e2e && npm test` from a clean checkout with no
supporting services already running; confirm it drives the real sign-in
trigger, reaches the authenticated view, and reports a clear pass/fail —
without opening a real Google account picker or requiring typed credentials
(spec.md User Story 1, Independent Test).

### Setup for User Story 1

- [X] T001 [P] [US1] Scaffold the new `e2e/` project: `e2e/package.json`
      (devDependencies `@playwright/test`, `firebase-tools`, `dotenv`; a
      `test` script wrapping `playwright test` in `firebase emulators:exec`)
      and `e2e/tsconfig.json`, per plan.md's Project Structure
- [X] T002 [US1] Create `e2e/playwright.config.ts` with a `webServer` array
      starting (1) the backend dev server (`npm run dev`, `cwd: '../backend'`,
      env `FIREBASE_PROJECT_ID=vinylmania-test`,
      `FIRESTORE_EMULATOR_HOST=localhost:8080`,
      `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`, ready at
      `GET http://localhost:3001/health`), and (2) the frontend dev server
      (`npm run dev`, `cwd: '../frontend'`, env
      `VITE_USE_FIREBASE_EMULATOR=true`, ready at `http://localhost:5173`);
      set `baseURL: 'http://localhost:5173'` and `reuseExistingServer:
      !process.env.CI` so a port conflict fails fast instead of silently
      reusing an unrelated process — per data-model.md §2 and research.md §2.
      The Firebase emulators are **not** a `webServer` entry — they're
      started by the wrapping `firebase emulators:exec` in T001's `test`
      script instead, per research.md §2's implementation note (a
      Playwright-managed `emulators:start` was found in practice to
      sometimes leave the Firestore emulator's JVM running after teardown)
      (depends on T001)

### Tests for User Story 1 ⚠️

> **NOTE**: Write these tests FIRST. They MUST fail at this point — the
> `signInAsFakeGoogleUser` helper they import does not exist yet, and
> `firebaseClient.ts` cannot yet reach the Auth emulator.

- [X] T003 [P] [US1] Write `e2e/tests/sign-in.spec.ts`: click the real
      "Sign in with Google" control, complete the emulator's fake-account
      flow via `signInAsFakeGoogleUser` (imported from
      `e2e/helpers/fakeGoogleSignIn.ts`), assert the app reaches `/app` with
      the Dashboard heading and a "Sign out" control visible — the
      authenticated-state signal `AuthenticatedLayout` only renders once a
      real session exists (the Dashboard itself is feature 007's
      under-construction placeholder and doesn't render the user's name) —
      per contracts/e2e-sign-in-helper.md and spec.md User Story 1
      Acceptance Scenario 1
- [X] T004 [P] [US1] Write `e2e/tests/returning-session.spec.ts`: sign in
      via the helper, reload the page, assert the user is still recognized
      as signed in (no landing/login state shown) — per spec.md User Story 1
      Acceptance Scenario 2
- [X] T005 [P] [US1] Write `e2e/tests/sign-out.spec.ts`: sign in via the
      helper, trigger sign-out, assert the app returns to the anonymous
      landing state, then reload and assert the session is not restored —
      per spec.md User Story 1 Acceptance Scenario 3
- [X] T006 [P] [US1] Write `e2e/tests/sign-in-cancelled.spec.ts`: click the
      real "Sign in with Google" control, close the resulting popup without
      completing the fake-account flow, assert the app shows its existing
      friendly cancelled-sign-in message (the `auth/popup-closed-by-user`
      path already handled in `frontend/src/auth/AuthContext.tsx`) rather
      than a stuck loading state — per spec.md Edge Cases

### Implementation for User Story 1

- [X] T007 [US1] Add an opt-in Firebase Auth emulator connection in
      `frontend/src/services/firebaseClient.ts`: when
      `import.meta.env.VITE_USE_FIREBASE_EMULATOR` is truthy, call
      `connectAuthEmulator(firebaseAuth, 'http://localhost:9099')`
      immediately after `getAuth(firebaseApp)`; leave all other
      initialization untouched so ordinary local dev/production builds are
      unaffected — per research.md §4 (depends on T002 for the env var it
      reads)
- [X] T008 [US1] Implement `signInAsFakeGoogleUser(page, options?)` in
      `e2e/helpers/fakeGoogleSignIn.ts` per contracts/e2e-sign-in-helper.md:
      click the real sign-in control, await the popup via
      `page.waitForEvent('popup')`, drive the emulator's "Add new account"
      fixture flow using `options.displayName`/`options.email` (with
      scenario defaults per data-model.md §1), wait for the popup to close
      and the authenticated view to appear, and reject with a step-naming
      error (popup-never-appeared / popup-never-closed /
      authenticated-state-never-appeared) on timeout (depends on T002, T007)
- [X] T009 [US1] Run `e2e/tests/sign-in.spec.ts`,
      `returning-session.spec.ts`, `sign-out.spec.ts`, and
      `sign-in-cancelled.spec.ts` (T003–T006) and confirm all four now pass
      (green), with the sign-in/session assertions verified to be driven by
      real `POST /api/auth/session` / `GET /api/auth/me` calls rather than
      any mock, per contracts/e2e-sign-in-helper.md's non-goals (depends on
      T003, T004, T005, T006, T008) — confirmed: all 4 passed on first run
      against the real backend/frontend/emulator stack
- [X] T010 [P] [US1] Write `e2e/README.md` documenting prerequisites (Node,
      Firebase CLI, `npx playwright install`) and how to run the suite
      locally, per FR-007 and quickstart.md
- [X] T011 [US1] Run `npm test` in `e2e/` three times back-to-back and
      confirm identical passing results each time, with no leftover fixture
      accounts/state carried between runs, per FR-006 and SC-002 (depends on
      T009) — found and fixed a real issue: a Playwright-managed
      `emulators:start` left the Firestore JVM running after teardown,
      breaking the next run; switched to `firebase emulators:exec` wrapping
      the whole suite (T001/T002 updated accordingly). Confirmed clean
      across 3 consecutive runs after the fix.

**Checkpoint**: User Story 1 is fully functional and independently
verifiable — the Google sign-in journey now has automated, unattended
coverage with no real Google account involved.

---

## Phase 4: User Story 2 - A trustworthy, self-contained backend test command (Priority: P2)

**Goal**: `npm test` in `backend/` passes all 74 existing tests on its own,
from a clean checkout, with no undocumented manual step (starting the
Firebase emulators) required first.

**Independent Test**: From a clean checkout, `cd backend && npm install &&
npm test` passes with no failures caused by missing supporting
infrastructure (spec.md User Story 2, Independent Test).

### Implementation for User Story 2

- [X] T012 [US2] Update `backend/package.json`: change the `"test"` script
      to wrap the existing Jest invocation with
      `firebase emulators:exec --only auth,firestore "cross-env
      NODE_ENV=test jest"`, and remove the now-redundant `"test:emulators"`
      script (its behavior is now what `"test"` does) — per research.md §3
      and contracts/backend-test-command.md
- [X] T013 [US2] From a terminal with no emulators already running, run
      `npm test` in `backend/` and confirm all 74 tests pass with no
      `fetch failed` errors (depends on T012) — confirmed
- [X] T014 [US2] Run `npm test` in `backend/` a second consecutive time and
      confirm an identical, fully-passing result (no flakiness), per SC-004
      (depends on T013) — confirmed, 74/74 both times

**Checkpoint**: User Stories 1 AND 2 both work independently — the sign-in
journey has automated coverage, and the backend's standard test command is
self-contained and trustworthy on its own.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final acceptance validation spanning both
stories.

- [X] T015 [P] Update the root `README.md` Testing section (lines 43–47):
      remove the "(needs the Firebase emulators running)" caveat and the
      separate `npm run test:emulators` line for `backend` (no longer
      needed after T012), and add a new line documenting
      `cd e2e && npm test` for the end-to-end suite, per FR-007 (depends on
      T009, T012 for accurate wording)
- [X] T016 Run the full quickstart.md clean-checkout validation sequence in
      order — `backend` (`npm install && npm test`), `frontend`
      (`npm install && npm test`), `e2e` (`npm install && npx playwright
      install && npm test`) — using only documented steps, confirming
      SC-001 through SC-005 all hold (depends on all prior tasks) —
      confirmed: backend 74/74, frontend 74/74, e2e 4/4, all green

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Empty — no dependencies.
- **Foundational (Phase 2)**: Empty — no dependencies.
- **User Story 1 (Phase 3)**: Can start immediately. No dependency on User
  Story 2.
- **User Story 2 (Phase 4)**: Can start immediately, in parallel with User
  Story 1. No dependency on User Story 1.
- **Polish (Phase 5)**: Depends on both User Story 1 (T009) and User Story 2
  (T012) for T015's accuracy, and on everything for T016's full-sequence
  validation.

### Within User Story 1

T001 → T002 → {T003, T004, T005, T006 in parallel} → T007 → T008 → T009 →
{T010, T011 in parallel}

(T007 also needs T002; T008 needs T002 and T007; T009 needs T003–T006 and
T008)

### Within User Story 2

T012 → T013 → T014

### Parallel Opportunities

- T003, T004, T005, T006 (all four e2e spec files) can be written in
  parallel — different files, same (not-yet-existing) dependency.
- T010 (README) can run in parallel with T011 (flakiness check) once T009
  is done.
- User Story 1's entire phase (T001–T011) can run in parallel with User
  Story 2's entire phase (T012–T014) — they touch disjoint files
  (`e2e/**`, `frontend/src/services/firebaseClient.ts` vs.
  `backend/package.json`).
- T015 (Polish) is independent of T016 until T016's final full-sequence run.

---

## Parallel Example: User Story 1

```bash
# After T001–T002 (scaffold + config), launch all four spec files together:
Task: "Write e2e/tests/sign-in.spec.ts"
Task: "Write e2e/tests/returning-session.spec.ts"
Task: "Write e2e/tests/sign-out.spec.ts"
Task: "Write e2e/tests/sign-in-cancelled.spec.ts"
```

## Parallel Example: Both Stories

```bash
# User Story 1 and User Story 2 touch disjoint files and can proceed together:
Task: "T001-T011: e2e/ project + frontend/src/services/firebaseClient.ts"
Task: "T012-T014: backend/package.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1 (T001–T011).
2. **STOP and VALIDATE**: `cd e2e && npm test` passes on its own.
3. This alone closes the higher-priority, harder-won gap (the Google
   sign-in blocker) even before touching the backend test command.

### Incremental Delivery

1. User Story 1 (T001–T011) → validate → the sign-in journey now has
   automated, unattended coverage.
2. User Story 2 (T012–T014) → validate → `backend`'s `npm test` is
   self-contained.
3. Polish (T015–T016) → documentation matches reality, full clean-checkout
   sequence confirmed.

### Parallel Team Strategy

With two developers: one takes User Story 1 (T001–T011, frontend + new
`e2e/` project), the other takes User Story 2 (T012–T014, `backend/`) — no
shared files, so both can finish and be reviewed independently before Polish.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- T003–T006 will fail to even compile until T008 exists (missing helper
  import) — that is the expected Red state; do not skip writing them first.
- Commit after each task or logical group.
- Stop at either story's checkpoint to validate it independently before
  moving on.

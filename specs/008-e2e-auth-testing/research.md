# Phase 0 Research: End-to-End Testing Without Real Google Sign-In

## 1. How to simulate Google sign-in without touching real Google infrastructure

**Decision**: Use the Firebase Local Emulator Suite's built-in fake identity-provider flow. When the frontend's Firebase Auth client is connected to the Auth emulator (`connectAuthEmulator`) and `signInWithPopup(auth, new GoogleAuthProvider())` is called, the emulator intercepts the request and opens its own local "sign in with Google.com (test mode)" popup (served by the emulator itself, not by Google) instead of the real Google OAuth screen. That popup lets a caller pick "Add new account," type a fake display name/email/photo, and complete sign-in — producing a real, validly-signed Firebase ID token, through the exact same `signInWithPopup` call the production code already makes.

**Rationale**:
- Exercises FR-001/FR-002 exactly: the same trigger (`signInWithPopup` in [AuthContext.tsx](../../frontend/src/auth/AuthContext.tsx)), the same session-establishment call (`POST /api/auth/session`), and the same resulting authenticated state — with zero production code changes to the sign-in logic itself.
- Never contacts Google's real servers, so there's no real account, no bot-detection/CAPTCHA wall, and no risk of Google flagging or rate-limiting the project (FR-005).
- The project already relies on the Auth emulator for the backend's contract/integration tests ([tests/helpers/authEmulator.ts](../../backend/tests/helpers/authEmulator.ts)), and the constitution's Technology Stack rationale already names "Firebase emulator for integration tests" as the expected pattern — this extends the same trusted mechanism to the browser layer instead of introducing a new one.
- The frontend already ships a `.env.test` with a matching `vinylmania-test` project id (from feature 001), so no new test-project provisioning is required.

**Alternatives considered**:
- *Minting a custom token via the Admin SDK and injecting it directly into browser storage, skipping the popup entirely.* Rejected as the primary mechanism because it never exercises the real "Sign in with Google" button or the popup-driven trigger — it would satisfy "the user ends up signed in" but not FR-002's requirement that the same trigger/session path be verified. It remains a valid *future* optimization for tests that only need an already-authenticated starting state (out of scope here per the spec's Assumptions).
- *Recording/replaying a real Google OAuth session (e.g., a saved cookie/session fixture from a real test Google account).* Rejected: real accounts still risk Google's automation detection and lockouts, need secret storage for real credentials, and go stale whenever Google changes its login UI — the opposite of a stable, self-contained suite.
- *A dedicated third-party "social login testing" service/proxy.* Rejected: adds an external dependency and (for most such services) cost or network flakiness, when Firebase already ships an equivalent capability for free, locally, with no network dependency.

## 2. Which end-to-end test tool to drive the browser

**Decision**: Playwright Test (`@playwright/test`).

**Rationale**:
- The Google/emulator sign-in flow opens a **second browser window** (the popup) at a different origin (`localhost:9099`) than the app (`localhost:5173`). Playwright has first-class, built-in support for this: `page.waitForEvent('popup')` returns a full `Page` object for the popup that can be interacted with directly, and each `Page` can navigate distinct origins with no special-casing.
- Playwright ships a `webServer` config option that can start and health-check multiple long-running processes before the suite runs and tear them all down after — this satisfies FR-003 (fully unattended) without pulling in a separate process-orchestration dependency, keeping with the constitution's Simplicity/YAGNI principle.
- Runs headless by default and produces a single pass/fail exit code plus traces/screenshots on failure, which satisfies FR-003's "unattended" requirement and gives the actionable failure detail FR-004's edge cases ask for.
- TypeScript-native, matching the rest of the codebase's required stack.

**Implementation note (found during T009–T011)**: the Firebase emulators
themselves are *not* one of Playwright's `webServer` entries, even though
that was the original plan. A Playwright-managed `firebase emulators:start`
process was observed, in repeated back-to-back runs, to sometimes leave the
Firestore emulator's underlying JVM child process running after Playwright
sent its shutdown signal — reliably reproducible by running the suite
several times in a row with no gap, causing the next run's Firestore
emulator to fail to bind its port. `firebase emulators:exec` (the same
mechanism [contracts/backend-test-command.md](./contracts/backend-test-command.md)
uses) does not have this problem — it owns the emulators' full lifecycle
itself and explicitly confirms each emulator's shutdown before exiting.
`e2e/package.json`'s `test` script now wraps the whole `playwright test`
invocation in `firebase emulators:exec`, and Playwright's `webServer` array
only starts the backend and frontend dev servers against the
already-running emulators. Confirmed clean (no leftover process, no port
conflict) across 3 consecutive runs.

**Alternatives considered**:
- *Cypress.* Historically restrictive with cross-origin, multi-window flows (only recently, and still partially, supported via `cy.origin()`); driving a genuine popup window at a different origin — exactly what the emulator's fake-IdP flow requires — is significantly more friction than Playwright's native multi-page API. Also lacks a built-in equivalent to `webServer` for orchestrating three dependent processes; would need an added `start-server-and-test`-style dependency to match what Playwright provides out of the box.
- *A lower-level tool (raw Puppeteer, WebdriverIO).* Rejected: more assembly required (no built-in test runner, reporter, or web-server orchestration), for no capability this feature needs beyond what Playwright Test already provides.

## 3. Why the backend's plain `npm test` fails today

**Finding** (confirmed by running both commands during specification): `npm test` (`cross-env NODE_ENV=test jest`) fails 42 of 74 tests, every failure being `TypeError: fetch failed` originating in [tests/helpers/authEmulator.ts](../../backend/tests/helpers/authEmulator.ts) or Firestore-backed code paths. Running `npm run test:emulators` (`firebase emulators:exec --only auth,firestore "npm test"`) instead passes all 74/74. The only difference between the two commands is whether the Auth (`:9099`) and Firestore (`:8080`) emulators are running — there is no application-code bug.

**Decision**: Make the emulator-backed run the definition of `npm test` itself, rather than a separate opt-in script, so the standard command developers and CI would naturally reach for is the one that works (FR-008/FR-009/FR-011).

**Rationale**: `firebase emulators:exec` already does exactly what's needed — starts the emulators, runs the wrapped command, tears the emulators down, and propagates the wrapped command's exit code — and is already a proven, working path in this repo (`test:emulators`). Consolidating avoids maintaining two overlapping scripts (violates Simplicity/YAGNI) and removes the foot-gun of a "test" command that silently depends on an undocumented prerequisite.

**Alternatives considered**:
- *Leave `npm test` as-is and only document that `test:emulators` is the "real" command.* Rejected: documentation is easy to miss (as this very bug shows — nothing today tells a developer why `npm test` fails), and CI systems and habit both default to `npm test`.
- *Add a `pretest` npm lifecycle script that starts the emulators in the background and a `posttest` that stops them.* Rejected in favor of wrapping with `firebase emulators:exec`: that command already handles readiness-waiting and guaranteed teardown (including on test failure) as a single atomic step; a manual `pretest`/`posttest` pair would have to reimplement that readiness/teardown handling itself.

## 4. Wiring the frontend to the Auth emulator without touching production behavior

**Finding**: [firebaseClient.ts](../../frontend/src/services/firebaseClient.ts) currently always initializes against whatever `VITE_FIREBASE_*` config is loaded — it never calls `connectAuthEmulator`, so today, even loading `.env.test`'s fake project config would make real (and failing) network calls to Google's identity endpoints, not the emulator.

**Decision**: Add an explicit, opt-in emulator connection (guarded by a dedicated environment flag, e.g. `VITE_USE_FIREBASE_EMULATOR`) so the emulator is only ever used when that flag is deliberately set for an e2e run — never in ordinary local development or production builds.

**Rationale**: Directly closes the edge case in the spec ("accidentally pointed at the real, production Firebase project") by requiring an explicit opt-in rather than inferring emulator use from `NODE_ENV`/`MODE` alone (which can be ambiguous across Vite modes). Minimal, additive change to existing, already-tested code — consistent with Simplicity/YAGNI.

**Alternatives considered**: Branching on `import.meta.env.DEV` alone — rejected because that's also true for ordinary local development against a real Firebase project, which is exactly the accidental-production-hit scenario the spec calls out to prevent.

## Outstanding NEEDS CLARIFICATION

None. All Technical Context unknowns are resolved above.

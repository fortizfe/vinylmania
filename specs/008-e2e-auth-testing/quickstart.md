# Quickstart: End-to-End Testing Without Real Google Sign-In

## Prerequisites

- Node.js and npm installed (matching versions already used by `backend`/`frontend`).
- The Firebase CLI available (already a `backend` devDependency — no global
  install required if run via `npx`/`npm run`).
- No other process already bound to ports `9099` (Auth emulator), `8080`
  (Firestore emulator), `3001` (backend), or `5173` (frontend) — see contracts
  for the fail-fast behavior if one is.

No real Firebase project, no real Google account, and no secrets are needed
for anything below — every command runs entirely against local emulators and
fixture data.

## Validate the backend test fix (User Story 2)

```bash
cd backend
npm install
npm test
```

**Expected outcome**: all 74 tests pass, with no `fetch failed` errors,
using only this one command — no separate "start the emulators first" step.

Run it twice in a row to confirm SC-002/SC-004's non-flakiness: both runs
should pass identically.

## Validate the end-to-end sign-in suite (User Story 1)

```bash
cd e2e
npm install
npx playwright install   # one-time browser download
npm test
```

This single command starts the Firebase emulators (via `firebase
emulators:exec`), then the backend dev server (pointed at those emulators)
and the frontend dev server (with the emulator opt-in flag set), waits for
all three to be ready, runs the suite headlessly, and tears everything down
— see [data-model.md](./data-model.md#2-e2e-environment-the-three-processes-a-run-depends-on).

**Expected outcome**, mapped to the spec's acceptance scenarios:

1. **Sign-in (US1, AC1)**: the suite clicks the real "Sign in with Google"
   button, completes the emulator's fake-account flow (no real Google popup,
   no real credentials), and asserts the app reaches its authenticated view
   showing the fixture user's name.
2. **Returning session (US1, AC2)**: within the same suite run, a reload of
   the signed-in page is asserted to still show the authenticated view.
3. **Sign-out (US1, AC3)**: triggering sign-out is asserted to return to the
   anonymous landing view, and a subsequent reload is asserted to stay
   anonymous.
4. **Broken login surfaces clearly (US1, AC4)**: (manual check, optional) —
   temporarily point the frontend at a wrong `VITE_API_BASE_URL` and re-run;
   confirm the suite fails with a specific message naming the session step,
   not a generic timeout.

Run the suite a few times back-to-back to confirm SC-002's non-flakiness and
FR-006's clean-state guarantee (no leftover fixture accounts affecting the
next run).

## Full readiness check (SC-005)

From a fully clean checkout, in order:

```bash
cd backend && npm install && npm test
cd ../frontend && npm install && npm test
cd ../e2e && npm install && npx playwright install && npm test
```

All three MUST pass using only the steps above and this document — if any
step requires undocumented tribal knowledge to pass, that's a gap to close
before this feature is considered done.

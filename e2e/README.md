# Vinylmania End-to-End Tests

Drives the real app (real frontend, real backend, real Firebase SDK calls)
through a browser with [Playwright](https://playwright.dev/), including the
"Sign in with Google" journey — without ever touching a real Google account.
See [`specs/008-e2e-auth-testing`](../specs/008-e2e-auth-testing/) for the
full research and design behind this project.

## How Google sign-in works here

The frontend connects to the Firebase **Auth emulator** (only when
`VITE_USE_FIREBASE_EMULATOR=true`, which this suite sets — never in normal
`npm run dev` or in production). The emulator intercepts `signInWithPopup`
and opens its own local "fake identity provider" popup instead of a real
Google OAuth screen. [`helpers/fakeGoogleSignIn.ts`](./helpers/fakeGoogleSignIn.ts)
drives that popup (click "Add new account", fill email/display name, submit)
the same way a human tester would — everything else (the real "Sign in with
Google" button, the real `POST /api/auth/session` call, the real
authenticated view) is exactly the production code path.

## Prerequisites

- Node.js and npm (matching `backend`/`frontend`).
- The Firebase CLI — already available via `backend`'s `firebase-tools`
  devDependency (invoked here through `npx`, from the `backend` directory).
- Ports `9099` (Auth emulator), `8080` (Firestore emulator), `3001`
  (backend), and `5173` (frontend) free — nothing else needs to be running
  first.

No real Firebase project, Google account, or secret is required.

## Running the suite

```bash
cd e2e
npm install
npx playwright install chromium   # one-time browser download
npm test
```

`npm test` wraps the whole run in `firebase emulators:exec` (see
`package.json`), which starts the Firebase emulators, then runs
`playwright test`, which in turn starts the backend dev server (pointed at
those emulators) and the frontend dev server (with the emulator opt-in flag
set) — see `playwright.config.ts`'s `webServer` array — waits for both to be
ready, and runs the suite headlessly. `emulators:exec` tears the emulators
down again once `playwright test` exits, whatever the result.

Run it more than once in a row to check for flakiness; each run starts a
fresh emulator instance, so no fixture data carries over between runs.

### Fail-fast behavior

`npm test` no longer relies solely on `emulators:exec` and Playwright's
per-test timeout to bound the run (see
[`specs/042-firebase-emulator-reliability`](../specs/042-firebase-emulator-reliability/),
which fixed a real incident where a run stalled silently for 3+ minutes and
even a manual `Ctrl+C` didn't shut down cleanly):

- A `pretest` step checks the fixed Auth/Firestore emulator ports aren't
  already held by a concurrent `backend`/`e2e` run, and fails fast if so.
- The whole `emulators:exec ...` invocation is bounded by
  `../scripts/run-with-timeout.js` — this covers emulator startup and the
  three `webServer` processes starting up, which happens *before*
  Playwright's own `globalTimeout` clock starts.
- `playwright.config.ts` sets an explicit `timeout` (per test) and
  `globalTimeout` (whole run).
- Both the wrapper and a manual `Ctrl+C` escalate `SIGTERM` → `SIGKILL` on
  the full process group after a short grace period, so Firebase CLI's own
  shutdown routine can't hang the terminal indefinitely.

**First run on a new machine**: pre-warm the Firestore emulator's binary
cache once before relying on the bounded `npm test` — see the equivalent
note in [`backend/README.md`](../backend/README.md#testing).

## What's covered

- `tests/sign-in.spec.ts` — first-time sign-in reaches the authenticated
  Dashboard.
- `tests/returning-session.spec.ts` — a reload after signing in stays
  signed in.
- `tests/sign-out.spec.ts` — signing out returns to the anonymous landing
  page, and a reload doesn't restore the session.
- `tests/sign-in-cancelled.spec.ts` — closing the sign-in popup without
  completing it shows the app's existing friendly retry message instead of
  a stuck loading state.

## Debugging a failure

Playwright saves a trace and screenshot for any failing test (see
`playwright.config.ts`'s `use` block). After a failing run:

```bash
npx playwright show-report
```

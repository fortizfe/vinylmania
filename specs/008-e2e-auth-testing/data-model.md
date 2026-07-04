# Phase 1 Data Model: End-to-End Testing Without Real Google Sign-In

This feature introduces no domain data, storage, or API schema changes — it
does not touch what Vinylmania persists about a collector or their library.
Its "model" is the test/process vocabulary shared by the end-to-end suite and
the corrected backend test command. This document is the shared vocabulary
for the Phase 2 tasks.

## 1. Fake Test Identity

A throwaway Google-shaped identity minted by the Auth emulator's fake
identity-provider flow for a single e2e run — not a real Google account, and
not persisted domain data.

| Field | Value |
|---|---|
| `displayName` | Fixture value chosen per test scenario (e.g., `"E2E Test User"`) |
| `email` | Fixture value scoped to the emulator project (e.g., `e2e-user@example.com`) |
| `photoURL` | Optional fixture value; not required for the flow to succeed |
| `idToken` | Real, validly-signed Firebase ID token issued by the Auth emulator for this fake identity — the same shape [requireAuth](../../backend/src/middleware/requireAuth.ts) already verifies |
| Lifetime | Created at the start of a scenario, discarded (emulator state reset) at the end — never reused across runs (FR-006) |

## 2. E2E Environment (the three processes a run depends on)

| Process | Source | Readiness signal | Notes |
|---|---|---|---|
| Firebase emulators (Auth `:9099`, Firestore `:8080`) | `backend/firebase.json`, started via `firebase emulators:exec` wrapping the whole `playwright test` run (`e2e/package.json`'s `test` script) | `emulators:exec` blocks until both are up before running the wrapped command | Started by the npm script itself, not by Playwright's `webServer` — see research.md §2's implementation note: a plain, Playwright-managed `emulators:start` left the Firestore emulator's underlying JVM running after teardown in practice; `emulators:exec` (the same mechanism the backend's Jest suite uses) tears it down reliably |
| Backend dev server | `backend`, started via Playwright's `webServer`, with `FIREBASE_PROJECT_ID`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST` pointed at the emulators above | `GET /health` → `200` | No backend code change required — the Admin SDK already honors these env vars via [firebase-admin.ts](../../backend/src/config/firebase-admin.ts) |
| Frontend dev server | `frontend`, started via Playwright's `webServer`, with the emulator opt-in flag set (see research.md §4) and `.env.test`'s `vinylmania-test` project config | `GET /` → reachable | Only variant from normal `npm run dev`: the emulator opt-in flag |

## 3. Backend Test Run (corrected)

| Field | Value |
|---|---|
| Command | `npm test` (backend) |
| Wraps | `firebase emulators:exec --only auth,firestore "<jest invocation>"` |
| Prerequisite services | Same Auth/Firestore emulators as above, started and torn down automatically by the wrapping command |
| Pass condition | All 74 existing tests pass, unchanged in behavior/coverage (FR-010) |

No state transitions apply — all three concepts above are ephemeral,
recreated from scratch on every run and discarded afterward (FR-006).

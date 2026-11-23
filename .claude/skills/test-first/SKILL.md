---
name: test-first
description: Vinylmania Test-First workflow (constitution §I, non-negotiable) — picking the right test layer (backend unit/integration/contract, frontend Vitest+RTL, Playwright e2e, Flutter unit/widget/integration_test), the helpers that already exist for each, the commands to run one file, and the local gotchas (Firebase emulators, Redis, DISCOGS_TOKEN, port clashes). Use before implementing any feature or bug fix, when writing or fixing tests, or when a test fails only locally.
---

# Test-first — Vinylmania

Red → Green → Refactor. The failing test exists, and fails *for the right
reason*, before the implementation line that satisfies it. A bug fix starts
with a test that reproduces the bug.

## Pick the cheapest layer that proves the behavior

| Behavior | Layer | Where | Run one |
|---|---|---|---|
| Domain rule, use case with faked ports, pure util | backend unit | `backend/tests/unit/<domain>/` | `cd backend && npx jest tests/unit/<path>` (no emulators) |
| Adapter against Firestore/Auth emulator | backend integration | `backend/tests/integration/<domain>/` | `cd backend && npm test -- tests/integration/<domain>` |
| HTTP contract of an endpoint (status, body shape, errors) | backend contract | `backend/tests/contract/<domain>/` | `cd backend && npm test -- tests/contract/<domain>` |
| Component behavior, states, a11y names, keyboard | frontend component/unit | `frontend/tests/{components,unit}/` or colocated `*.test.tsx` | `cd frontend && npx vitest run <file>` |
| Page flow across components + queries | frontend integration | `frontend/tests/integration/` | `cd frontend && npx vitest run <file>` |
| Real browser only: layout per viewport, contrast, motion, focus, OAuth redirect, cross-component journeys | e2e | `e2e/tests/*.spec.ts` | `cd e2e && npm test -- tests/<file>.spec.ts` |
| Flutter ViewModel, repository, model, service (`MockClient`) | flutter unit | `flutter_app/test/` mirroring `lib/` | `cd flutter_app && flutter test test/<path>_test.dart` |
| Flutter widget: states × compact/expanded × a11y guidelines | flutter widget | `flutter_app/test/ui/…` | same |
| Flutter flow across screens on a real device/desktop | flutter integration | `flutter_app/integration_test/` | `flutter test integration_test/<file>_test.dart -d <device>` |

Don't push to e2e what a unit test proves; don't unit-test what only a real
browser can show (computed contrast, viewport layout, the Google redirect).

## Reuse the helpers

- **Backend**: `tests/helpers/nock.ts` (`discogsScope()`, `stubCollectionPage`, `rawCollectionInstance`, …) for Discogs; `authEmulator.ts` (`getTestIdToken`, `clearEmulatorUsers`, `clearEmulatorFirestore`); `testSession.ts` (`createTestSession(uid)`). Use cases: plain in-memory objects implementing the port — no nock needed.
- **Frontend**: `tests/testUtils.tsx` (`renderWithQueryClient`, `createTestQueryClient`, `build*SearchResult` / `build*LibraryEntry`). Query by role/label, not classes or test ids, unless a test already established one.
- **E2E**: `e2e/helpers/` — `axe.ts`, `contrast.ts`, `focusRing.ts`, `press.ts`, `motion.ts`, `theme.ts`, `columnLayout.ts`, OAuth stubs (`googleOauthStub`, `discogsOauthStub`, `fakeGoogleSignIn`), `libraryFixture.ts`.
- **Flutter**: hand-written fakes via `implements` (no mocking package), `package:http/testing.dart` `MockClient`, `meetsGuideline(...)` a11y checks — see `flutter-architecture` / `flutter-design`.
- Architecture guards already exist: `frontend/tests/unit/architecture/*` (motion import boundary, no inline motion, focus-ring consistency). Don't duplicate them.

## Rules

- Deterministic: no real network (nock / mocked `apiClient`), no order dependence, no shared mutable state, no sleeps — wait on conditions.
- Cover the edges the spec names: empty, partial Discogs data, `rate_limited` / `unavailable`, unauthenticated, not-linked (409 `discogs_not_linked`).
- Assert what *should* happen (from the spec/contract), not what the code happens to do.
- Flaky test → fix the isolation cause; never add retries or bigger timeouts as the fix.
- Ponytail applies to tests too: no fixture factories for one test, no suite per function when one behavior test covers it.

## Local gotchas

- Don't run backend and e2e suites concurrently — `pretest` fails if emulator ports (auth 9099, firestore 8080) are held. Kill stale emulators first.
- Don't block on the full backend suite mid-implementation; run targeted files, leave the full run to the end or CI.
- E2E loads `backend/.env` → Redis must be on its `REDIS_URL` or every test fails at sign-in with `internal_error`:
  `redis-server --daemonize yes --save "" --appendonly no`.
  A local-only failure on Discogs data is usually stale `discogs:release:*` keys → `redis-cli --scan --pattern 'discogs:release:*' | xargs redis-cli del`.
- `discogsSearch.contract.test.ts` needs `DISCOGS_TOKEN` exported in the shell:
  `export $(grep "^DISCOGS_TOKEN=" backend/.env | xargs)`.

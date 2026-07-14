---

description: "Task list for Backend & E2E Test Suite Firebase Emulator Reliability"
---

# Tasks: Backend & E2E Test Suite Firebase Emulator Reliability

**Input**: Design documents from `/specs/042-firebase-emulator-reliability/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included where the change is real, executable logic (the shared timeout
wrapper, the emulator-call timeout, the Redis neutralization). Config-only
changes (`testTimeout`, `--detectOpenHandles`/`--forceExit`, Playwright
`timeout`/`globalTimeout`, `timeout-minutes`) are validated manually via
`quickstart.md`'s deliberate-failure-injection steps instead of a permanent
automated test, consistent with the Constitution Check's Test-First
adaptation documented in `plan.md` — self-referential automated tests for
"does the test runner's own timeout config work" add fragility without
real regression value.

**Organization**: Tasks are grouped by user story (US1, US2, US3 — matching
spec.md's Historia 1/2/3) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Setup and Foundational tasks carry no story label — they're shared prerequisites

## Path Conventions

Existing web-application layout, unchanged: `backend/`, `frontend/` (untouched
by this feature), `e2e/`, `scripts/` (root-level, existing `scripts/release/`
precedent), `.github/workflows/ci.yml`.

---

## Phase 1: Setup

**Purpose**: Scaffold the one new shared file this feature introduces

- [X] T001 [P] Create `scripts/run-with-timeout.js` with CLI argument parsing only (`node scripts/run-with-timeout.js <maxSeconds> -- <command> [args...]`) — no process-spawning logic yet, just argument validation and a `TODO`-free stub that exits non-zero on malformed args. This establishes the CLI contract Foundational tests (T002) will exercise.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared cross-platform timeout wrapper both User Story 1 (backend) and User Story 2 (e2e) wrap their `emulators:exec` invocations with (see research.md §3/§7/§9 — chosen over the POSIX `timeout` coreutil specifically because it isn't available by default on macOS, this project's confirmed local dev platform)

**⚠️ CRITICAL**: US1's T009 and US2's T014 cannot be completed until T003 is done

- [X] T002 [P] Write failing tests for `scripts/run-with-timeout.js` in `scripts/__tests__/run-with-timeout.test.js` (Node's built-in test runner via `node --test`, matching the existing `scripts/release/__tests__/*.test.js` convention already used by this repo's release tooling). Cover: (a) exits 0 and forwards output when the wrapped command exits 0 before the limit; (b) exits non-zero with a message that names both the wrapped command and the configured limit when it doesn't finish in time; (c) after the wrapped command ignores an initial `SIGTERM`, the wrapper escalates to `SIGKILL` of the child's full process group within a short, fixed grace period (spawn a child that traps `SIGTERM` and never exits, assert it's gone within the grace window).
- [X] T003 Implement the spawn/timeout/`SIGTERM`→`SIGKILL`-escalation logic in `scripts/run-with-timeout.js` to make T002 pass (depends on: T001, T002).
- [X] T004 [P] Extend the repo's script-test glob so the new suite runs alongside the existing release-script tests: update the `test` script in `package.json` (root) and the "Run release script tests" step in `.github/workflows/ci.yml` from `scripts/release/__tests__/*.test.js` to `scripts/__tests__/*.test.js scripts/release/__tests__/*.test.js` (space-separated, not `**` — `/bin/sh` has no globstar support and silently drops the zero-subdirectory case) (depends on: T002).

**Checkpoint**: Shared timeout wrapper implemented, tested, and wired into CI's existing script-test step. User Story 1 and User Story 2 can now proceed (in parallel, if staffed).

---

## Phase 3: User Story 1 - Backend test run never hangs without a known time limit (Priority: P1) 🎯 MVP candidate

**Goal**: `npm test` in `backend/` fails fast and clearly at every point that can hang today (per-test/hook, emulator startup, direct emulator `fetch` calls, a real-but-unreachable Redis connection), instead of hanging until a developer interrupts it by hand.

**Independent Test**: Deliberately provoke each failure point (slow test/hook, unresponsive emulator port, stopped Redis container, concurrent backend+e2e run) per `quickstart.md`'s User Story 1 section, and confirm `npm test` fails with a clear, bounded message each time instead of hanging.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; confirm they FAIL before doing the corresponding implementation task.

- [X] T005 [P] [US1] Write failing regression test in `backend/tests/unit/helpers/authEmulator.test.ts` asserting that `getTestIdToken`, `clearEmulatorUsers`, and `clearEmulatorFirestore` each reject within a short, bounded time — instead of hanging indefinitely — when `global.fetch` is mocked to never resolve (`jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}))`), asserting on the abort/timeout error each function surfaces.
- [X] T006 [P] [US1] Write failing regression test in `backend/tests/unit/helpers/setupEnv.test.ts` asserting that importing `backend/tests/helpers/setupEnv.ts` neutralizes `process.env.REDIS_URL` to an empty string even when a real `REDIS_URL` value is already present in the environment before `dotenv.config()` runs — mirroring the existing test coverage pattern/style already used for the Firebase-variable protection in that file (use `jest.resetModules()` + dynamic `import()`, matching the technique already used in `backend/tests/unit/cache/redisClient.test.ts`).

### Implementation for User Story 1

- [X] T007 [US1] Add an explicit `testTimeout` value to `backend/jest.config.js` (covers `test()` bodies and `beforeAll`/`beforeEach`/`afterEach`/`afterAll` hooks together, per Jest ≥29's unified timeout — this repo pins `jest: ^29.7.0`).
- [X] T008 [US1] Add `--detectOpenHandles --forceExit` to the Jest invocation inside `backend/package.json`'s `test` script (both flags together: the first reports what's keeping the process alive, the second still bounds exit time — neither alone satisfies both halves of the requirement, see research.md §2).
- [X] T009 [US1] Wrap the `firebase emulators:exec ...` invocation in `backend/package.json`'s `test` script with `node ../scripts/run-with-timeout.js <maxSeconds> --`, bounding emulator startup plus the full Jest run as a single outer ceiling. Size `<maxSeconds>` for the steady-state (warm-cache) case only — per research.md §3's cold-download addendum, do not inflate it to cover a first-run Firestore-emulator-JAR download, which is a one-time per-machine cost covered instead by the pre-warm note in T021 (depends on: T003).
- [X] T010 [US1] Add `AbortSignal.timeout(N)` (Node 20 native) to each of the three `fetch()` calls in `backend/tests/helpers/authEmulator.ts`, with `N` set well below the `testTimeout` from T007, to make T005 pass (depends on: T005).
- [X] T011 [US1] Add `REDIS_URL` to the pre-`dotenv.config()` neutralized-variable block in `backend/tests/helpers/setupEnv.ts` (same empty-string pattern already used there for the three `FIREBASE_*` variables) to make T006 pass (depends on: T006).
- [X] T012 [US1] ~~Verify Firebase CLI's actual behavior on a same-machine port conflict~~ — **implemented directly instead of live-verifying first**: verifying requires running two concurrent Firebase-emulator-backed test suites simultaneously and observing output, which conflicts with this project's standing guidance not to launch/block on full emulator-wrapped runs during an automated implementation session. Implemented the safe default unconditionally: `scripts/check-emulator-ports.js` (a `net.createServer().listen(port)` probe for the ports in `backend/firebase.json`, exported as `isPortAvailable`/`findPortConflicts` for direct unit testing) with `scripts/__tests__/check-emulator-ports.test.js` (4 tests, all passing), wired as a `pretest` script in both `backend/package.json` and `e2e/package.json`. A developer can still delete this step later if a live check shows Firebase CLI's native message was already sufficient.

**Checkpoint**: User Story 1 is independently functional — run `quickstart.md`'s User Story 1 steps 1–5 end to end.

---

## Phase 4: User Story 2 - E2E run never hangs silently or needs a manual kill (Priority: P1)

**Goal**: `npm test` in `e2e/` never repeats the 2026-07-13 incident (3m17s silent stall, unclean `SIGTERM` shutdown with a repeated `write EPIPE` loop) — any stalled phase (emulator startup, the three `webServer`s, a test) fails visibly within a known time, and a manual interrupt always shuts down cleanly.

**Independent Test**: Run `npm test` in `e2e/` per `quickstart.md`'s User Story 2 section — break one `webServer` deliberately, add a deliberately-slow test, and manually interrupt a running suite — confirming a clear bounded failure and a clean shutdown each time.

### Implementation for User Story 2

> No new permanent automated tests here beyond Foundational's `scripts/run-with-timeout.js` coverage (T002) — the remaining changes are Playwright/CI configuration values and a developer-run diagnostic, both validated via `quickstart.md` rather than a self-referential automated test (see Tests note at the top of this file).

- [X] T013 [US2] Add an explicit `timeout` (per-test) and `globalTimeout` (whole run) to `e2e/playwright.config.ts`, sized to comfortably exceed emulator startup plus all three `webServer` startup timeouts (`15_000`/`30_000`/`30_000`) plus a realistic full-suite run.
- [X] T014 [US2] Wrap the `firebase ... emulators:exec ...` invocation in `e2e/package.json`'s `test` script with `node ../scripts/run-with-timeout.js <maxSeconds> --`, bounding the emulator-startup phase that happens before Playwright's own `globalTimeout` clock starts (depends on: T003).
- [ ] T015 [US2] **DEFERRED TO FERNANDO — not attempted in this implementation session, by design.** **Developer-run diagnostic task (do not launch/block on this inside an automated session — run and observe it directly).** Add temporary timestamped logging around: each `webServer` entry's readiness probe (`e2e/playwright.config.ts`), the frontend's Firebase Auth emulator connection call (wherever `connectAuthEmulator` is invoked in `frontend/src/`), and the sign-in `page.waitForEvent('popup')` call in the e2e auth spec. Run `cd e2e && npm test` locally, reproduce a stall if possible, and record in this task (or the implementing PR's description) which phase actually stalls. Remove the temporary logging once identified.
- [ ] T016 [US2] **BLOCKED on T015.** Based on T015's finding, implement the targeted fix for the 2026-07-13 stall — exactly one of: (a) if a `webServer`'s own readiness-probe timeout wasn't actually firing, fix why (e.g. a swallowed rejection in the health-check request); (b) if the frontend's Firebase Auth emulator connection was the stall, add an explicit timeout around that connection call; (c) if `page.waitForEvent('popup')` was the stall, add an explicit `timeout` option to that call. Implement only the branch T015's evidence points to (depends on: T015).

**Checkpoint**: User Story 2 is independently functional — run `quickstart.md`'s User Story 2 steps 1–4 end to end.

---

## Phase 5: User Story 3 - CI never exhausts its default limit, and e2e also runs there (Priority: P2)

**Goal**: Every `.github/workflows/ci.yml` job has an explicit, reasonable `timeout-minutes`, and a new required `e2e-test` job runs the e2e suite in CI with a pinned Java runtime and emulator-JAR caching.

**Independent Test**: Push a throwaway branch with one job's step replaced by an intentional long-running command, open a PR, and confirm the job is cancelled at its configured limit (not GitHub's 360-minute default); confirm the new `e2e-test` job appears as a required check per `quickstart.md`'s User Story 3 section.

### Implementation for User Story 3

- [X] T017 [P] [US3] Add an explicit `timeout-minutes` to the `backend-test`, `frontend-test`, and `release` jobs in `.github/workflows/ci.yml`, each sized above that job's realistic duration (`backend-test` and the future `e2e-test` should track their local `run-with-timeout.js` ceilings from T009/T014 plus checkout/`npm ci` overhead; `frontend-test` and `release` get a smaller, standard ceiling since neither touches the emulator).
- [X] T018 [US3] Add a new `e2e-test` job to `.github/workflows/ci.yml`: checkout, `actions/setup-node@v5` (**Node 24, not 20** — the job's first real CI run failed because `e2e/helpers/discogsOauthStub.ts` is run directly as `node helpers/discogsOauthStub.ts`, relying on Node's native TypeScript type stripping, stable/default only from v24.12.0 on the LTS line; Node 20 has none at all. Scoped to this job only — `backend-test`/`frontend-test`/`release` stay on Node 20, already proven working, per Simplicity/YAGNI), `actions/setup-java@v4` (`distribution: temurin`, `java-version: '21'`, pinned rather than relying on the runner's shifting default — see research.md §11), `actions/cache@v4` keyed on the `firebase-tools` version (from `package-lock.json`) caching `~/.cache/firebase/emulators/`, `npm ci` in `e2e/` (plus whatever `frontend/`/`backend/` install step the three `webServer` entries need to run `npm run dev`), then `npm test` in `e2e/`, with its own explicit `timeout-minutes` (depends on: T013, T014, T016). **Added ahead of T016** rather than strictly after it: FR-007/FR-008's global timeout (T013) plus the outer wrapper (T014) already guarantee the suite fails within a bounded worst-case time regardless of whether the specific 2026-07-13 root cause is diagnosed/fixed yet — CI enforcement is itself part of the safety net for that still-open bug, not something that needs to wait for it. T016 remains genuinely blocked on T015's developer-run diagnosis (correctly not attempted in this automated session).
- [X] T019 [US3] Make the `release` job in `.github/workflows/ci.yml` depend on the new `e2e-test` job (`needs: [backend-test, frontend-test, e2e-test]`), per the 2026-07-14 spec clarification that the e2e check is required/blocking from day one, the same way `backend-test`/`frontend-test` already are (depends on: T018).

**Checkpoint**: All three user stories are independently functional. Run `quickstart.md`'s User Story 3 steps 1–3 end to end.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T020 [P] **PARTIALLY DEFERRED TO FERNANDO.** Run the complete `quickstart.md` validation guide end to end (all three user stories) and record actual pass/fail results in the implementing PR's description. Every scenario requiring a live `backend npm test` or `e2e npm test` run was intentionally not executed in this implementation session (project guidance: don't launch/block on full Firebase-emulator-wrapped runs mid-flow) — only the emulator-free pieces were verified directly: `scripts/__tests__/run-with-timeout.test.js` (8/8 passing, including the real SIGKILL-escalation timing), `scripts/__tests__/check-emulator-ports.test.js` (4/4 passing), the two new backend unit tests (6/6 passing, no emulator needed), argv-forwarding through the wrapper for both the backend and e2e `test` script shapes (manually traced, see implementation notes), and `ci.yml`'s YAML structure (parsed and validated: 4 jobs, correct `needs`, correct `timeout-minutes` on all four). Remaining: US1 steps 1–5, US2 steps 1–4, and US3 steps 1–3 from `quickstart.md` all require a real emulator/browser run or an actual GitHub Actions PR and should be run by Fernando.
- [X] T021 [P] Document the new fail-fast behavior for contributors: mention `scripts/run-with-timeout.js` and the documented timeout ceilings (`testTimeout`, `globalTimeout`, `timeout-minutes` values chosen) in `backend/README.md`/`e2e/README.md` or the repo's top-level contributing docs, wherever "how to run tests" is currently documented — including the one-time pre-warm step for a brand-new machine's first run (research.md §3: run `npx firebase emulators:start --only auth,firestore` once and Ctrl+C after "All emulators ready" to download the Firestore emulator JAR before the timeout-bounded `npm test` is relied on).
- [ ] T022 **BLOCKED on T015/T020's manual runs** — nothing throwaway was added by the automated portion of this implementation (verified: no deliberately-slow tests, no deliberately-broken `webServer` commands, and no temporary diagnostic logging exist in the current diff). Remains open only because T015/T020's manual steps, once run by Fernando, may introduce their own temporary scaffolding that will need this same cleanup pass afterward.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001) — BLOCKS T009 (US1) and T014 (US2), the two tasks that wrap `emulators:exec` with the new script. Does not block the rest of US1/US2/US3.
- **User Story 1 (Phase 3)** and **User Story 2 (Phase 4)**: Both P1; independently startable once Foundational (T003) is done for their respective wrapper-dependent tasks (T009, T014) — the rest of each story has no cross-story dependency.
- **User Story 3 (Phase 5)**: Builds on US1 and US2 being reliable first (T018 depends on T013/T014/T016) — this mirrors the spec's own stated priority rationale ("depends on Historias 1 and 2 already having bounded the local wait times").
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- US1: tests (T005, T006) before their corresponding implementation (T010, T011); T007, T008, T009, T012 have no test-first pairing (config/investigative tasks, see Tests note).
- US2: T013 and T014 are independent of each other; T016 strictly depends on T015's findings.
- US3: T017 is independent; T018 depends on US1/US2 config being in place; T019 depends on T018.

### Parallel Opportunities

- T001 (Setup) can start immediately.
- T002 and T004 within Foundational are marked [P] (different files from T003's implementation target, though T004 should land after T002 exists).
- T005 and T006 (US1 tests) can run in parallel — different files.
- Once Foundational (T003) lands, US1 (Phase 3) and US2 (Phase 4) can proceed in parallel if staffed by different people — neither reads the other's files.
- T017 (US3) can start any time after Setup — it doesn't depend on US1/US2 code, only on knowing their local timeout values for sizing.

---

## Parallel Example: User Story 1

```bash
# Launch both US1 regression tests together (different files, no shared state):
Task: "Write failing regression test in backend/tests/unit/helpers/authEmulator.test.ts"
Task: "Write failing regression test in backend/tests/unit/helpers/setupEnv.test.ts"
```

---

## Implementation Strategy

### MVP Scope

The spec assigns **P1 to both User Story 1 and User Story 2** — unlike a
typical single-P1 feature, there isn't one obvious "smallest MVP" between
them. Recommended sequencing:

1. Complete Phase 1 (Setup) + Phase 2 (Foundational) — the shared wrapper
   unblocks both P1 stories.
2. Complete Phase 3 (User Story 1) first if a single incremental step is
   needed: it has no unresolved unknowns (T012 is a bounded verify-then-act
   task, not an open-ended investigation) and delivers protection for the
   most frequently-run suite.
3. Complete Phase 4 (User Story 2) next: it carries the one open unknown in
   this feature (T015's diagnostic reproduction gates T016), so it benefits
   from Foundational + US1's wrapper already being proven.
4. **STOP and VALIDATE** with `quickstart.md` after each story.
5. Phase 5 (User Story 3) last, exactly as the spec's own priority
   rationale states — it's the natural extension of 1+2 into CI, not a
   starting point.

### Incremental Delivery

1. Setup + Foundational → shared wrapper ready and tested.
2. Add User Story 1 → validate independently → deliverable on its own.
3. Add User Story 2 → validate independently → deliverable on its own.
4. Add User Story 3 → validate independently → CI now enforces all of the
   above.
5. Polish.

---

## Notes

- [P] tasks touch different files with no unmet dependency.
- [Story] labels map every user-story-phase task back to spec.md's Historia
  1/2/3 for traceability.
- T015→T016 is the one task pair whose implementation content cannot be
  fully specified in advance (the spec's FR-010 explicitly forbids guessing
  the 2026-07-13 root cause) — T016 must be scoped down to whichever single
  branch T015's evidence supports.
- Commit after each task or logical group, following this repo's
  Conventional Commits requirement (e.g. `test(042): ...`, `fix(042): ...`,
  `ci(042): ...`).
- Avoid leaving any of T005/T006's mocked-`fetch`/deliberately-slow
  scaffolding, or T015's temporary logging, in the final diff — see T022.

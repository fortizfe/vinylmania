# Quickstart: Validating Backend & E2E Test Suite Firebase Emulator Reliability

This is a validation guide, not an implementation guide — it documents how
to prove each user story's acceptance scenarios hold, by deliberately
provoking the failure condition each one guards against. See `research.md`
for the design decision behind each mitigation and `spec.md` for the
underlying acceptance scenarios.

## Prerequisites

- Local machine with Java available (`java -version`) for the Firestore
  emulator, and the emulator JAR already cached
  (`~/.cache/firebase/emulators/`) or network access to download it.
- `backend/.env` present (real dev config) to exercise the Redis scenario
  realistically; otherwise a plain `.env` with any `REDIS_URL` set will do.
- Docker available if you want to also verify the "Redis container running"
  non-failure path, though it's optional — the scenario below only requires
  Redis to be *absent*.

## User Story 1 — Backend run never hangs without a known limit

1. **Stuck test/hook fails fast (FR-001)**: Temporarily add a test or hook
   with an intentional long `await new Promise(r => setTimeout(r, <over the
   configured testTimeout>))` in any `backend/tests/**/*.test.ts` file. Run
   `cd backend && npm test`. **Expected**: the run fails within the
   documented `testTimeout` window with a message naming that specific test,
   not a hang.
2. **No silent hang at exit (FR-003)**: Temporarily open a handle that's
   never closed (e.g. an unref'd `setInterval` in a test file) and run
   `npm test`. **Expected**: `--detectOpenHandles` output names the leaked
   handle, and the process still exits (via `--forceExit`) within a bounded
   time — it does not hang waiting for `emulators:exec` to notice the
   wrapped command never returned.
3. **Emulator call has its own timeout (FR-004)**: Temporarily block the
   Auth or Firestore emulator port (e.g. `nc -l 9099` to occupy it without
   answering Firebase's protocol) before running a test that calls
   `getTestIdToken`/`clearEmulatorUsers`/`clearEmulatorFirestore`.
   **Expected**: that specific `fetch` call fails with an abort/timeout
   error attributable to the helper function, well before the surrounding
   test's own `testTimeout` would fire.
4. **Redis absence doesn't affect the run (FR-005)**: Ensure no Redis
   container is running (`docker compose down` if one was up), set a real
   `REDIS_URL` in `backend/.env` pointing at `localhost:6379`, and run
   `npm test`. **Expected**: the full suite completes in its normal time —
   no delay or hang attributable to background `ioredis` reconnection
   attempts.
5. **Port conflict is reported clearly (FR-006)**: Start `cd backend && npm
   test` in one terminal; while it's still running (emulators up), start
   `cd e2e && npm test` in a second terminal. **Expected**: the second run's
   failure output identifies the specific port already in use and which
   command/run holds it, rather than hanging or failing with an unrelated
   generic error.

## User Story 2 — E2E run never hangs silently or needs a manual kill

1. **Pre-test-phase timeout (FR-006/FR-007 of spec, pre-first-test window)**:
   Temporarily rename `e2e/helpers/discogsOauthStub.ts` (or otherwise break
   one `webServer` command) so that server never becomes ready, then run
   `cd e2e && npm test`. **Expected**: the run fails within the documented
   ceiling covering emulator startup + `webServer` boot, not a multi-minute
   silence.
2. **Global run timeout (FR-008)**: Temporarily add a test with an
   intentional long wait exceeding `globalTimeout`. **Expected**: the whole
   run is aborted at the documented `globalTimeout`, with output identifying
   that the global limit — not an individual test — was hit.
3. **Clean shutdown on manual interrupt (FR-009)**: Start `npm test`, wait
   for the emulators to be up (visible in the log), then send `Ctrl+C` (or
   `kill -TERM <pid>` on the wrapping process). **Expected**: the process
   exits within a short, bounded grace period; `e2e/firebase-debug.log` does
   not contain a repeated `Error: write EPIPE` loop; no orphaned Firestore
   emulator Java process remains (`ps aux | grep cloud-firestore-emulator`
   should be empty afterward).
4. **Diagnostic reproduction task (FR-010)**: Before implementing any fix
   targeting the specific 2026-07-13 stall, run the e2e suite locally with
   the granular logging added per the corresponding implementation task
   (timestamped markers around each `webServer` readiness probe, the
   frontend's emulator connection call, and the sign-in popup wait), and
   record which phase actually stalls. This step is developer-run and
   observed directly — not something to launch and block on inside an
   automated session.

## User Story 3 — CI never exhausts its default limit, and e2e runs there too

1. **Job timeout enforcement (FR-011)**: Push a throwaway branch with one
   job's step replaced by an intentional long-running command (e.g. `sleep
   99999`), open a PR, and watch the job in the GitHub Actions UI.
   **Expected**: the job is cancelled at its configured `timeout-minutes`,
   not GitHub's 360-minute default.
2. **New e2e CI job runs successfully (FR-012)**: Open any PR after the new
   `e2e-test` job is added. **Expected**: the job appears in the PR's checks
   list, installs a pinned Java version (visible in its log via
   `actions/setup-java`), runs the e2e suite, and completes (pass or fail)
   within its configured `timeout-minutes`.
3. **Required check blocks merge (FR-013)**: On the same PR, attempt to
   merge while the `e2e-test` job is still running or has failed.
   **Expected**: GitHub blocks the merge, the same way it already does today
   for `backend-test`/`frontend-test`.

## Notes

- None of the above require new test files to remain in the repo — the
  "temporarily add/break X" steps are throwaway verification, not permanent
  test suite additions (except where a task explicitly calls for a
  permanent regression test, e.g. covering the `REDIS_URL` neutralization).
- See `research.md` for the exact mechanism decided for each mitigation
  (config flags, wrapper commands, CI steps) before turning any of the
  above into implementation tasks.

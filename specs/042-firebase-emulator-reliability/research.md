# Phase 0 Research: Backend & E2E Test Suite Firebase Emulator Reliability

All items below were flagged as "verify during planning" by the source brief
(`.hu/backend-e2e-firebase-emulator-reliability.md`) or by the spec's own
Assumptions section. Each is now resolved with a decision, or explicitly
left as an implementation-time task where live reproduction is required.

## 1. Bounding each backend test/hook (FR-001)

**Finding**: `backend/jest.config.js` sets no `testTimeout`, so every test and
every hook (`beforeAll`/`afterEach`/`afterAll`) falls back to Jest's default
5000ms — actually already a bound, just an *undocumented, accidental* one
that isn't sized for emulator-backed I/O (a `fetch` to the Auth/Firestore
emulator can legitimately take longer than 5s on a cold JVM).

**Decision**: Set an explicit `testTimeout` in `backend/jest.config.js` sized
generously above realistic emulator-call latency (a low double-digit-second
value). In Jest ≥29 (this repo pins `^29.7.0`), `testTimeout` already governs
`beforeAll`/`beforeEach`/`afterEach`/`afterAll` hooks in addition to `test()`
bodies, so a single config value satisfies FR-001 without a second hook-only
setting.

**Alternatives considered**: Per-test `jest.setTimeout()` calls scattered
across files — rejected as repetitive and easy to forget on new test files
(violates Simplicity/YAGNI: one config value covers every file).

## 2. Bounding process exit after tests finish (FR-003)

**Finding**: Today, nothing detects or reports a leaked handle (open socket,
timer, dangling connection) after all tests finish. If one exists, Jest's
process simply never exits, and `firebase emulators:exec` waits on it with no
explanation — exactly the "silent hang, needs Ctrl+C" symptom this feature
exists to eliminate.

**Decision**: Add both `--detectOpenHandles` and `--forceExit` to the Jest
invocation in `backend/package.json`'s `test` script. `--detectOpenHandles`
makes Jest print what's keeping the process alive (satisfies "detected and
reported explicitly"); `--forceExit` then terminates the process once
reporting is done (satisfies "terminates within a bounded time"). Neither
flag alone satisfies both halves of FR-003.

**Alternatives considered**: `--forceExit` alone — rejected because it
silently masks leaks (the process exits, but nobody learns a handle was
left open, so the underlying bug — e.g. the Redis client from item 4 below —
would keep recurring unnoticed). `--detectOpenHandles` alone — rejected
because reporting without forcing exit still leaves the process (and
`emulators:exec`) hanging, which is the exact bug being fixed.

## 3. Bounding emulator startup and total run time (FR-002, part of FR-001's "arranque del emulador")

**Finding**: `firebase emulators:exec` has no built-in flag to cap its own
startup phase, and Jest's `testTimeout` only starts counting once a test
file begins executing — neither covers the emulator-boot window before the
first test.

**Decision**: Wrap the existing `emulators:exec "..."` invocation in
`backend/package.json`'s `test` script with a small shared cross-platform
Node script (e.g. `scripts/run-with-timeout.js`, no new dependency —
`child_process.spawn` + `setTimeout` + `kill`), bounding the entire wrapped
command (emulator startup + full Jest run) to a single documented ceiling.
This is a coarse, whole-run safety net layered on top of the finer-grained
`testTimeout` from item 1 — together they satisfy "an explicit, documented
limit" at both the per-test/hook level and the startup/whole-run level
called for by FR-001 and FR-002.

**Alternatives considered**: The POSIX `timeout` coreutil — this is the
initial, simpler-looking option, but it's a real portability trap for this
project specifically: it's present by default on the `ubuntu-latest` CI
runner, but **not** on macOS (BSD userland ships no `timeout`; it only
exists if a contributor has separately installed GNU coreutils via
Homebrew, giving `gtimeout` instead of `timeout`), and this repo's confirmed
local dev machine is macOS. Requiring every contributor to install an extra
system package just to run `npm test` would be a new, undocumented
environment dependency this project doesn't otherwise have — worse than the
small Node script for a repo that's already 100% Node/TypeScript tooling
end to end. A custom wrapper spawning `firebase emulators:exec` with its own
`setTimeout`/`kill` logic is therefore the actually-simpler choice here once
cross-platform local use is accounted for, not unnecessary complexity.

**Cold-download sizing (closes spec.md's User Story 1 edge case — "must be
clarified during planning")**: The local wrapper's ceiling MUST NOT be sized
tight enough to fail a legitimate first-run Firestore-emulator-JAR download
(confirmed locally: `cloud-firestore-emulator-v1.19.8.jar`, ~63MB,
downloaded once into `~/.cache/firebase/emulators/` and reused on every
subsequent run). Two considerations settle this without needing a
double-purpose value: (1) the JAR download happens exactly once per machine
(or per `firebase-tools` version bump) — it is not part of the steady-state
loop this feature exists to bound — so sizing the *permanent* ceiling around
a rare one-time cost would blunt the fast-failure benefit for every ordinary
run; (2) unlike CI (item 12, cached automatically via `actions/cache`), a
local machine's cache persists on disk indefinitely between runs, so the
cold case is a true one-time event per contributor, not a recurring cost.
**Decision**: size `run-with-timeout.js`'s ceiling for the steady-state
(warm-cache) case only, and document in the same contributor-facing note
called for by tasks.md's T021 that a brand-new machine's *first* `npm test`
may need to pre-warm the cache once outside the timeout — e.g. by running
`npx firebase emulators:start --only auth,firestore` once locally (Ctrl+C
once "All emulators ready" appears) before relying on the bounded `npm
test` for every run after that. This keeps the steady-state ceiling tight
(serving FR-001/FR-002's fast-failure intent) instead of permanently
inflating it to cover a cost every contributor only pays once.

**Alternatives considered**: Sizing the ceiling generously enough to always
absorb a cold download (mirroring the CI caching rationale in item 12) —
rejected: unlike a CI job (which is genuinely cold on every fresh runner
unless cached), a local machine's `~/.cache/firebase/emulators/` persists
indefinitely, so permanently widening every contributor's steady-state
ceiling to cover a per-machine one-time event fails FR-002's own intent
(catching a *genuinely* stuck startup fast) for the other 99% of runs.

## 4. Bounding direct emulator `fetch` calls in test helpers (FR-004)

**Finding**: `backend/tests/helpers/authEmulator.ts`'s three functions
(`getTestIdToken`, `clearEmulatorUsers`, `clearEmulatorFirestore`) call the
native `fetch()` with no `signal`, so a non-responding emulator leaves the
call pending until the *surrounding test's* timeout fires (or hangs forever,
pre-item-1).

**Decision**: Pass `AbortSignal.timeout(N)` (native in Node 20+, this repo's
CI `node-version: 20`) to every `fetch()` call in that file, with `N` well
below the per-test `testTimeout` from item 1, so a stuck emulator call fails
with a clear `AbortError` attributable to that specific helper rather than a
generic "test exceeded timeout" message.

**Alternatives considered**: A shared `fetchWithTimeout` wrapper — considered
for reuse, but with only three call sites in one file, inlining
`AbortSignal.timeout(N)` at each call is simpler and avoids a new
abstraction for a three-line duplication (Simplicity/YAGNI).

## 5. Neutralizing the real Redis client during backend tests (FR-005)

**Finding** (confirmed reading `backend/.env`, `backend/src/cache/redisClient.ts`,
`backend/tests/helpers/setupEnv.ts`): `REDIS_URL` is not in the list of
variables `setupEnv.ts` pre-sets before calling `dotenv.config()`, unlike the
three Firebase variables. If `backend/.env` defines a real `REDIS_URL` and
the corresponding container isn't running, `getRedisClient()` constructs a
real `ioredis` client (`lazyConnect: false`) the first time any code path
under test calls `withCache`/`invalidateCache` without mocking `ioredis`,
and that client retries connecting in the background indefinitely — nothing
in `setupEnv.ts`'s `afterAll` closes it.

**Decision**: Add `REDIS_URL` to `setupEnv.ts`'s pre-`dotenv.config()` block,
setting it to an empty string — identical pattern already used for the three
`FIREBASE_*` variables. `getRedisClient()`'s existing `if (!url) { client =
null; ... }` guard already treats an empty string as "not configured" (empty
string is falsy), so this reproduces the same `null`-client behavior tests
already get in CI (where `REDIS_URL` is simply unset) without touching
`redisClient.ts` itself.

**Alternatives considered**: Explicitly closing any created Redis client in
`setupEnv.ts`'s `afterAll` (the spec's documented alternative) — rejected in
favor of the neutralize-before-connect approach because it's simpler (no
client is ever created, so there's nothing to close) and consistent with the
existing Firebase-variable pattern in the same file, rather than introducing
a second, different mitigation style for the same class of problem.

## 6. Detecting a same-machine emulator port conflict (FR-006, new from clarification)

**Finding**: `backend/firebase.json` fixes the Auth (`9099`) and Firestore
(`8080`) emulator ports for both the backend and e2e test scripts. Firebase
CLI's own behavior when a port is already bound by another process (e.g. a
concurrent `npm test` in the sibling package) was not verified by the source
brief.

**Decision**: This needs a short implementation-time verification step
(deliberately start one emulator-backed run, then start a second while the
first is still up, and read the second run's actual output) before deciding
whether new code is needed. Firebase CLI has historically produced errors
for a bound port (e.g. "Port 8080 is not open") in some but not all
versions/emulators, so treat this as a task, not a design decision, and
implement one of two fallback shapes only if the native message turns out to
be unclear:
  - **If already clear**: no code change — just document the port-conflict
    scenario (e.g. in a README/troubleshooting note) so a developer hitting
    it recognizes the existing message.
  - **If unclear**: add a lightweight `pretest` check (Node's `net` module,
    a single `net.createServer().listen(port)` probe per port) in both
    `backend/package.json` and `e2e/package.json` that fails fast with an
    explicit "port already in use by another test run" message before
    invoking `emulators:exec`.

**Alternatives considered**: Deferring to random/dynamic emulator ports per
run — rejected: `firebase.json` is shared configuration also consumed by
local interactive `firebase emulators:start` during manual development, and
`e2e/playwright.config.ts` hardcodes `9099`/`8080` as constants; making ports
dynamic would be a much larger change than this feature's scope justifies
(Simplicity/YAGNI).

## 7. Bounding the e2e pre-test phase and overall run (FR-007, FR-008)

**Finding**: `e2e/playwright.config.ts` sets no `timeout` (per-test, so it
inherits Playwright's 30s default) and no `globalTimeout`. Neither covers the
phase before the first test: emulator startup (outside Playwright's control,
handled by the wrapping `emulators:exec` in `e2e/package.json`) plus the
three `webServer` entries' own startup probes (which already have per-server
`timeout: 15_000`/`30_000`).

**Decision**: Add an explicit `globalTimeout` to `playwright.config.ts`,
sized to comfortably exceed emulator startup + all three `webServer` startup
timeouts + a realistic full-suite run — and also set an explicit `timeout`
(even though it currently matches Playwright's own default) so the limit is
documented in config rather than implicit. Additionally, apply the same
shared `scripts/run-with-timeout.js` wrapper from item 3 to
`e2e/package.json`'s `test` script, so the emulator-startup phase itself
(before Playwright's own clock starts) is bounded too — `globalTimeout` only
starts counting once Playwright's test runner itself has started.

**Alternatives considered**: Relying on `globalTimeout` alone — rejected:
confirmed by reading Playwright's execution model, `globalTimeout` bounds
time from when the Playwright test runner starts, not from when
`emulators:exec` begins booting the emulators — exactly the gap where the
2026-07-13 incident's silence began.

## 8. Diagnosing the 2026-07-13 incident before choosing its fix (FR-010)

**Finding**: The incident log (`e2e/firebase-debug.log`) shows emulators
starting cleanly, `playwright test` starting, one HTTP/2 connection logged
by Firestore, then 3m17s of total silence before a manual SIGTERM. This
matches three plausible stall points equally well from the log alone (one of
the three `webServer` processes hanging past its own configured timeout
without that timeout actually firing, the frontend's Firebase Auth client
connecting to the emulator, or the first test's `page.waitForEvent('popup')`
per the sign-in mechanism from spec 008) — the log doesn't disambiguate them.

**Decision**: This is not resolved by research/reading code alone — it
requires a live reproduction with added granular logging (timestamped
markers around each `webServer`'s readiness probe, around the frontend's
emulator connection call, and around the popup-wait) and is captured as an
explicit early task in `tasks.md`, to run *before* any task that implements
a specific timeout/shutdown fix for this incident. Per user preference on
this project, this reproduction should be run and observed directly by the
developer rather than launched and blocked on inside an automated
implementation session (a Firebase-emulator-wrapped e2e run is exactly the
kind of long-running, potentially-hanging process that shouldn't be
polled/blocked on mid-flow).

**Alternatives considered**: Guessing the root cause from the log and
implementing a fix speculatively — rejected: the spec (FR-010) explicitly
forbids this, and picking the wrong layer to fix (e.g. hardening
`page.waitForEvent('popup')` when the real stall is a `webServer` probe)
would leave the actual bug in place.

## 9. Clean shutdown on manual interrupt without the EPIPE loop (FR-009)

**Finding**: The 1,816-line `Error: write EPIPE` loop is `firebase-tools`'
own `winston` logger trying to keep writing shutdown-progress lines to a
stdout pipe that's already been torn down — this matches publicly
documented `firebase-tools` shutdown-robustness issues (the CLI's SIGTERM/
SIGINT handling during `emulators:exec` teardown is a known rough edge
upstream, not something unique to this repo's configuration).

**Decision**: Since this is an upstream CLI behavior (not a bug in this
repo's code) and no config flag has been found to disable it, treat the
external `scripts/run-with-timeout.js` wrapper from items 3/7 as the actual
fix: instead of a plain `SIGTERM` (which triggers the buggy
graceful-shutdown path), the wrapper implements an escalation pattern — send
`SIGTERM` to the child process group first, then `SIGKILL` the whole group
after a short grace period if it hasn't exited. A hard `SIGKILL` of the
process group skips the CLI's flawed shutdown routine entirely. This must
still confirm (as a task) that `SIGKILL`-ing the group also reaps the
underlying Firestore JVM child process, consistent with the reason
`emulators:exec` was adopted over a backgrounded `emulators:start` in the
first place (spec 008, research.md §3-adjacent finding).

**Alternatives considered**: Patching around `firebase-tools`' own logger
(e.g. suppressing winston output) — rejected: modifying or monkey-patching a
third-party CLI dependency's internals is fragile and violates this
project's "reuse Discogs/Firebase tooling as-is" posture; bounding wall-clock
time and escalating to `SIGKILL` sidesteps the bug without touching
`firebase-tools` itself.

## 10. CI job time limits (FR-011)

**Finding**: None of `backend-test`, `frontend-test`, or `release` in
`.github/workflows/ci.yml` sets `timeout-minutes`; GitHub Actions' default
for a job without one is 360 minutes.

**Decision**: Add an explicit `timeout-minutes` to each job, sized
generously above each job's realistic duration plus the local per-run
ceilings from items 3 and 7 (backend and e2e jobs should be bounded close to
their local `timeout`-wrapped run time plus `npm ci`/checkout overhead;
`release` and `frontend-test` get a smaller, standard CI-job ceiling since
neither touches the emulator).

**Alternatives considered**: A single repo-wide default via
`defaults.run.timeout-minutes` — not a real GitHub Actions feature (timeout
is job-scoped, not settable as a shared default across jobs in one
workflow), so per-job values are the only option.

## 11. Adding an e2e job to CI, with Java available (FR-012)

**Finding** (verified via GitHub's own runner-image documentation): The
`ubuntu-latest` runner (currently the Ubuntu 24.04 image) pre-installs
Eclipse Temurin JDKs 8, 11, 17, and 21, each exposed via a
`JAVA_HOME_<version>_X64` environment variable — but the *default* `java` on
`PATH` resolves to 17 on this image (it resolved to a different default on
the prior 22.04 image), and that default has already changed once across
runner-image versions.

**Decision**: Add an explicit `actions/setup-java@v4` step (`distribution:
temurin`, `java-version: '21'`) to the new e2e CI job, pinning the same
major version already confirmed working against the Firestore emulator
locally (`java -version` → 21.0.6), rather than relying on whatever the
runner's default `java` on `PATH` happens to resolve to. This removes the
dependency on an unpinned, historically-changing default.

**Alternatives considered**: Relying on the runner's default `java` (17) —
rejected: it works today by coincidence (the Firestore emulator's minimum
supported Java is lower than 17), but pinning removes a variable that has
already shifted once (21 → 17) across runner-image generations, and this
project has zero local evidence of 17 vs. 21 behavior parity for the exact
`cloud-firestore-emulator-v1.19.8.jar` version pinned by `firebase-tools`.

**Also verified**: `frontend/.env.test` (loaded by `playwright.config.ts`)
exists and is tracked in git (`git ls-files` confirms it, and it is not
listed in `.gitignore`), so the e2e CI job can start all three `webServer`
entries without any additional secret/config provisioning — this closes the
open question from the spec's User Story 3 edge cases.

**Addendum, found on the job's first real CI run** (not caught during
planning — this is a genuinely new finding, not something research could
have surfaced by reading code alone, since it only manifests when the job
actually executes): `e2e/helpers/discogsOauthStub.ts` is a `webServer` entry
run directly as `node helpers/discogsOauthStub.ts` (see its own top-of-file
comment), relying on Node's native TypeScript type stripping to execute a
`.ts` file with no build step. That feature is stable and default only from
Node v24.12.0 on the LTS line (confirmed via web research) — Node 20, which
every other CI job already uses successfully, has no such support at all,
so the stub crashed immediately with a `SyntaxError` on its first generic
type annotation. **Decision**: pin the `e2e-test` job specifically to Node
24 (`actions/setup-node@v5`, `node-version: 24`) rather than 20 — scoped to
this one job, since `backend-test`/`frontend-test`/`release` have run
correctly on Node 20 all along and there's no reason to touch a
already-working configuration for them. **Alternatives considered**:
introducing `ts-node`/`tsx` as a new e2e devDependency and changing the
`webServer` command instead — rejected: it would reverse an existing,
already-reviewed design decision from feature 015 (the file's own comment
documents choosing native type stripping deliberately) inside an unrelated
reliability PR, for no benefit over just matching CI's Node version to what
local development already correctly relies on.

**Second addendum, found on the job's second real CI run** (after the Node
24 fix above got the stub running and all 109 tests discovered): every test
failed uniformly with `browserType.launch: Executable doesn't exist at
~/.cache/ms-playwright/...` — the `e2e-test` job's `npm ci` steps install
`@playwright/test` as a library, but never ran the separate browser-binary
download step. `e2e/README.md`'s own local setup instructions already
documented this as a required one-time step (`npx playwright install
chromium`) that simply had no CI equivalent yet. **Decision**: add `npx
playwright install --with-deps chromium` after `e2e/`'s `npm ci`, plus an
`actions/cache@v4` step for `~/.cache/ms-playwright` (keyed on
`e2e/package-lock.json`, mirroring the Firestore-JAR caching in item 12
below) so only the first run after a `@playwright/test` version bump pays
the download cost. `--with-deps` also installs the OS-level libraries
Chromium needs on a bare `ubuntu-latest` runner, which a plain devDependency
install can never provide regardless of caching.

## 12. Caching the Firestore emulator JAR in CI

**Finding**: The emulator binary (`~/.cache/firebase/emulators/cloud-firestore-emulator-v1.19.8.jar`,
~63MB locally) is not part of any existing CI cache step.

**Decision**: Add a `actions/cache@v4` step keyed on the pinned
`firebase-tools` version (from `package-lock.json`) caching
`~/.cache/firebase/emulators/` for both the backend and the new e2e CI job,
so only the first run after a `firebase-tools` bump pays the download cost
inside the job's time budget from item 10.

**Alternatives considered**: Not caching, and sizing `timeout-minutes`
generously enough to always absorb a cold download — rejected: a cold
download is one-time/rare, so permanently budgeting for it in every job's
timeout wastes the fast-failure benefit item 10 exists to provide.

## Sources consulted

- [actions/setup-java](https://github.com/actions/setup-java)
- [runner-images Ubuntu 24.04 Readme](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)
- [Revisit shutdown behavior of the emulators · firebase-tools#3578](https://github.com/firebase/firebase-tools/issues/3578)
- [Emulators not correctly terminated when emulators:exec subprocess is killed · firebase-tools#2477](https://github.com/firebase/firebase-tools/issues/2477)
- [No graceful exit using NPM Scripts · firebase-tools#2507](https://github.com/firebase/firebase-tools/issues/2507)

## Outstanding items deferred to task-level verification (not blocking plan approval)

- Item 6 (port-conflict message clarity) requires running two concurrent
  emulator-backed test invocations to observe actual Firebase CLI output.
- Item 8 (root cause of the 2026-07-13 stall) requires a live, developer-run
  reproduction with added logging — explicitly not to be attempted as a
  blocking step inside an automated planning/implementation session.
- Item 9's `SIGKILL`-reaps-the-JVM claim requires confirming process-group
  semantics on the actual CI runner (Linux) match local macOS behavior.

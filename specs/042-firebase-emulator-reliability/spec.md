# Feature Specification: Backend & E2E Test Suite Firebase Emulator Reliability

**Feature Branch**: `042-firebase-emulator-reliability`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Quiero refinar cómo se ejecutan los tests unitarios/de integración del backend (`backend/`, Jest) y los tests e2e (`e2e/`, Playwright), ambos apoyados en el Firebase Local Emulator Suite, para que ninguna ejecución se quede esperando de forma indefinida y toda la suite corra con fluidez — tanto en local como en CI. Ver `.hu/backend-e2e-firebase-emulator-reliability.md` para el detalle completo: incidente real registrado el 2026-07-13 en `e2e/firebase-debug.log` (3 minutos 17 segundos de silencio seguidos de una interrupción manual y un apagado atascado con 1.816 líneas de `Error: write EPIPE`), huecos de configuración verificados en `backend/jest.config.js`, `backend/tests/helpers/authEmulator.ts`, `backend/tests/helpers/setupEnv.ts` (incluyendo un hallazgo relacionado sobre `REDIS_URL`/`ioredis` no neutralizado en tests locales), `e2e/playwright.config.ts`, y `.github/workflows/ci.yml` (sin `timeout-minutes` en ningún job, y sin job de e2e en CI)."

## Clarifications

### Session 2026-07-14

- Q: Should the new e2e CI job be a required/blocking check on pull requests from day one, or start as informational/non-blocking while the suite stabilizes? → A: Blocking immediately — the e2e job becomes a required dependency of the release/publish job, same as the existing backend and frontend test jobs.
- Q: Should detecting/reporting a same-machine emulator port conflict between a concurrent backend run and e2e run be a committed requirement of this feature, or stay an out-of-scope known limitation? → A: In scope — add explicit conflict detection with a clear message.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A backend test run never hangs without a known time limit (Priority: P1)

As a developer on the project, I want `npm test` in the backend package to have
explicit time limits at every point where it can currently hang indefinitely
(emulator startup, each test/hook, direct emulator calls, connection cleanup
at the end of the run), so that a real problem produces a clear, fast failure
instead of a silent hang that only ends when someone interrupts the process
by hand.

**Why this priority**: This is the most frequently executed flow (every
backend change, and every pull request via CI) and today it has no time
limit of its own beyond Jest's default 5-second per-test timeout, which
doesn't cover startup, hooks, or a stalled connection.

**Independent Test**: Can be fully tested by deliberately provoking each
failure point (a slow-starting emulator, a `fetch` to the emulator that
never responds, a configured-but-not-running Redis instance) and confirming
`npm test` fails with a clear message within the agreed limit, instead of
hanging.

**Acceptance Scenarios**:

1. **Given** any `npm test` run in the backend package, **When** an
   individual test, a hook (`beforeAll`/`afterEach`/`afterAll`), or emulator
   startup takes longer than an explicit, documented limit, **Then** the
   process fails with a clear message identifying what was waiting, instead
   of continuing indefinitely.
2. **Given** all tests have finished running (whether they passed or
   failed), **When** the test runner tries to exit, **Then** the process
   terminates within a bounded time; if a handle is left open (socket,
   timer, connection), it must be detected and reported explicitly instead
   of leaving the wrapping emulator command waiting with no explanation.
3. **Given** the direct calls to the emulator used by the test helpers
   (fetching a test auth token, clearing emulator users, clearing emulator
   Firestore data), **When** the Auth or Firestore emulator doesn't respond
   to that request, **Then** the call fails within its own bounded time
   instead of depending solely on the generic timeout of the test that
   invoked it.
4. **Given** a local Redis connection string configured for development is
   present in the environment and the corresponding Redis container is not
   running, **When** `npm test` runs, **Then** the run must not be affected
   by the real cache client's background reconnection attempts — either by
   neutralizing that connection target during tests (the same pattern
   already used for Firebase environment variables) or by explicitly closing
   the client if one was created during the run.
5. **Given** a backend test run and an e2e test run are launched at the same
   time on the same machine, **When** both attempt to bind the same default
   emulator ports, **Then** the conflict must be detected and reported with
   a clear message identifying the port and the conflicting process,
   instead of one run silently failing or waiting with no explanation.

**Edge Cases**:

- What happens on a brand-new machine running the emulator for the first
  time, before the Firestore emulator binary has been downloaded and
  cached locally? Whether that download counts inside the limits defined
  for this story must be clarified during planning.

---

### User Story 2 - An e2e run never hangs silently or needs a manual kill to finish (Priority: P1)

As a developer on the project, I want `npm test` in the e2e package to never
repeat the incident recorded on 2026-07-13 (a clean emulator startup
followed by more than three minutes with no progress, and a shutdown that
doesn't even respond cleanly to a manual interrupt), so that I can trust the
e2e suite to progress or fail visibly, without needing to watch it or kill
it by hand.

**Why this priority**: This is a real incident, captured in the repository
itself, that matches the reported problem most directly — a silent hang that
required manual intervention and didn't even shut down cleanly afterward.

**Independent Test**: Can be fully tested by running `npm test` in the e2e
package and confirming that any phase that fails to progress (emulator
startup, the three local dev servers starting up, or a test running)
produces a clear failure within a known time — and that manually
interrupting the process always produces a clean shutdown, without the
error loop seen in the incident log.

**Acceptance Scenarios**:

1. **Given** an e2e `npm test` run, **When** the suite makes no progress (no
   test starts or finishes) for longer than an explicit limit, **Then** the
   run fails visibly with a clear message, instead of the multi-minute
   silence observed in the recorded incident.
2. **Given** the e2e run currently has no global per-test timeout or overall
   run timeout configured, **When** those limits are added, **Then** they
   must also cover the phase before the first test (emulator startup plus
   the three local dev servers), which is exactly where the recorded
   incident occurred and where a per-test timeout alone doesn't apply yet.
3. **Given** the process receives an interrupt signal (SIGTERM/Ctrl+C)
   because a stuck run had to be cut short, **When** the Firebase emulator
   shuts down, **Then** it must complete within a bounded time without
   repeating the error loop seen in the incident log (thousands of repeated
   write errors from the CLI's logger trying to write to an already-closed
   pipe).
4. **Given** the exact root cause of the 2026-07-13 incident is not yet
   diagnosed from the log alone (it isn't certain whether the stall was in
   one of the three local dev servers starting up, in the frontend's
   Firebase Auth client connecting to the emulator, or in the first test
   waiting on the simulated sign-in popup), **When** this story is planned,
   **Then** planning must include an explicit diagnostic task (reproducing
   the hang with more granular logging) before deciding on the concrete
   technical fix — this spec intentionally does not prescribe the exact
   root cause, only the observed symptom.

**Edge Cases**:

- What happens if the hang occurs inside one of the three local dev servers
  the suite depends on, rather than in a test itself? Each already has its
  own startup timeout, but the recorded incident happened after emulator
  activity was already visible in the log, so whether those existing
  timeouts are actually being applied needs confirmation.
- What happens if Java is missing or an incompatible version on the
  machine running the suite? There is no explicit check today that fails
  fast with a clear message if Java is missing or incompatible.

---

### User Story 3 - CI never exhausts its default time limit, and the e2e suite runs there too (Priority: P2)

As the project owner, I want no CI job to be able to consume its default
6-hour limit because of a hang like the ones described in User Stories 1 and
2, and I want the e2e suite (which today only runs locally) to also run in
CI with the same guarantees, so these problems are caught before reaching
the main branch instead of depending on someone noticing it on their own
machine.

**Why this priority**: This depends on User Stories 1 and 2 already having
bounded the local wait times — bringing it to CI is the natural extension,
not the starting point.

**Independent Test**: Can be validated by deliberately provoking a
simulated hang in a job and confirming it fails within the agreed number of
minutes (not hours), and by confirming the new e2e job appears as a
required check on a pull request.

**Acceptance Scenarios**:

1. **Given** none of the current CI jobs define a maximum run time today,
   **When** any of them gets stuck, **Then** it must fail within an
   explicit, reasonable time limit for that job, instead of exhausting the
   platform's default 6-hour limit.
2. **Given** no e2e job exists in CI today, **When** one is added, **Then**
   it must run the e2e suite with a compatible Java runtime available and
   an explicit maximum run time — whether the CI runner already provides a
   compatible Java version out of the box, or one must be added explicitly,
   must be confirmed during planning.
3. **Given** the e2e job is added, **When** a pull request is opened,
   **Then** it must block merging as a required check from day one — the
   release/publish job MUST depend on it, the same way it already depends
   on the backend and frontend test jobs today.

**Edge Cases**:

- What happens if the CI runner doesn't have the Firestore emulator binary
  cached? The first download on a cold job run could add meaningful time to
  whatever limit is agreed — caching that directory between runs should be
  considered if the download time turns out to be significant.
- What happens with the three local dev servers the e2e suite depends on
  (frontend, backend, an external-API test stub) in the CI environment,
  which doesn't have a real developer's local environment file? Whether the
  test-only environment file the frontend needs already exists and is
  checked into the repository must be confirmed during planning before
  assuming CI can start all three servers without extra configuration.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backend test run MUST enforce an explicit, documented time
  limit on each individual test and each setup/teardown hook, so a stuck
  test or hook fails with a message identifying what timed out instead of
  running indefinitely.
- **FR-002**: The backend test run MUST enforce an explicit, documented time
  limit on Firebase emulator startup, ahead of test execution.
- **FR-003**: When all backend tests finish executing, the test process MUST
  exit within a bounded time; if a handle blocks exit (open socket, timer,
  connection), it MUST be detected and reported explicitly instead of
  leaving the wrapping emulator command waiting with no explanation.
- **FR-004**: Every direct call from backend test helpers to the Firebase
  emulator (Auth or Firestore) MUST fail within its own bounded time limit
  if the emulator doesn't respond, independent of the surrounding test's
  generic timeout.
- **FR-005**: The backend test run MUST NOT be affected by a real cache
  client's background reconnection attempts when its target service isn't
  running locally — either by neutralizing that connection target during
  tests (consistent with how Firebase environment variables are already
  protected) or by explicitly closing the client if the run created one.
- **FR-006**: When a backend test run and an e2e test run attempt to bind
  the same default emulator ports at the same time on one machine, the
  conflict MUST be detected and reported with a clear message identifying
  the port and the conflicting process, instead of one run silently failing
  or waiting with no explanation.
- **FR-007**: The e2e test run MUST enforce an explicit, documented time
  limit covering the phase before the first test starts (emulator startup
  plus all local dev servers the suite depends on), since that is where the
  recorded 2026-07-13 incident occurred and no existing per-test timeout
  covers it.
- **FR-008**: The e2e test run MUST enforce an explicit, documented overall
  time limit for the entire run, in addition to any per-test limit.
- **FR-009**: When the e2e process receives a manual interrupt (SIGTERM or
  Ctrl+C) to stop a stuck run, the Firebase emulator's shutdown MUST
  complete within a bounded time without repeating the write-error loop
  previously observed (thousands of repeated logger write failures against
  an already-closed pipe).
- **FR-010**: Before a concrete technical fix for the recorded e2e incident
  is selected, the root cause MUST be diagnosed (reproduced with more
  granular logging) to confirm which phase is actually stalling; this is a
  planning-phase prerequisite, not an assumption made by this
  specification.
- **FR-011**: Every CI job MUST have an explicit, reasonable maximum run
  time, so that a stuck job fails within minutes rather than exhausting the
  CI platform's default multi-hour limit.
- **FR-012**: CI MUST run the e2e suite automatically on the same events
  that already trigger the backend and frontend test jobs, with the same
  hang-prevention guarantees defined for local runs in User Story 2 — the
  e2e suite MUST NOT remain local-only.
- **FR-013**: The e2e CI job MUST be a required dependency of the
  release/publish job from day one, blocking pull request merges the same
  way the existing backend and frontend test jobs already do today.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: No local test run in either package (backend or e2e) requires
  a developer to manually interrupt it in order to finish.
- **SC-002**: Any hang that still occurs produces a clear failure with a
  known, documented wait time — never an indefinite silence like the one
  recorded on 2026-07-13.
- **SC-003**: Manually interrupting a stuck run always results in a clean
  emulator shutdown, with no repeated error loop like the one observed in
  the incident log.
- **SC-004**: No CI job can consume the platform's default multi-hour limit
  because of a stuck test; a stuck job is cancelled within a few minutes of
  reaching its own configured limit — never the platform's multi-hour
  default — regardless of how large or small that configured limit is.
- **SC-005**: The e2e suite runs automatically on every pull request in CI
  (today: 0% of pull requests get e2e coverage in CI), with the same
  hang-prevention guarantees established for local runs.

## Assumptions

- The exact root cause of the 3-minute-17-second silence recorded in the
  e2e incident log on 2026-07-13 is not diagnosed by this specification;
  planning is expected to include a reproduction/diagnostic task before the
  technical fix is chosen (User Story 2, FR-010).
- The Redis-related finding (FR-005) is included here because it produces
  the same symptom ("the test run hangs waiting") and surfaced while
  investigating the same test-environment startup file that also manages
  the Firebase emulator variables, even though it is not strictly a
  Firebase issue.
- Concrete timeout/limit values (in milliseconds or minutes) for every
  requirement above are intentionally left undefined here and are decided
  during planning, not prescribed by this specification.
- ~~Whether the CI runner's default image already provides a compatible Java
  runtime accessible on the `PATH`~~ — **resolved during planning**: the
  `ubuntu-latest` image pre-installs Java 8/11/17/21, but its *default*
  `java` on `PATH` resolves to 17 (and has already shifted once across
  runner-image generations), so the e2e CI job explicitly pins Java 21 via
  `actions/setup-java` rather than relying on that default (FR-012; see
  research.md §11).
- ~~Whether the frontend's test-only environment file exists and is checked
  into the repository~~ — **resolved during planning**: `frontend/.env.test`
  is confirmed tracked in git (`git ls-files`), so the e2e CI job needs no
  additional provisioning for it (Edge Cases of User Story 3; see
  research.md §11).
- The existing test-file isolation policy (single-worker execution for
  backend tests, already justified by the emulator's shared mutable state)
  is unchanged by this specification.
- Jest, `firebase emulators:exec`, and Playwright remain the tools used to
  run these suites; this specification does not propose replacing any of
  them.
- The simulated sign-in mechanism already validated for e2e auth testing is
  unchanged by this specification; only the missing time limits around it
  are in scope.

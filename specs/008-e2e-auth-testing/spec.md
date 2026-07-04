# Feature Specification: End-to-End Testing Without Real Google Sign-In

**Feature Branch**: `008-e2e-auth-testing`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Para este desarrollo quiero que nos centremos en la capacidad de poder ejecutar testing automatizado end to end solucionando la limitación conocida debido a superar la autenticación de firebase con google. La toma de requisitos para este desarrollo es la siguiente:
1. Investigar y solucionar de la mejor forma la actual limitación del proyecto para poder hacer tests automáticos debido a superar el login de firebase con google. revisar si existe algún tipo de bridge o autenticación diferente que se pueda realizar para los testes end to end.
2. Actualmente al ejecutar en /backend el comando npm test, en la salida por consola se producen errores. Se necesita revisar estos errores y corregir lo necesario para que superen los tests que actualmente están dando error.

Considera el uso de herramientas de terceros si son necesarias para combatir la limitación debido al login de firebase."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automated end-to-end verification of the Google sign-in journey (Priority: P1)

As a developer or reviewer, I want the complete "Sign in with Google → session established → authenticated view" journey to be verified automatically, without any human clicking through a real Google account picker, so that a broken login is caught before it reaches manual testing or production.

Today this is not possible: the sign-in button drives a real Google OAuth popup, which cannot be operated by an automated test (no real Google account can be safely scripted, and Google actively blocks automated interactions with its consent screens). As a result, the sign-in flow — the single most critical journey in the app, since every other feature sits behind it — has only ever been verified by a person clicking through it manually.

**Why this priority**: Sign-in gates every other feature in the app. Without an automated way to verify it, every release depends on a human re-testing the same login journey, and regressions can silently reach production between manual checks.

**Independent Test**: Can be fully tested by running the new automated suite from a clean checkout, with no supporting services already running and no human present, and confirming it drives the real sign-in trigger, reaches the authenticated view, and reports a clear pass/fail — without opening a real Google account picker or requiring credentials typed by a person.

**Acceptance Scenarios**:

1. **Given** a clean environment with no manual setup beyond documented steps, **When** the automated suite runs the sign-in scenario, **Then** it completes the entire sign-in journey (trigger sign-in, establish a session, reach the authenticated view showing the signed-in user's name) without any human input and without a real Google account or password.
2. **Given** a session produced by the automated sign-in, **When** the suite reloads the page, **Then** the suite confirms the user remains recognized as signed in, matching today's manual "returning visitor" check.
3. **Given** a session produced by the automated sign-in, **When** the suite triggers sign-out, **Then** it confirms the user is returned to the anonymous landing state and reloading does not restore the session.
4. **Given** the sign-in flow is broken (for example, the backend session step starts failing), **When** the automated suite runs, **Then** it fails with a clear, specific message pointing at the broken step, rather than timing out silently or failing with an unrelated error.
5. **Given** the suite is run repeatedly back-to-back, **When** each run completes, **Then** it produces a consistent (non-flaky) result and leaves no leftover test accounts or data that would affect the next run.

---

### User Story 2 - A trustworthy, self-contained backend test command (Priority: P2)

As a developer, I want `npm test` in the backend to run to a fully passing result using only documented setup steps, so that I can trust a green result and rely on it to gate my changes.

Today, running `npm test` directly reports a large number of failures across contract, integration, and unit test files. The underlying cause is the same in every case: those tests depend on supporting emulated services that the plain `npm test` command does not ensure are running, so the failures look like a broken test suite rather than what they actually are — a missing prerequisite.

**Why this priority**: An unreliable "standard" test command undermines trust in the whole suite and makes it easy to miss a real regression among dozens of environment-related failures. It is a prerequisite for confidently relying on User Story 1's suite as well.

**Independent Test**: Can be fully tested by starting from a clean checkout, installing dependencies, and running only the documented backend test command — with no extra manual steps — and confirming every test passes.

**Acceptance Scenarios**:

1. **Given** a clean checkout with dependencies installed, **When** a developer runs the backend's standard test command following only documented setup steps, **Then** all tests pass with no failures caused by missing supporting infrastructure.
2. **Given** the same standard test command, **When** it is run twice in a row, **Then** both runs pass consistently with the same result.
3. **Given** a genuine bug is introduced in the code under test, **When** the standard test command runs, **Then** it fails specifically because of that bug — not masked or mixed in with unrelated infrastructure failures.

---

### Edge Cases

- What happens when the service that stands in for Google sign-in during automated tests fails to start or isn't reachable when the end-to-end suite runs? The suite MUST fail fast with a clear, actionable message rather than hanging or producing an unrelated error.
- What happens if an end-to-end run is accidentally pointed at the real, production Firebase project instead of an isolated test environment? This MUST be prevented or clearly and loudly blocked, since it risks creating real accounts, sending real emails, or touching real user data.
- How are the existing manually-tested edge cases (closing the Google popup without choosing an account; the browser blocking the popup) represented once sign-in is simulated rather than driven through the real Google popup? At minimum, the equivalent "sign-in did not complete" outcome must still be exercised and shown to produce the app's existing friendly error/retry state.
- What happens when the ports or processes the backend test command needs are already occupied by something else on a developer's machine? The command MUST surface a clear message identifying the conflict rather than an opaque connection failure.
- What happens when a tool the backend test command now depends on to become self-contained (e.g., a local emulator or CLI) is missing entirely from the machine? The command MUST fail with instructions for what to install, rather than the current generic errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST provide an automated way to simulate a complete Google sign-in for tests that does not require a real Google account, human interaction with an account picker or consent screen, or credentials typed by a person.
- **FR-002**: The simulated sign-in MUST exercise the same application trigger, session-establishment step, and resulting authenticated state that a real user's Google sign-in produces, so that a regression in any of those steps is caught.
- **FR-003**: The end-to-end suite MUST run unattended (headless), from start to finish, with no human interaction required at any point, so it can be executed on demand or wired into an automated pipeline.
- **FR-004**: The end-to-end suite MUST cover, at minimum, the sign-in, returning-session, and sign-out scenarios already described in the existing login feature's validation steps (see User Story 1, Acceptance Scenarios 1–3).
- **FR-005**: End-to-end test runs MUST NOT use, depend on, or be able to accidentally reach real Google accounts, real Google infrastructure, or the project's production Firebase project.
- **FR-006**: End-to-end test runs MUST leave no residual test data behind that would affect a subsequent run (each run starts from, and returns to, a clean state).
- **FR-007**: The project MUST document, for developers, how to run the new end-to-end suite locally, including any prerequisite services and how they are started and stopped.
- **FR-008**: Running the backend's standard test command from a clean checkout, after installing dependencies and following only documented setup steps, MUST complete with all tests passing.
- **FR-009**: If backend tests depend on supporting emulated services, the standard test command MUST ensure those services are available automatically as part of running the command, rather than failing with connection errors when they are absent.
- **FR-010**: Fixing the backend test command MUST NOT reduce test coverage — no currently-failing test may be skipped, deleted, or weakened; each one MUST be made to genuinely pass by addressing the cause of its failure.
- **FR-011**: The corrected backend test command MUST behave the same way for a developer running it locally and for an unattended (CI-like) invocation, with no manual steps required in either case.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer or automated process can go from a clean checkout to a pass/fail result for the complete sign-in journey in under 5 minutes, with zero manual interaction.
- **SC-002**: The end-to-end sign-in suite produces a consistent result (no flakiness) across at least 10 consecutive runs.
- **SC-003**: Zero real Google accounts, passwords, or manual consent screens are involved in any automated test run, across the full suite.
- **SC-004**: 100% of the backend test cases that currently fail when running the standard test command pass after the fix, with the same 100% pass rate reproduced across at least 10 consecutive clean runs.
- **SC-005**: A new contributor can go from a clean checkout to a fully green backend test result and a fully green end-to-end sign-in result by following only the project's documented steps, without needing to ask another team member how to make the tests pass.

## Assumptions

- "End-to-end" here means driving the real application through the same entry point a user would (the sign-in trigger in the browser), through session establishment, to the authenticated view — not merely re-testing the backend API in isolation. The backend's existing contract/integration tests already prove the API-level authentication logic works; the gap this feature closes is specifically the browser-driven, real-Google-popup step that has blocked full front-to-back automation.
- This feature delivers the general capability to run automated end-to-end tests against the app (solving the Google sign-in blocker) and proves it out on the sign-in/session/sign-out journey itself, since that is the journey explicitly blocked today. Extending end-to-end coverage to other existing features (search, library management) is valuable follow-up work but is not required for this feature to be complete.
- Solving the sign-in limitation may reasonably involve adopting a third-party end-to-end testing tool and/or an existing Firebase-provided mechanism for substituting a test identity provider during automated tests, per the request's explicit openness to third-party tools. The specific tool/mechanism is a planning-phase decision informed by investigation, not a requirement fixed here.
- No continuous-integration pipeline currently exists in this project. Making both suites capable of running unattended (headless, no manual steps) is required so they are CI-ready; actually standing up a CI pipeline to invoke them automatically on every change is out of scope for this feature.
- The backend test failures observed today all stem from the same root cause (tests that depend on supporting emulated services not being available when the standard command runs) rather than from bugs in the application logic under test; "fixing the tests" means making the standard command reliably provide those prerequisites, not changing application behavior.
- Fixing the backend test command may reuse or consolidate existing project mechanisms already capable of providing the required supporting services, rather than requiring anything to be built from scratch.

# Implementation Plan: End-to-End Testing Without Real Google Sign-In

**Branch**: `008-e2e-auth-testing` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-e2e-auth-testing/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Close the two known gaps blocking a trustworthy automated test story: (1) the
"Sign in with Google" journey has never been verifiable end-to-end because a
real Google OAuth popup can't be scripted, and (2) the backend's plain
`npm test` fails 42/74 tests for a purely environmental reason. The approach
(research.md): drive the real sign-in button against the Firebase Auth
emulator's built-in fake-identity-provider popup using a new Playwright suite
(`e2e/`), and make `npm test` wrap itself with `firebase emulators:exec` so
the standard command is self-contained. No production authentication logic
changes; the frontend gains one small, opt-in emulator-connection guard.

## Technical Context

**Language/Version**: TypeScript, Node.js (matching `backend`'s and
`frontend`'s existing toolchains — no new language)

**Primary Dependencies**: `@playwright/test` (new, `e2e/` project only);
existing `firebase` (frontend client SDK, gains an emulator-connection call)
and `firebase-tools` (already a `backend` devDependency, used to
start/stop the emulators for both the corrected `npm test` and the e2e
`webServer` config)

**Storage**: N/A — no persistent data introduced; ephemeral fixture
identities and emulator state only (data-model.md)

**Testing**: Playwright Test (new `e2e/` suite, browser-driven); Jest
(existing `backend` suite — behavior corrected, not replaced); Vitest
(existing `frontend` suite — unchanged)

**Target Platform**: Same as the rest of the app — Node.js server (backend)
and browser (frontend); the e2e suite targets a Chromium browser locally/CI

**Project Type**: Web application (existing `backend` + `frontend` split),
plus one new top-level `e2e/` test project that spans both

**Performance Goals**: N/A (test-infrastructure feature; see Success
Criteria in spec.md for the runtime/reliability targets that stand in for
performance goals here — e.g., SC-001's under-5-minutes clean-checkout run)

**Constraints**: MUST NOT contact real Google infrastructure or the
production Firebase project under any circumstance (FR-005); MUST run fully
unattended/headless (FR-003); MUST NOT reduce existing backend test coverage
(FR-010)

**Scale/Scope**: One new e2e test project covering the sign-in / returning-
session / sign-out journey (3 scenarios per spec's Acceptance Scenarios);
one corrected npm script in `backend`; one small, opt-in addition to
`frontend/src/services/firebaseClient.ts`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: This feature *is* test infrastructure,
  not a product feature with tests bolted on — there is no separate
  "implementation first" to sequence against. The e2e suite's own scenarios
  (sign-in / returning-session / sign-out) are themselves the tests; they
  must fail against the current, unmodified `AuthContext.tsx`/emulator-less
  `firebaseClient.ts` before the small emulator-opt-in change is added,
  preserving Red-Green in spirit. **PASS**.
- **II. Library-First & Modularity**: The new `e2e/` project is
  self-contained with its own `package.json`, config, and a single
  well-defined helper interface ([contracts/e2e-sign-in-helper.md](./contracts/e2e-sign-in-helper.md))
  that spec files depend on — no shared mutable state with `backend`/
  `frontend` beyond the documented environment variables. **PASS**.
- **III. Simplicity, YAGNI & KISS**: Reuses the emulator mechanism the
  backend already trusts rather than inventing a new one; uses Playwright's
  built-in `webServer` orchestration instead of adding a process-manager
  dependency; consolidates `npm test`/`test:emulators` into one command
  instead of maintaining two. No speculative multi-browser/multi-provider
  support is added beyond what FR-001–FR-011 ask for. **PASS**.
- **IV. SOLID Design**: The fake-sign-in helper is the single seam e2e specs
  depend on (Dependency Inversion — specs don't reach into emulator
  internals directly); it has one responsibility (drive the sign-in trigger
  to an authenticated state) and doesn't leak popup/emulator mechanics to
  callers. **PASS**.
- **V. Observability**: The sign-in helper's failure contract requires
  naming which step failed (popup / close / authenticated-state) rather than
  a bare timeout, extending the existing structured-failure expectation to
  test tooling. **PASS**.
- **VI. Versioning & Breaking Changes**: No API contract, schema, or stored
  data changes. **N/A**.
- **Technology Stack**: Introduces one new dependency (`@playwright/test`)
  scoped to the new `e2e/` project — not a deviation from the required
  frontend/backend/database/deployment stack, so no Complexity Tracking entry
  is needed. **PASS**.

No violations requiring justification — Complexity Tracking table is empty.

## Project Structure

### Documentation (this feature)

```text
specs/008-e2e-auth-testing/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── e2e-sign-in-helper.md
│   └── backend-test-command.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── package.json          # "test" script corrected to wrap firebase emulators:exec
│                          # (research.md §3, contracts/backend-test-command.md)
└── tests/                # unchanged — same 74 tests, now reliably passing

frontend/
├── src/
│   └── services/
│       └── firebaseClient.ts   # + opt-in connectAuthEmulator guard (research.md §4)
└── tests/                # unchanged — existing Vitest/RTL suite untouched

e2e/                       # NEW — cross-cutting project, sibling to backend/ and frontend/
├── package.json
├── playwright.config.ts   # webServer: [emulators, backend dev, frontend dev]
├── helpers/
│   └── fakeGoogleSignIn.ts   # contracts/e2e-sign-in-helper.md
└── tests/
    ├── sign-in.spec.ts        # US1 AC1
    ├── returning-session.spec.ts  # US1 AC2
    └── sign-out.spec.ts       # US1 AC3
```

**Structure Decision**: Web application (existing `backend` + `frontend`
split, unchanged), plus a new top-level `e2e/` project. `e2e/` is not nested
inside `frontend/` because it depends on and orchestrates *both* the frontend
and backend dev servers plus the shared Firebase emulators (data-model.md
§2) — it is a peer of both, not a concern of either alone, consistent with
Principle II (Library-First & Modularity: a clear, single-purpose,
independently runnable module).

## Complexity Tracking

*No violations — this section is intentionally empty.*

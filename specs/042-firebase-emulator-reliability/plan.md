# Implementation Plan: Backend & E2E Test Suite Firebase Emulator Reliability

**Branch**: `042-firebase-emulator-reliability` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/042-firebase-emulator-reliability/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Bound every point where `backend/`'s Jest suite or `e2e/`'s Playwright suite
(both wrapped in `firebase emulators:exec`) can hang indefinitely today, so a
real problem produces a fast, clear failure instead of the silent hang and
unclean-shutdown loop captured in `e2e/firebase-debug.log` on 2026-07-13.
Technical approach: layer explicit timeouts at every level (Jest
`testTimeout` + `--detectOpenHandles --forceExit`, `AbortSignal.timeout` on
direct emulator `fetch` calls, `REDIS_URL` neutralization in test setup,
Playwright `timeout`/`globalTimeout`, a shared cross-platform Node wrapper
script around both packages' `emulators:exec` invocations for the startup
phase), add `timeout-minutes` to every CI job, and add a new required e2e CI job
with a pinned Java runtime and emulator-jar caching. One diagnostic task
(live reproduction with granular logging) is required before implementing
the specific fix for the still-undiagnosed 2026-07-13 stall (FR-010).

## Technical Context

**Language/Version**: TypeScript on Node.js 20 (matches `.github/workflows/ci.yml`'s `node-version: 20`), both `backend/` (`"type": "commonjs"`) and `e2e/` packages.

**Primary Dependencies**: `backend/`: Jest `^29.7.0` + `ts-jest`, `firebase-tools` `^13.20.2`, `ioredis` `^5.11.1`. `e2e/`: `@playwright/test` `^1.61.1`, `firebase-tools` `^13.20.2`. CI: GitHub Actions (`.github/workflows/ci.yml`).

**Storage**: N/A — this feature changes test/CI configuration only; no application data model or persistence is touched.

**Testing**: Jest (backend unit/integration, Firebase Auth+Firestore emulator-backed) and Playwright (e2e, same emulators plus three local `webServer` processes). This feature *is* the reliability layer around that tooling, not a consumer of it — validation is via the deliberate-failure-injection scenarios named in each user story's "Independent Test" (see quickstart.md).

**Target Platform**: Local developer machines (macOS confirmed: Java 21.0.6, `~/.cache/firebase/emulators/` populated) and GitHub Actions `ubuntu-latest` (Ubuntu 24.04 image, Java 8/11/17/21 pre-installed, default `java` on `PATH` resolves to 17 — see research.md §11 for why an explicit Java version is pinned instead of relying on that default).

**Project Type**: Web application (existing `frontend/` + `backend/` + `e2e/` structure) — no new application code paths; changes are confined to test configuration, test helper files, and the CI workflow.

**Performance Goals**: Not a runtime-performance feature. The equivalent goal is *bounded wall-clock time*: every hang point gets an explicit, documented ceiling (see spec Success Criteria SC-002, SC-004) rather than running indefinitely.

**Constraints**: Must not change the existing single-worker test-isolation policy (`maxWorkers: 1` in `backend/jest.config.js`, justified by shared emulator state — out of scope per spec). Must not replace Jest, Playwright, or `firebase emulators:exec` with different tooling (out of scope per spec). Must not weaken the existing e2e sign-in simulation (`page.waitForEvent('popup')`, validated since spec 008).

**Scale/Scope**: 2 test packages (`backend/`, `e2e/`), 3 existing CI jobs (`backend-test`, `frontend-test`, `release`) plus 1 new (`e2e-test`), 3 `webServer` processes in the e2e suite (Discogs OAuth stub, backend, frontend).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Applies? | Assessment |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Yes, adapted | This feature's subject *is* the test infrastructure, so there's no separate application-level failing test to write first. Each user story instead defines its own falsifiable validation up front (see "Independent Test" in each story and `quickstart.md`): deliberately provoke the failure condition (slow emulator, unresponsive `fetch`, stopped Redis, port conflict, stalled e2e phase, stuck CI job) and confirm a bounded, clear failure — written and run *before* considering the fix complete, preserving the spirit of Red-Green-Refactor for a config/tooling change. |
| II. Discogs Integration-First & Modularity | No | Feature touches no Discogs code paths. |
| III. Simplicity, YAGNI & KISS | Yes | Every research.md decision explicitly prefers existing, standard tool flags (`testTimeout`, `--detectOpenHandles`, `--forceExit`, `AbortSignal.timeout`, `globalTimeout`, `actions/setup-java`, `actions/cache`) over new dependencies — the one exception, a small Node timeout-wrapper script (`scripts/run-with-timeout.js`), is itself the simpler cross-platform choice once macOS local use is accounted for (see research.md §3). |
| IV. SOLID Design | No | No new classes/modules with responsibilities to separate; changes are config values and a handful of call-site edits. |
| V. Observability | Yes | Core to this feature: FR-001, FR-003, FR-004, FR-006 all require a *clear, identifying* failure message rather than a silent or generic one. |
| VI. Versioning & Breaking Changes | No | No data schema or API contract changes. |
| VII. Curated Ratings & Music News | No | Not touched. |
| Web Application Standards (API contracts, migrations) | No | No API or schema changes. |
| UI Design System & Styling | No | No UI changes. |
| Dev Workflow: Conventional Commits | Yes | All commits for this feature MUST follow Conventional Commits as usual (`test:`/`fix:`/`ci:`/`chore:` as appropriate). |
| Dev Workflow: mandatory e2e coverage for `/frontend` PRs | No | This feature adds no `/frontend` code changes; it makes the *existing* e2e suite reliable and CI-enforced (User Story 3), which strengthens rather than triggers this gate. |
| Dev Workflow: no manual `CHANGELOG.md`/version edits | Yes | Applies as usual; not touched by this plan. |

**Result**: PASS. No violations requiring justification — Complexity Tracking table below is left empty.

## Project Structure

### Documentation (this feature)

```text
specs/042-firebase-emulator-reliability/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command) — no entities; documents that explicitly
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature exposes no new API, CLI, or UI
surface to users or other systems — it only reconfigures existing test
tooling and CI, so there is no interface contract to document.

### Source Code (repository root)

```text
scripts/
└── run-with-timeout.js       # new shared cross-platform wrapper (Node child_process),
                               # used by both backend/ and e2e/ test scripts

backend/
├── package.json              # `test` script: wrap with scripts/run-with-timeout.js;
                               # add --detectOpenHandles --forceExit to the Jest invocation
├── jest.config.js            # add explicit testTimeout
├── firebase.json             # referenced for the fixed emulator ports (9099/8080); no change expected
└── tests/
    └── helpers/
        ├── authEmulator.ts   # add AbortSignal.timeout(...) to each fetch()
        └── setupEnv.ts       # add REDIS_URL to the pre-dotenv neutralized block

e2e/
├── package.json              # `test` script: wrap with scripts/run-with-timeout.js
└── playwright.config.ts      # add explicit `timeout` + `globalTimeout`

.github/
└── workflows/
    └── ci.yml                # add timeout-minutes to backend-test/frontend-test/release;
                               # add new e2e-test job (actions/setup-java, actions/cache for the
                               # emulator jar, timeout-minutes); make release depend on e2e-test

frontend/                     # untouched — no application code changes in this feature
```

**Structure Decision**: Existing web-application layout (`backend/` +
`frontend/` + `e2e/` + `.github/workflows/`) is unchanged. This feature adds
no new top-level directories; all changes are edits to existing test
configuration, two existing test-helper files, and the CI workflow file.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally left empty. See Constitution Check
above: every applicable gate passed without requiring a documented
exception.

## Post-Design Constitution Re-Check

*GATE: Re-checked after Phase 1 design (research.md, data-model.md, quickstart.md).*

Re-evaluated against the same table above after completing research and
design: no new dependency, API surface, data entity, or architectural
pattern was introduced during Phase 0/1 that wasn't already accounted for
in the pre-design check. **Result**: PASS, unchanged from the pre-design
assessment.

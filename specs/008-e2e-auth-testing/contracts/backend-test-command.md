# Contract: Backend Test Command

**Command**: `npm test` (run from `/backend`)

## Before this feature

| Aspect | Behavior |
|---|---|
| Prerequisite services | Auth (`:9099`) / Firestore (`:8080`) emulators, but **not started automatically** |
| Result with no emulators running | 42/74 tests fail with `TypeError: fetch failed` |
| Result with emulators already running (e.g. via `test:emulators` in another shell) | 74/74 pass |

## After this feature

| Aspect | Behavior |
|---|---|
| Prerequisite services | Auth / Firestore emulators, **started and torn down automatically** as part of the command |
| Exit code | `0` iff all tests genuinely pass; non-zero otherwise — identical semantics to a plain `jest` invocation, just with the prerequisite guaranteed |
| Required local tooling | The Firebase CLI (already a `devDependency` via `firebase-tools`); no new external tool required |
| Behavior if the emulator ports are already bound by another process | MUST fail fast with the Firebase CLI's own "port already in use" message — MUST NOT be silently swallowed or produce the old unrelated `fetch failed` errors |
| Behavior in CI vs. local | Identical — no CI-specific branching (FR-011) |
| Test coverage | Unchanged: same 74 test cases, same assertions (FR-010) |

## Non-goals

- This contract does not add a CI pipeline that invokes the command
  automatically (spec Assumptions) — it only makes the command itself
  reliable whenever and wherever it's invoked.
- `test:emulators` (or whatever script currently wraps this behavior) MAY be
  removed once `npm test` subsumes it, to avoid two overlapping commands
  (research.md §3) — a Phase 2 task decision, not a behavior change tracked
  here.

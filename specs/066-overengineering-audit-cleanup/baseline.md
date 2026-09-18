# Baseline (T001) — pre-refactor test results

Recorded 2026-09-18 on branch `066-overengineering-audit-cleanup` at commit `5b71939`, before any source change (only spec docs modified). No source, test, or config files were changed to obtain these results.

**Result: all green. No pre-existing failures in any suite.**

## 1. Backend (Jest + Firebase emulators)

- Command: `cd backend && npm test`
  (pretest `node ../scripts/check-emulator-ports.js`, then `run-with-timeout.js 300 -- firebase emulators:exec --only auth,firestore "cross-env NODE_ENV=test jest --detectOpenHandles --forceExit"`)
- Exit code: 0
- Test suites: 90 passed / 0 failed / 90 total
- Tests: **773 passed / 0 failed / 0 skipped** (773 total)
- Jest time: ~130 s
- Pre-existing failures: none
- Noise (not failures): many `● Console` blocks from the structured logger (e.g. `requireAuth` warn lines) — expected output from negative-path tests.

## 2. Frontend (Vitest + oxlint)

- Command: `cd frontend && npm test && npm run lint`
- `npm test` (`vitest run`): exit 0 — test files 107 passed / 107; tests **816 passed / 0 failed / 0 skipped**
- `npm run lint` (`oxlint`): exit 0 — **0 errors, 10 warnings**, all `react(only-export-components)`:
  - `src/components/ui/Button.tsx` (51, 64)
  - `src/components/MasterReleaseOtherDetailsSection.tsx` (9)
  - `src/motion/Sheet.tsx` (36, 55)
  - `src/auth/AuthContext.tsx` (140)
  - `src/components/GalleryFullscreenViewer.tsx` (44)
  - `src/theme/ThemeContext.tsx` (80)
  - `src/components/MyCopySection.tsx` (10, 21)
- Pre-existing failures: none. The refactor should not raise the warning count above 10.

## 3. E2E (Playwright, 4 spec files, under emulators:exec)

- Command (same wrapper as `e2e/package.json` `test`, restricted to four files):
  ```
  cd e2e && node ../scripts/check-emulator-ports.js && \
  node ../scripts/run-with-timeout.js 1680 -- npx firebase --config ../backend/firebase.json \
    emulators:exec --only auth,firestore --project vinylmania-test \
    "playwright test library-filters.spec.ts search-result-filters.spec.ts record-detail-responsive.spec.ts release-detail-responsive.spec.ts --reporter=list"
  ```
- Exit code: 0
- Totals: **117 passed / 0 failed / 2 skipped** (~3.0 min)
- Breakdown (passed):

  | Project  | Spec file                                  | Passed |
  |----------|--------------------------------------------|--------|
  | chromium | library-filters.spec.ts                    | 18 |
  | chromium | search-result-filters.spec.ts              | 29 (+2 skipped) |
  | chromium | record-detail-responsive.spec.ts           | 11 |
  | chromium | release-detail-responsive.spec.ts          | 14 |
  | chromium | master-release-detail-responsive.spec.ts   | 10 |
  | webkit   | record-detail-responsive.spec.ts           | 11 |
  | webkit   | release-detail-responsive.spec.ts          | 14 |
  | webkit   | master-release-detail-responsive.spec.ts   | 10 |

- Notes:
  - Playwright file args are substring/regex filters, so `release-detail-responsive.spec.ts` also matched `master-release-detail-responsive.spec.ts` (20 of the 117). Re-runs with the same command are comparable.
  - The `webkit` project's `testMatch` only includes the three detail-responsive specs, so `library-filters` and `search-result-filters` run on chromium only (by config, not a failure).
- Skipped (pre-existing `test.fixme`, not failures):
  - `search-result-filters.spec.ts:439` — "selecting multiple formats narrows results to releases matching all of them together" — fixme: app serializes formats in fixed order, test expects click order (see specs/042 research.md).
  - `search-result-filters.spec.ts:948` — "a mobile viewport opens each selectable list as a full-screen modal…" — fixme: known product bug, `SelectableListFilter` never passes `position="end"` to `Modal`.
- Pre-existing failures: none.

## Environment

- No port conflicts; backend and e2e runs were sequential (they share emulator ports). Frontend ran concurrently with backend (no emulator use).
- Java / Firebase emulators started normally for both backend and e2e.

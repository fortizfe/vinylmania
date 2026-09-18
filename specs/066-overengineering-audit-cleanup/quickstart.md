# Quickstart: Validating the Audit Cleanup

Run from the repo root. Every step must behave exactly as on `main` (spec SC-003, SC-004).

## US1: dependencies removed

1. Remove the packages and confirm no import of them is left:
   ```bash
   grep -n '"dotenv"\|"cross-env"' backend/package.json e2e/package.json   # expect: no output
   grep -rn "dotenv" backend/src backend/api e2e/*.ts                       # expect: no output
   ```
2. **Env file loads and the shell wins:** with a `backend/.env` containing `PORT=4000`, run `npm run dev` in `backend/` and expect "listening on port 4000". Then run `PORT=4100 npm run dev` and expect port 4100.
3. **No env file:** temporarily move `backend/.env` away, run `npm run build && npm start` in `backend/`, and expect the server to start without an ENOENT crash.
4. **NODE_ENV is still `test`:** run `npm test` in `backend/` and expect the full suite to pass (the emulator-backed tests depend on `NODE_ENV=test`).
5. **E2E env:** run `npm test` in `e2e/` and expect the suite to pass with the `frontend/.env.test` values loaded.

## US2: one shared URL-filter implementation

```bash
cd frontend && npx vitest run tests/unit/hooks/useLibraryQueryParams.test.tsx tests/unit/useSearchQueryParams.test.tsx
cd ../e2e && npx playwright test library-filters.spec.ts search-result-filters.spec.ts
```
Expected: all pass with no test file changed.

## US3: hygiene

```bash
cd backend && npx tsc --noEmit && npm run lint
cd ../frontend && npx tsc -b --noEmit && npm run lint && npm test
cd ../backend && npx jest tests/unit/cache      # cache-aside fail-soft + single-flight unchanged
cd ../e2e && npx playwright test record-detail-responsive.spec.ts release-detail-responsive.spec.ts
```
Expected: all green, with the detail-page column layout unchanged on chromium and webkit.

## Size check (SC-001 and SC-002)

```bash
git diff --stat main -- backend/src backend/api frontend/src e2e/playwright.config.ts   # net ≤ -50 lines
```

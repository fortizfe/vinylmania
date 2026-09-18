# Research: Over-engineering Audit Cleanup

Every audit claim was re-verified against the installed code/runtime before planning. Two claims (findings 2 and 4) did not survive and were moved out of scope in `spec.md`.

## R1 — Env-file loading without `dotenv` (finding 6)

- **Decision**: Replace `import 'dotenv/config'` in `backend/src/server.ts` and `backend/api/index.ts` with a guarded `if (existsSync('.env')) process.loadEnvFile();`. In `e2e/playwright.config.ts`, replace `dotenv.config({ path })` with the same guard on that path.
- **Rationale**: Verified locally: `process.loadEnvFile()` does **not** override variables already set in the shell (`A=shell` wins over `A=file`), matching dotenv's default precedence. It **throws `ENOENT`** when the file is absent, whereas dotenv silently skipped, so the `existsSync` guard is required (Vercel serverless, CI and production have no `.env`). Available since Node 20.12; CI uses Node 24, Vercel defaults to 24, `@types/node` ^22 types it.
- **Alternatives considered**: `node --env-file-if-exists` flag — it would have to be added to every launcher (`ts-node-dev`, `node dist/server.js`, Vercel's function runtime, and Playwright's config, which is not launched by us with node flags), so it's less reliable than one guarded line per entrypoint. A bare `try { loadEnvFile() } catch {}` would also hide real parse errors.

## R2 — Overlays on native `<dialog>` (finding 2) → REJECTED

- **Decision**: Keep the existing overlay hooks (`useFocusTrap`, `useRestoreFocus`, `useEscapeKey`, `useScrollLock`).
- **Rationale**: Measured with the repo's Playwright in both configured engines, on a `showModal()` dialog with two buttons, pressing Tab repeatedly:
  - chromium: `a > b > BODY > a > b`
  - webkit: `a > b > BODY > d > a`
  Focus escapes to the document/browser chrome each cycle, so the native modal does **not** trap focus the way the existing `expectFocusTrapped` e2e assertions (spec 059) require. The Tab-wrap handler, which is most of `useFocusTrap`, would have to stay. The native dialog also doesn't lock scroll, so `useScrollLock` stays too. That leaves ~30 lines of savings (Escape plus focus restore), against a restructure of the 285-line animated `Overlay`: top layer versus the `m.div` scrim, scrim clicks landing on `::backdrop`, `role="dialog"` nesting, and the e2e selectors `[data-testid=…-backdrop] [role=dialog]`.
- **Alternatives considered**: Native dialog plus a kept Tab-wrap. Rejected for the cost/benefit reason above.

## R3 — `useReducedMotion` from `motion/react` (finding 4) → REJECTED

- **Decision**: Keep `frontend/src/motion/usePrefersReducedMotion.ts`.
- **Rationale**: The installed `framer-motion` source (`utils/reduced-motion/use-reduced-motion.mjs`) does `useState(prefersReducedMotion.current)` with the comment "TODO See if people miss automatically updating shouldReduceMotion setting". It never re-renders on an OS setting change, while the current hook subscribes to `matchMedia` `change` events, and spec 059 behaviour depends on that.
- **Alternatives considered**: `useReducedMotionConfig`. It reads the `MotionConfig` setting, not the live OS preference, so it doesn't fit either.

## R4 — Dropping `cross-env` (finding 5)

- **Decision**: Change the backend `test` script's inner command from `cross-env NODE_ENV=test jest …` to `jest …`.
- **Rationale**: `backend/node_modules/jest-cli/bin/jest.js` lines 12–13: `if (process.env.NODE_ENV == null) process.env.NODE_ENV = 'test';`. The only difference is when a caller has already exported a different `NODE_ENV`: the old script forced `test`, the new one keeps theirs. Neither CI nor any repo script sets `NODE_ENV` before running backend tests.
- **Alternatives considered**: `NODE_ENV=test jest` inline. That would work in POSIX shells only, and not needed given Jest's default.

## R5 — Shared URL-filter helper (finding 3)

- **Decision**: A new module `frontend/src/hooks/catalogFilterParams.ts` exports `CatalogFilters`, `readCatalogFilters(params)` and `writeCatalogFilters(params, filters)`, holding the one copy of `MULTI_VALUE_FILTERS`, `parseMultiValueParam` and `buildMultiValueParam`. `useLibraryQueryParams.ts` and `useSearchQueryParams.ts` keep their public API: hook names, `build*Path` signatures, and `LibraryFilters` / `SearchFilters` as type aliases of `CatalogFilters`. Their existing unit tests and all call sites stay unchanged.
- **Rationale**: A diff shows the two files are identical except for `q` handling and the base path. Keeping the public API makes the change invisible to the 4+ importers and pins behavior with the existing tests (Test-First: the tests already exist and are green).
- **Alternatives considered**: Merge both hooks into one parametrised hook. Rejected: it changes every call site for no extra line savings.

## R6 — Delegating cache functions (finding 7)

- **Decision**: In `backend/src/adapters/cache/cacheAdapter.ts`, drop the `withCache` / `invalidate` wrapper functions and build the object as `{ has, set, withCache: withCacheAside, invalidate: invalidateCache }`.
- **Rationale**: The wrappers only forward their arguments. Single-flight and fail-soft behavior live in `cacheAside.ts`, which doesn't change.

## R7 — Unused `ready` value (finding 8)

- **Decision**: Remove the `ready` state, its setter calls, the interface field and the return key from `useIndependentColumnLayout`.
- **Rationale**: No consumer or test reads `.ready`. The field's own doc comment calls it "unused today".

## R8 — File-local exports (finding 10)

- **Decision**: Remove `export` from symbols that appear only in their defining file, re-running the occurrence scan against `src` **and** `tests` so any test import keeps its export. Verify with `tsc --noEmit` (backend, frontend) and lint.
- **Rationale**: This is zero-risk, and the type-checker catches every mistake.

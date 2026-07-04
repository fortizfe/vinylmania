# Deployment Config Contracts

This feature has no network/API surface of its own (see spec Assumptions — no
new routes). Its "contracts" are the two `vercel.json` files each project reads,
and the environment variable names each depends on (data-model.md §3). These are
the boundaries Phase 2 tasks must implement against, and what quickstart.md
verifies.

## `backend/vercel.json`

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/api/index.ts" }
  ]
}
```

**Contract**:
- MUST NOT reference any path outside `backend/` (no `../frontend`, no
  `backend/` prefix on its own paths — this file's paths are already relative
  to the project's Root Directory once Root Directory = `backend`).
- The rewrite MUST catch every path (`/(.*)`) so both `/health` and every
  `/api/*` route continue to resolve to the same Express app, unchanged
  (FR-001, FR-009).
- MUST NOT declare an explicit `functions.*.runtime` for `api/index.ts`.
  Vercel auto-detects the Node.js builder for `.ts`/`.js` files under `api/`;
  pinning `runtime` requires an *exact* published version of `@vercel/node`
  (e.g. `@vercel/node@3.2.29`), not a bare major tag like `@vercel/node@3` —
  the latter fails deployment with "Function Runtimes must have a valid
  version". Letting Vercel auto-detect avoids maintaining a pinned version at
  all.
- MUST NOT declare a `buildCommand`/`installCommand` that runs the frontend;
  this project only needs its own `npm install` (handled automatically by
  Vercel for the project's Root Directory).

## `frontend/vercel.json`

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Contract**:
- MUST NOT reference any path outside `frontend/`.
- The rewrite MUST catch every path so React Router's client-side routes
  (`/`, `/app`, `/app/add`, `/app/records/:entryId`) all resolve to
  `index.html` on direct navigation or refresh (FR-002, SC-003).
- Build command/output directory are left to Vercel's Vite framework
  auto-detection (`npm run build`, `dist/`) rather than hardcoded, so the
  existing `frontend/package.json` `build` script remains the single source of
  truth for how the app is built.

## Root `vercel.json`

**Contract**: MUST NOT exist after this feature is implemented (FR-006) — its
presence would leave a third, conflicting deployment configuration alongside
the two per-project ones.

## Environment variable contract

Each variable in data-model.md §3 MUST be:
- Set directly in the corresponding Vercel project's dashboard (Settings →
  Environment Variables) or via `vercel env add <name> production` from an
  authenticated operator machine — never written into any file tracked by git.
- Scoped to **Production** only for this feature (preview scope is explicitly
  out of scope — research.md §8).
- Named exactly as listed — the application code reads these exact names
  (`process.env.FRONTEND_ORIGIN`, `process.env.VITE_API_BASE_URL` at build
  time via `import.meta.env`, etc.) with no aliasing layer.

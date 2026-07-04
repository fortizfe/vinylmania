# Phase 1 Data Model: Separate Vercel Deployments for Backend and Frontend

This feature introduces no domain data, storage, or API schema changes. Its
"model" is the deployment configuration itself: two Vercel project
configurations and the environment variable catalog each depends on. This
document is the shared vocabulary for Phase 2 tasks.

## 1. Vercel Project: `vinylmania-backend`

| Field | Value |
|---|---|
| Root Directory | `backend` |
| Framework Preset | Other (Node.js function, no framework build step) |
| Build Command | none required — `api/index.ts` is compiled on the fly by the `@vercel/node` runtime |
| Output | N/A (serverless function, not static output) |
| Config file | `backend/vercel.json` |
| Function entry point | `api/index.ts` (unchanged; imports `../src/app`) |
| Routing | Catch-all rewrite: every path → `api/index.ts` (Express does internal routing) |
| Exposed routes (unchanged) | `GET /health`, `/api/auth/*`, `/api/discogs/*`, `/api/library/*` |
| Deployment trigger | GitHub import (Vercel "Import Git Repository"), Production branch = `main` |

## 2. Vercel Project: `vinylmania-frontend`

| Field | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` (auto-detected; runs `tsc -b && vite build`) |
| Output Directory | `dist` (auto-detected) |
| Config file | `frontend/vercel.json` |
| Routing | Catch-all rewrite: every path → `/index.html` (SPA client-side routing fallback) |
| Deployment trigger | GitHub import (Vercel "Import Git Repository"), Production branch = `main` |

## 3. Environment Variable Catalog

Every variable is configured directly in each project's Vercel dashboard (or via
`vercel env add`), scoped to **Production** only (preview scope explicitly out
of this feature, per research.md §8). No value in this table is a real secret —
this is a name/purpose catalog only.

### Backend (`vinylmania-backend` project)

| Variable | Secret? | Purpose | Source of real value |
|---|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Yes | Firebase Admin SDK credential (`firebase-admin/app` `cert()`) | Firebase Console → Project Settings → Service Accounts → Generate new private key; paste the JSON collapsed to one line |
| `FIREBASE_PROJECT_ID` | No (identifier, but keep in env for consistency) | Firebase project id used alongside the service account | Firebase Console → Project Settings |
| `DISCOGS_TOKEN` | Yes | Discogs API personal access token | Discogs → Settings → Developers → Generate new token |
| `DISCOGS_USER_AGENT` | No | Required User-Agent string for Discogs API requests | Chosen by the maintainer (e.g. `Vinylmania/1.0 +https://vinylmania-frontend.vercel.app`) |
| `FRONTEND_ORIGIN` | No (but access-control-sensitive) | CORS allow-list; MUST exactly equal the frontend project's production URL (no trailing slash), comma-separate if more than one origin | The `vinylmania-frontend` project's assigned production URL, known only after that project is created |

Note: `PORT`, used by the local Express `dev`/`start` scripts, is **not** set on
Vercel — the serverless runtime does not use it, and Vercel ignores it if
present.

### Frontend (`vinylmania-frontend` project)

| Variable | Secret? | Purpose | Source of real value |
|---|---|---|---|
| `VITE_API_BASE_URL` | No | Base URL every backend call is prefixed with (`frontend/src/services/apiClient.ts`) | The `vinylmania-backend` project's assigned production URL, no trailing slash |
| `VITE_FIREBASE_API_KEY` | No (Firebase client keys are not secret; protected by Firebase security rules) | Firebase client SDK config | Firebase Console → Project Settings → General → Web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | No | Firebase client SDK config | Same as above |
| `VITE_FIREBASE_PROJECT_ID` | No | Firebase client SDK config | Same as above |
| `VITE_FIREBASE_STORAGE_BUCKET` | No | Firebase client SDK config | Same as above |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | No | Firebase client SDK config | Same as above |
| `VITE_FIREBASE_APP_ID` | No | Firebase client SDK config | Same as above |

## 4. Relationships / Ordering Dependency

- `vinylmania-backend` must be created and deployed **first** so its production
  URL exists; that URL is then set as `VITE_API_BASE_URL` on
  `vinylmania-frontend`.
- `vinylmania-frontend` must be created and deployed **second** (or at least,
  its intended production URL must be known) so that URL can be set as
  `FRONTEND_ORIGIN` on `vinylmania-backend`. In practice this means: create both
  projects first (Vercel assigns each a stable default `*.vercel.app` URL as
  soon as the project exists, before the first successful deploy), then set
  each project's environment variables referencing the other's URL, then
  (re)deploy both.
- Neither project's `vercel.json` references the other directory — this
  reflects Principle II (no cross-project coupling beyond the runtime URL
  values above).

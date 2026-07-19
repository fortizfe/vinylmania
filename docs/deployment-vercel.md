# Deploying Vinylmania to Vercel (two separate projects)

Vinylmania's backend and frontend are deployed as **two independent Vercel
projects** from the same GitHub repository (`fortizfe/vinylmania`):

- `vinylmania-backend` — rooted at [`backend/`](../backend/), an Express API
  running as Vercel serverless functions.
- `vinylmania-frontend` — rooted at [`frontend/`](../frontend/), a static Vite
  single-page app.

They communicate over plain HTTPS: the frontend calls the backend's public URL,
and the backend allows that specific frontend origin via CORS. Neither
project's config file references the other.

**Never paste a real secret value into this file, into a commit, or into any
file tracked by git.** Every credential below is configured directly in the
Vercel dashboard (or via `vercel env add`), which stores it encrypted. This
guide only ever names variables and says where their real value comes from.

This guide covers a from-scratch setup (production deployments only). Preview
(pull request) deployments of the two projects are not wired to reach each
other — see "Known limitations" at the end.

## Deployments are gated on CI, not on Git push

Both projects have `git.deploymentEnabled: false` set in their `vercel.json`
(`backend/vercel.json`, `frontend/vercel.json`). This means pushing to `main`
or opening a pull request does **not**, by itself, trigger a Vercel
deployment anymore — Vercel's native Git integration is intentionally
disabled for both projects.

Instead, `.github/workflows/ci.yml` deploys via the Vercel CLI, and only
after the three test jobs (`backend-test`, `frontend-test`, `e2e-test`) plus
the `code-quality` CodeQL gate have all passed:

- `deploy-production-backend` / `deploy-production-frontend` — run on push to
  `main`, deploy `--prod`.
- `deploy-preview-backend` / `deploy-preview-frontend` — run on pull requests
  opened from a branch of this repository (not from a fork — GitHub Actions
  doesn't expose secrets to fork PRs), deploy a preview.

If any of the three test jobs or `code-quality` fails or is cancelled, the
corresponding `deploy-*` job is skipped automatically (via `needs:
[backend-test, frontend-test, e2e-test, code-quality]`) and no deployment is
created for that commit. See
[specs/054-gate-deploys-on-passing-tests](../specs/054-gate-deploys-on-passing-tests/)
for the test-gating rationale, and
[specs/055-ci-codeql-node-upgrade](../specs/055-ci-codeql-node-upgrade/) for
the `code-quality` gate added on top of it.

This requires four additional GitHub repository secrets (Settings → Secrets
and variables → Actions), on top of the ones already used by the test jobs:

| Secret | What it's for | Where the real value comes from |
|---|---|---|
| `VERCEL_TOKEN` | Authenticates the Vercel CLI in CI | Vercel dashboard → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Identifies the Vercel team/org both projects belong to | `.vercel/project.json` after running `vercel link` locally, or Vercel dashboard → Team Settings |
| `VERCEL_PROJECT_ID_BACKEND` | Identifies the backend project | `.vercel/project.json` after running `vercel link` inside `backend/` |
| `VERCEL_PROJECT_ID_FRONTEND` | Identifies the frontend project | `.vercel/project.json` after running `vercel link` inside `frontend/` |

**Never paste any of these values into this file, into a commit, or into any
file tracked by git** — they only ever live as GitHub Secrets.

## Prerequisites

- Push access to `fortizfe/vinylmania` on GitHub
- A Vercel account with permission to import that repository
- Access to the project's Firebase console, Discogs developer account, and
  Google Cloud Console project, to obtain the real credential values
  referenced below

## Step 1 — Create the backend project

1. In the Vercel dashboard: **Add New… → Project → Import Git Repository** →
   select `fortizfe/vinylmania`.
2. Under **Root Directory**, choose `backend`.
3. Leave Framework Preset as detected (Other/Node) — `backend/vercel.json`
   already declares the `api/index.ts` function and the routing rewrite.
4. Deploy. Vercel assigns a stable production URL immediately (e.g.
   `https://vinylmania-backend.vercel.app`) — note it, you'll need it in Step 3.

## Step 2 — Configure the backend's environment variables

In the backend project → **Settings → Environment Variables**, add each of the
following, scoped to **Production**:

| Variable | What it's for | Where the real value comes from |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Admin SDK credential | Firebase Console → Project Settings → Service Accounts → "Generate new private key". Open the downloaded JSON file and paste its **entire contents as a single line** into the variable's value field. |
| `FIREBASE_PROJECT_ID` | Firebase project identifier | Firebase Console → Project Settings → General → "Project ID" |
| `DISCOGS_TOKEN` | Discogs API personal access token | Discogs → Settings → Developers → "Generate new token" |
| `DISCOGS_USER_AGENT` | Required `User-Agent` header for Discogs API requests | Any descriptive string you choose, e.g. `Vinylmania/1.0 +https://vinylmania-frontend.vercel.app` |
| `FRONTEND_ORIGIN` | CORS allow-list — must exactly match the frontend's URL (no trailing slash) | Not known yet — set a temporary placeholder now (e.g. `https://localhost`) and come back to fix it in Step 5 |
| `REDIS_URL` | Connection string for the Redis instance backing the Discogs response cache | Your managed Redis provider's connection string (e.g. `redis://` or `rediss://`). The backend falls back to uncached direct fetches if this is unset or unreachable, so it's safe to add later, but caching won't be active until it's set. |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth 2.0 client id for the backend-mediated login flow | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Create Credentials → OAuth client ID** → Application type **Web application**. Add the frontend's `/login/callback` URL (from Step 3, e.g. `https://<your-frontend-project>.vercel.app/login/callback`) under **Authorized redirect URIs**. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth 2.0 client secret | Same OAuth client as above — shown once when the client is created, or re-viewable/regenerable from the client's detail page. |
| `GOOGLE_OAUTH_CALLBACK_URL` | Must exactly match the redirect URI registered on the OAuth client above | The frontend's `/login/callback` URL — not known until Step 3, same placeholder-then-fix-in-Step-5 treatment as `FRONTEND_ORIGIN`. |

Without all three `GOOGLE_OAUTH_*` variables set, `GET /api/auth/google/authorize`
fails with a `500 internal_error` (logged server-side as "GOOGLE_OAUTH_CLIENT_ID
/ GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_CALLBACK_URL are not configured") —
if "Sign in with Google" shows an internal error, check these three first.

After adding these, trigger a redeploy. Since `git.deploymentEnabled: false`
means a push to `main` no longer redeploys automatically, either push a commit
so the `deploy-production-backend` CI job runs, or use **Deployments →
Redeploy** in the Vercel dashboard for a one-off manual redeploy.

**Verify**: `curl https://<your-backend-project>.vercel.app/health` should
return `{"status":"ok"}`.

## Step 3 — Create the frontend project

1. In the Vercel dashboard: **Add New… → Project → Import Git Repository** →
   select the same repository again.
2. Under **Root Directory**, choose `frontend`.
3. Framework Preset should auto-detect as **Vite** (build command
   `npm run build`, output directory `dist`) — `frontend/vercel.json` adds the
   SPA fallback rewrite on top of that.
4. Deploy. Note the assigned production URL (e.g.
   `https://vinylmania-frontend.vercel.app`).

## Step 4 — Configure the frontend's environment variables

In the frontend project → **Settings → Environment Variables**, add each of
the following, scoped to **Production**:

| Variable | What it's for | Where the real value comes from |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL every backend request is sent to | The backend project's URL from Step 1 (no trailing slash) |

That's the only one. The frontend no longer talks to Firebase or Google
directly at all — login is a full-page redirect to the backend's
`/api/auth/google/authorize`, mediated entirely server-side (see
[specs/051-frontend-backend-only-network](../specs/051-frontend-backend-only-network/)).
There is nothing Firebase-related to configure on this project; any
`VITE_FIREBASE_*` variable left over from before that migration is dead and
can be removed.

Redeploy the frontend after adding this (Vite bakes environment variables in
at build time, so a plain "restart" isn't enough — it needs a rebuild).

## Step 5 — Close the loop: point the backend at the real frontend URL

Now that the frontend's real URL exists (Step 3), go back to the **backend**
project's environment variables and update:

- `FRONTEND_ORIGIN` to that exact URL (no trailing slash; comma-separate if
  you ever need more than one allowed origin)
- `GOOGLE_OAUTH_CALLBACK_URL` to `<frontend URL>/login/callback` — and make
  sure that exact URL is also registered as an **Authorized redirect URI**
  on the Google OAuth client from Step 2 (Google rejects the exchange if it
  doesn't match exactly)

Redeploy the backend once more.

## Step 6 — Verify the full setup

1. Open `https://<your-frontend-project>.vercel.app/` and sign in with Google.
2. Confirm your library loads — open the browser's Network tab and confirm
   requests go to `https://<your-backend-project>.vercel.app/api/library`.
3. Open a record's detail page, copy its URL, and open that URL directly in a
   new tab — it should render the app, not a "404: NOT_FOUND" page.
4. Run:
   ```bash
   curl -s -i -X OPTIONS https://<your-backend-project>.vercel.app/api/library \
     -H "Origin: https://<your-frontend-project>.vercel.app" \
     -H "Access-Control-Request-Method: GET" | grep -i access-control-allow-origin
   ```
   and confirm it echoes back your frontend's exact origin.

If all four checks pass, both projects are correctly deployed and talking to
each other.

## Known limitations

- **Preview deployments are not wired together.** A pull request's frontend
  preview and backend preview each get their own dynamic `*.vercel.app` URL;
  this setup does not automatically point one at the other. Previews may fail
  to reach a backend (if `VITE_API_BASE_URL` is only set for Production) or
  reach the Production backend instead. Extending this to preview environments
  is a future enhancement, not covered here.
- **No custom domain.** Both projects use their default `*.vercel.app` URL.
  Adding a custom domain later is a normal Vercel project setting and doesn't
  require redoing anything above — just update `FRONTEND_ORIGIN` and
  `VITE_API_BASE_URL` to the new domain and redeploy both projects.

## Related reading

- [`backend/vercel.json`](../backend/vercel.json) / [`frontend/vercel.json`](../frontend/vercel.json) — the exact config each project uses
- [specs/005-vercel-separate-projects/data-model.md](../specs/005-vercel-separate-projects/data-model.md) — full environment variable catalog and the ordering dependency between the two projects
- [specs/005-vercel-separate-projects/quickstart.md](../specs/005-vercel-separate-projects/quickstart.md) — the same verification steps in spec-kit's validation format

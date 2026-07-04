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

## Prerequisites

- Push access to `fortizfe/vinylmania` on GitHub
- A Vercel account with permission to import that repository
- Access to the project's Firebase console and Discogs developer account, to
  obtain the real credential values referenced below

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

After adding these, trigger a redeploy (Vercel does this automatically on the
next push to `main`, or use **Deployments → Redeploy**).

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
| `VITE_FIREBASE_API_KEY` | Firebase client SDK config | Firebase Console → Project Settings → General → your web app's config object |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase client SDK config | Same as above |
| `VITE_FIREBASE_PROJECT_ID` | Firebase client SDK config | Same as above |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase client SDK config | Same as above |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase client SDK config | Same as above |
| `VITE_FIREBASE_APP_ID` | Firebase client SDK config | Same as above |

Firebase's client-side config values are not secret (they're protected by
Firebase security rules, not by being hidden) but are still kept as
environment variables here for per-environment flexibility.

Redeploy the frontend after adding these (Vite bakes environment variables in
at build time, so a plain "restart" isn't enough — it needs a rebuild).

## Step 5 — Close the loop: point the backend at the real frontend URL

Now that the frontend's real URL exists (Step 3), go back to the **backend**
project's environment variables and update `FRONTEND_ORIGIN` to that exact URL
(no trailing slash; comma-separate if you ever need more than one allowed
origin). Redeploy the backend once more.

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

# Quickstart: Validating the Two-Project Vercel Split

This guide validates that the split satisfies its spec (see
[spec.md](./spec.md)) once implemented — i.e., that `backend/vercel.json` and
`frontend/vercel.json` (contracts/vercel-config.md) are in place, the root
`vercel.json` is removed, and both Vercel projects are created and configured
per [data-model.md](./data-model.md). It is the technical validation
counterpart to the user-facing guide this feature also produces at
`docs/deployment-vercel.md` (FR-007/FR-008).

## Prerequisites

- Push access to the `fortizfe/vinylmania` GitHub repository
- A Vercel account with access to import that repository
- The real values for every variable listed in data-model.md §3 (Firebase
  service account JSON, Discogs token, etc.) — obtained from Firebase Console /
  Discogs, never from a file in this repo

## Setup

1. Confirm locally that the config files are correct:
   ```bash
   cat backend/vercel.json
   cat frontend/vercel.json
   test -f vercel.json && echo "FAIL: root vercel.json still exists" || echo "OK: root vercel.json removed"
   ```
2. Create the backend Vercel project: Import Git Repository → select
   `fortizfe/vinylmania` → set Root Directory to `backend` → deploy.
3. Note the backend project's assigned production URL (e.g.
   `https://vinylmania-backend.vercel.app`).
4. Set the backend project's environment variables (Production scope) per
   data-model.md §3, using `FRONTEND_ORIGIN` = the frontend URL you expect to
   get in the next step (you can update it once the frontend project exists,
   then redeploy).
5. Create the frontend Vercel project: Import Git Repository → same repo → set
   Root Directory to `frontend` → deploy.
6. Note the frontend project's assigned production URL.
7. Set the frontend project's environment variables (Production scope) per
   data-model.md §3, with `VITE_API_BASE_URL` = the backend URL from step 3.
8. Update the backend project's `FRONTEND_ORIGIN` to the frontend URL from
   step 6 if it wasn't already correct, then redeploy the backend.
9. Redeploy the frontend (environment variable changes require a redeploy to
   take effect since Vite bakes them in at build time).

## Automated validation

```bash
# Backend health check
curl -s https://<backend-project>.vercel.app/health
# Expected: {"status":"ok"}

# CORS preflight from the frontend origin
curl -s -i -X OPTIONS https://<backend-project>.vercel.app/api/library \
  -H "Origin: https://<frontend-project>.vercel.app" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control-allow-origin
# Expected: Access-Control-Allow-Origin: https://<frontend-project>.vercel.app
```

**Expected outcome**: Both commands succeed with the responses shown above,
confirming FR-001 (backend reachable standalone) and FR-004 (CORS allow-list
matches the frontend's real origin).

## Manual validation scenarios

### 1. Backend deployed independently (User Story 1 / SC-001)

1. Open `https://<backend-project>.vercel.app/health` directly in a browser.
2. Confirm a successful JSON response, with no frontend project involved in
   this check at all.

### 2. Frontend deployed independently and reaching the backend (User Story 2 / SC-002)

1. Open `https://<frontend-project>.vercel.app/` in a browser.
2. Sign in with Google.
3. Confirm the library list loads (calls reach the backend project's URL —
   check the Network tab to confirm requests go to
   `https://<backend-project>.vercel.app/api/library`, not the frontend's own
   origin).

### 3. No layout-shift-causing 404s on deep links (SC-003)

1. While signed in, navigate to a record's detail page and copy its URL.
2. Open that URL directly in a new tab (simulating a refresh/deep link).
3. Confirm the app loads normally instead of a Vercel "404: NOT_FOUND" page.

### 4. No secret exposure (SC-004)

1. Run `git log -p -- backend/vercel.json frontend/vercel.json docs/deployment-vercel.md`
   and confirm no line in the history contains a real credential value (only
   variable names/placeholders).
2. Confirm neither `vercel.json` file contains an `env` block with literal
   values — only the variable configuration described in contracts/vercel-config.md.

### 5. Guide completeness (User Story 3 / SC-005)

1. Have a second person (or yourself, on a clean checkout) follow
   `docs/deployment-vercel.md` from step 1 with no other context.
2. Confirm they reach a working two-project deployment using only that
   document plus their own real credential values.

## Rollback

Both projects can be deleted independently from the Vercel dashboard with no
effect on the other, and with no effect on the application's source code or
git history — this feature's changes are additive config files plus one
removed root `vercel.json`, all of which can be reverted via a normal git
revert if needed.

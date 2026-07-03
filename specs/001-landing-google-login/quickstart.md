# Quickstart: Landing Page & Google Sign-In

## Prerequisites

- Node.js 20 LTS and npm installed locally.
- An existing Firebase project (confirmed with the user during planning).
- In that Firebase project's console:
  1. **Authentication → Sign-in method**: enable the **Google** provider.
  2. **Authentication → Settings → Authorized domains**: make sure
     `localhost` is present (for local dev) and add your Vercel deployment
     domain once you have it.
  3. **Project settings → General**: note the Web app config (create a Web
     app in the project if one doesn't exist yet) — this gives you the
     `apiKey` / `authDomain` / `projectId` / `storageBucket` /
     `messagingSenderId` / `appId` values.
  4. **Project settings → Service accounts**: generate a new private key
     (downloads a JSON file) — this is the backend's Admin SDK credential.

**Do not paste the service-account JSON or share it in chat/screenshots.**
Store it only in the environment variable described below.

## Environment variables

`frontend/.env.local` (git-ignored; values from step 3 above — these are
not secret, see research.md §9):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`backend/.env` (git-ignored; secret):

```
FIREBASE_SERVICE_ACCOUNT_KEY='<paste the full downloaded JSON as one line>'
FIREBASE_PROJECT_ID=...
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
```

`FRONTEND_ORIGIN` restricts CORS to the frontend's actual origin(s) — comma-separate
multiple values (e.g. local dev + the Vercel deployment URL) instead of allowing any
origin.

For the deployed environment, set the same variables in Vercel → Project
Settings → Environment Variables (once per project: `frontend` and
`backend`).

## Run locally

```bash
# Backend
cd backend
npm install
npm run dev            # starts the Express API on http://localhost:3001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev             # starts Vite on http://localhost:5173
```

## Validate the feature end-to-end

These map directly to the spec's acceptance scenarios:

1. **Landing comprehension (US1)**: open `http://localhost:5173` in a fresh/
   incognito browser window at both a desktop width (~1440px) and a mobile
   width (~375px, via devtools device toolbar). Confirm the value proposition
   and the "Sign in with Google" button are both visible without scrolling in
   each case.
2. **Sign-in (US2)**: click "Sign in with Google", complete the account
   picker/consent in the popup. Confirm you land on the authenticated
   placeholder screen showing your Google name and photo (`GET
   /api/auth/me` / `POST /api/auth/session` per
   [contracts/auth-api.md](./contracts/auth-api.md) should return 200).
3. **Returning visitor (US2, scenario 3)**: reload the page (or reopen the
   browser without clearing storage). Confirm you are recognized as signed in
   without seeing the landing/login state again.
4. **Sign-out (US3)**: from the placeholder screen, trigger sign-out. Confirm
   you're returned to the anonymous landing page, and that reloading does not
   restore the authenticated state.
5. **Edge cases**: close the Google popup without choosing an account, and
   separately try with the browser blocking popups. Confirm both cases show a
   clear, friendly message with a way to retry — never a silent failure or a
   stuck loading state.

## Automated tests

- Frontend: `cd frontend && npm test` (Vitest + React Testing Library) —
  covers `LandingHero` no-scroll layout assumptions, `AuthContext` sign-in/
  sign-out state transitions, and the full sign-in flow with a mocked Firebase
  Auth SDK.
- Backend: `cd backend && npm test` (Jest + Supertest against the Firebase
  Auth + Firestore emulators) — covers `POST /api/auth/session` and
  `GET /api/auth/me` for valid, missing, and invalid tokens, and the
  get-or-create user logic.

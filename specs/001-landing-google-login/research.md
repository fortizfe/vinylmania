# Phase 0 Research: Landing Page & Google Sign-In

## 1. Frontend build tooling

**Decision**: Vite + React 18 + TypeScript.

**Rationale**: User-selected (recommended option). Vite gives fast dev-server
startup and HMR, native TypeScript support, and pairs cleanly with a separately
deployed Express backend — unlike Next.js, which bundles its own API routes and
would overlap with the constitution's mandatory Express.js backend.

**Alternatives considered**: Next.js (rejected — its built-in API routes
duplicate the Express backend the constitution already mandates, adding
complexity without benefit for a single SPA + API pair). Create React App
(rejected — unmaintained, slower dev loop).

## 2. Package manager

**Decision**: npm.

**Rationale**: User-selected (recommended option). Ships with Node.js, no extra
tooling to install, most widely understood.

**Alternatives considered**: pnpm, yarn — both viable but add a tooling
dependency not needed for a project this size.

## 3. Frontend test tooling

**Decision**: Vitest + React Testing Library.

**Rationale**: Vitest shares Vite's config and transform pipeline (no separate
Babel/ts-jest setup), runs fast, and has a Jest-compatible API so React Testing
Library works unchanged. Satisfies Principle I (Test-First) with a fast
red-green-refactor loop.

**Alternatives considered**: Jest (rejected for the frontend — works, but
requires extra config to understand Vite's transforms/aliases; no material
benefit over Vitest here).

## 4. Backend test tooling

**Decision**: Jest + Supertest, plus the Firebase Local Emulator Suite (Auth +
Firestore) for integration tests.

**Rationale**: Jest is the de facto standard for Node/Express testing; Supertest
drives HTTP assertions against the Express app without a real network socket.
The Firebase emulator lets integration tests exercise real Firestore
read/write and ID-token verification semantics without touching a live
project or requiring network access in CI, directly matching the constitution's
own rationale ("Firebase emulator for integration tests").

**Alternatives considered**: Mocking `firebase-admin` entirely (rejected — the
constitution's Test-First rationale favors exercising real behavior over mocks
that can silently diverge from production behavior).

## 5. Google sign-in flow shape

**Decision**: Firebase Authentication's `GoogleAuthProvider` via
`signInWithPopup` as the primary flow, with graceful fallback messaging (not a
silent failure) when the popup is blocked or dismissed, per the spec's edge
cases.

**Rationale**: `signInWithPopup` keeps the visitor on the landing page (no full
navigation away and back), which is the simplest way to satisfy "sign-in is
reachable without scrolling" and to handle cancel/deny/error edge cases inline
without a page reload (FR-007). Firebase Auth already persists the resulting
session in the browser by default, satisfying FR-005 (returning visitors
recognized automatically) with no custom code.

**Alternatives considered**: `signInWithRedirect` (rejected as the default —
requires a full page round-trip and more state-restoration handling; kept
in mind as a documented fallback only if a future browser/environment blocks
popups outright, not built in this feature to avoid speculative complexity
per Principle III).

## 6. Server-side session model

**Decision**: Stateless verification. The frontend attaches the Firebase ID
token (`Authorization: Bearer <token>`) to each backend request; the backend
verifies it with `firebase-admin`'s `verifyIdToken` on every call. No
server-side session store, cookie, or database-backed session table.

**Rationale**: Firebase ID tokens are short-lived and self-verifying; a second,
custom session mechanism would duplicate what Firebase Auth already provides
and would violate Principle III (YAGNI). This also keeps the backend fully
stateless, which is required for a Vercel Serverless Function deployment
(no in-memory session store would survive across invocations anyway).

**Alternatives considered**: Server-side session cookies backed by a session
store (rejected — adds infrastructure with no requirement driving it; also a
poor fit for stateless serverless functions).

## 7. First-time user record creation

**Decision**: Get-or-create on first verified request. When the backend
verifies an ID token for a `uid` with no existing `users/{uid}` Firestore
document, it creates one from the token's claims (name, email, picture) and a
server timestamp; subsequent requests for the same `uid` read the existing
document unchanged.

**Rationale**: Matches FR-006 exactly (create on first sign-in, reuse
afterward) without a separate "registration" step or endpoint — one endpoint,
one code path, no race-prone two-step flow.

**Alternatives considered**: A dedicated `/register` endpoint called once by
the frontend after first sign-in (rejected — adds a second network call and a
window where the frontend "forgets" to call it; folding creation into the
same verification path removes that failure mode).

## 8. Backend deployment shape on Vercel

**Decision**: Deploy the Express app as a single Vercel Serverless Function
using a catch-all entry point (e.g. `backend/api/index.ts` exporting the
compiled Express `app`), with `vercel.json` rewriting `/api/*` requests to it.

**Rationale**: Vercel's Node runtime accepts a standard `(req, res)` handler,
which an Express app already is — no adapter library needed. This keeps the
constitution's mandatory Express.js framework intact while still deploying to
the constitution's mandatory Vercel platform.

**Alternatives considered**: Splitting each route into its own Vercel Function
file (rejected — reintroduces routing/middleware wiring Express already
solves; unnecessary complexity for a two-endpoint API).

## 9. Firebase project configuration & secrets handling

**Decision**: The user has an existing Firebase project. Configuration is
split by sensitivity:
- **Frontend web config** (`apiKey`, `authDomain`, `projectId`,
  `storageBucket`, `messagingSenderId`, `appId`) is not treated as secret —
  Firebase's own security model expects this to ship inside the public JS
  bundle, protected by Firebase Security Rules and Authorized Domains, not by
  hiding the values. These are read from `VITE_FIREBASE_*` environment
  variables at build time.
- **Backend Admin SDK credentials** (a service account JSON) are a real
  secret. They are read from a `FIREBASE_SERVICE_ACCOUNT_KEY` environment
  variable (JSON string) at process start, never committed to the repo
  (already covered by `.gitignore`'s `.env*` rules and the
  `*-firebase-adminsdk-*.json` pattern), and set directly in each
  environment's secret store (local `.env`, Vercel Project Settings) rather
  than pasted into any shared conversation or document.

**Rationale**: Matches Firebase's own documented security model and the
constitution's requirement that internal error/config detail never leak, while
not over-protecting values that are public by design. See
[quickstart.md](./quickstart.md) for the exact list of variables the user
needs to populate and where to find each one in the Firebase console.

**Alternatives considered**: Treating the web config as secret and proxying
every Firebase Auth call through the backend (rejected — contradicts how
Firebase Auth is designed to work, adds a proxy layer with no security
benefit).

## Outstanding NEEDS CLARIFICATION

None. All Technical Context unknowns are resolved above.

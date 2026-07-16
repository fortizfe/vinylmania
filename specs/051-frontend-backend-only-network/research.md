# Phase 0 Research: Frontend habla solo con el backend propio

**Feature**: 051-frontend-backend-only-network | **Date**: 2026-07-16

This research resolves every `NEEDS CLARIFICATION` left open by the spec's
Assumptions section, plus the technical unknowns needed to design the
login/session rework. Each decision is cross-checked against the existing
Discogs OAuth 1.0a account-link flow (`application/discogsOauth/`,
`adapters/discogsOauth/discogsRoutes.ts`, `e2e/helpers/discogsOauthStub.ts`),
which the spec explicitly names as the precedent to follow.

---

## R1: Session transport mechanism (cookie vs. token)

**Decision**: An opaque, backend-issued session token, returned in the JSON
response body of the login-completion endpoint, stored client-side (module
state backed by `localStorage` so it survives a full page reload) and
attached as `Authorization: Bearer <sessionToken>` on every request —
exactly the same header shape `authorizedFetch` already sends today.

**Rationale**: `specs/005-vercel-separate-projects` establishes that the
frontend and backend deploy as two independent Vercel projects, each with
its own domain, communicating cross-origin (`FRONTEND_ORIGIN` is a distinct
CORS-allowed origin, not a subdomain sharing a registrable domain with the
backend). A cookie-based session would need `SameSite=None; Secure` to
survive that cross-site relationship, which:
- requires explicit CSRF mitigation (double-submit token or a custom
  header check) because the browser attaches the cookie automatically to
  any cross-site request;
- is subject to third-party-cookie blocking (Safari ITP, Firefox ETP) on
  `vercel.app`-style domains that don't share a registrable eTLD+1, risking
  silent, hard-to-debug session loss for a subset of users.

A bearer token avoids both problems entirely: it is never auto-attached by
the browser (so it isn't a CSRF vector), and reading it from
`localStorage`/an in-memory store to set a header is just JavaScript — no
browser cookie policy is involved. It also means **zero code changes** for
any of the five services that already call `authorizedFetch`
(`discogsApi.ts`, `libraryApi.ts`, `discogsOauthApi.ts`, `feedsApi.ts`,
`themePreferenceApi.ts`) — only `apiClient.ts`'s internal token *source*
changes, satisfying FR-010 directly.

**Alternatives considered**:
- *`HttpOnly` cross-site cookie with `SameSite=None`*: rejected — the CSRF
  and third-party-cookie risk above is real operational complexity with no
  offsetting benefit for a token that already needs to survive reload via
  some client-side persistence anyway (a cookie's XSS-resistance advantage
  over `localStorage` is the main argument for it, but this project's
  current threat model already stores the Firebase ID token in IndexedDB
  via the SDK's own persistence, which is equally reachable by an XSS
  payload — so a `localStorage` token is not a regression).
- *Same-site cookie by switching to a shared custom domain
  (`app.vinylmania.X` / `api.vinylmania.X`)*: rejected as out of scope —
  it would require a domain/DNS change unrelated to this feature and
  contradicts `specs/005-vercel-separate-projects`' explicit two-project,
  two-domain design.

---

## R2: Session storage (where sessions of record live)

**Decision**: A new Firestore collection, `sessions/{sessionId}`, one
document per device/browser session: `{ uid, createdAt, lastSeenAt,
expiresAt }`. `lastSeenAt`/`expiresAt` are extended (sliding-window renewal)
on verification, throttled to avoid a write on every single request (only
re-extend if the current `expiresAt` is within, e.g., half the sliding
window of expiring — an implementation detail for `tasks.md`, not the
spec).

**Rationale**: The constitution's Technology Stack section names Firebase
as the required data store for user-specific state, and Firestore is
already the system of record for `users/{uid}` and `discogsConnections/{uid}`
via `firestoreUserRepository.ts` — reusing it keeps this feature from
introducing a second storage technology for essentially the same kind of
data (Principle III, YAGNI).

**Alternatives considered**:
- *Redis (`ioredis`, already a backend dependency via `cacheAdapter`)*:
  rejected — Redis is documented and used exclusively as a **performance
  cache** for Discogs responses, not a system of record; promoting it to
  hold session-of-record data would introduce a second source of truth for
  user-specific state without any requirement here forcing that (no
  latency or scale target in the spec justifies it), which is exactly the
  kind of premature complexity Principle III rules out.
- *Stateless signed JWT (no server-side session record at all)*: rejected
  — it cannot satisfy FR-012/the per-device-revocation clarification (a JWT
  is valid until it expires; revoking a single device's session without
  invalidating others requires *some* server-side record, e.g. a
  denylist — at which point it is simpler to just have the session record
  be the source of truth directly, not an optimization layered on top of a
  JWT that still needs one anyway).

---

## R3: Verifying the caller's Google identity (server-to-server)

**Decision**: A plain Google OAuth 2.0 Authorization Code flow, mirroring
the existing Discogs OAuth 1.0a flow's shape:
1. Backend redirects the browser to Google's authorization endpoint
   (`{GOOGLE_OAUTH_BASE_URL}/o/oauth2/v2/auth`) with `client_id`,
   `redirect_uri`, `response_type=code`, `scope=openid email profile`, and a
   server-generated anti-forgery `state`.
2. Google redirects back to a **frontend** callback route with `code` +
   `state` (approved) or `error=access_denied` + `state` (denied) — see R6.
3. Backend exchanges `code` for an `access_token` server-to-server at
   `{GOOGLE_TOKEN_BASE_URL}/token` (POST, with `client_secret` — never sent
   to the browser, satisfying FR-009).
4. Backend calls `{GOOGLE_USERINFO_BASE_URL}/userinfo` with
   `Authorization: Bearer <access_token>` to fetch `{ sub, email, name,
   picture }` — the direct structural equivalent of Discogs'
   `GET /oauth/identity` step.

**Rationale**: This is architecturally identical to the already-vetted
Discogs pattern (request → external redirect → server-to-server exchange →
server-to-server identity fetch), which the spec explicitly names as the
model to follow. It also avoids adding a JWT-verification dependency: rather
than validating the `id_token`'s signature against Google's JWKS, the
backend simply calls the userinfo endpoint with the already-trusted
`access_token` obtained over a direct, server-to-server TLS connection to
Google — the same trust boundary Discogs' identity call already relies on.

**Alternatives considered**:
- *Decode and verify the OIDC `id_token` locally (JWKS)*: rejected — adds a
  JWT/JWKS-verification library and key-rotation handling for no benefit
  over one extra authenticated HTTP call, and breaks symmetry with the
  Discogs precedent's HTTP-identity-call shape.
- *Route the exchange through Firebase Auth's own "sign in with IDP" REST
  endpoint instead of talking to Google directly*: rejected — adds an extra
  hop through Firebase's OAuth proxy for no benefit, and still requires
  registering the same Google OAuth client.

## R3b: Preserving existing users' identity (`uid` continuity)

**Decision**: After obtaining the Google identity (R3), the backend resolves
the canonical Firebase `uid` via Firebase Admin: `getUserByEmail(email)` if
an account already exists (all pre-existing users signed in with Google via
Firebase Auth, so their email is already on file), otherwise
`createUser({ email, displayName, photoURL })` to mint a new Firebase-managed
`uid` exactly as Firebase Auth's client SDK did implicitly on first sign-in
today.

**Rationale**: Every existing Firestore document scoped to a user
(`users/{uid}`, `discogsConnections/{uid}`, library entries, ratings) is
keyed by the Firebase-generated `uid`. Migrating away from Firebase Auth
issuing ID tokens must not migrate away from Firebase Admin being the
identity-of-record for `uid` assignment — only the *transport* by which the
browser proves "I am this Google account" moves from a client SDK to a
server-side OAuth exchange. `firebase-admin` remains a backend dependency
for this reason, consistent with the spec's Assumptions.

---

## R4: `AuthVerifierPort` / `requireAuth` after the swap

**Decision**: `ports/auth/authVerifierPort.ts`'s single method changes from
`verifyIdToken(idToken)` to `verifySession(sessionToken)`, returning the
same `AuthenticatedUser` shape. `firebaseAuthVerifierAdapter` (Firebase
Admin `verifyIdToken`) is retired for this port; a new
`sessionAuthVerifierAdapter` implements it by delegating to
`SessionStorePort.touchSession` (verify + slide TTL in one call). `requireAuth`
itself is unchanged (still driving-adapter translation of
missing/invalid credential → 401), per Principle VIII.

**Rationale**: This is a pure port/adapter swap — the exact mechanism
Principle VIII exists to make safe. No consumer of `req.auth` downstream of
`requireAuth` changes.

---

## R5: Backend Jest test credentials (no more ID-token minting)

**Decision**: `backend/tests/helpers/authEmulator.ts`'s `getTestIdToken`
(which signs up a throwaway user against the Auth Emulator purely to mint a
real Firebase ID token to feed into `Authorization: Bearer`) is replaced by
a new `createTestSession(uid)` helper that writes a `sessions/{sessionId}`
document directly into the Firestore emulator and returns its opaque token
— removing the Auth-Emulator round trip from every test suite that only
needs *an* authenticated request, not a Google-login test. The Auth
Emulator itself is still required, but now only for the small number of
tests that exercise `completeGoogleLogin`'s Firebase Admin
`getUserByEmail`/`createUser` calls directly.

**Rationale**: This resolves the spec's open edge case ("¿necesitan el
mismo rediseño...?") — the tests do need a change, but it's a
simplification (one direct Firestore write vs. an HTTP sign-up round trip
to the Auth Emulator) for the vast majority of authenticated-route tests,
not new complexity.

---

## R6: Where the OAuth redirect_uri lands (backend route vs. frontend page)

**Decision**: `redirect_uri` is a **frontend** route (`/login/callback`),
mirroring `DiscogsCallbackPage.tsx` at `/app/profile/discogs/callback`
exactly. That page reads `code`/`state`/`error` from the query string and
`POST`s `{ code, state }` to a public backend endpoint
(`/api/auth/google/complete`), which performs the entire server-to-server
exchange (R3) and returns `{ sessionToken, user }` in the response body.

**Rationale**: This was explicitly left open in the spec's Assumptions as a
planning decision with "both options valid." Landing the redirect on a
backend route would require the backend to hand the browser a session token
via some *other* channel (a redirect with the token in a URL fragment, or a
cookie — reopening R1's rejected option) since a bare HTTP redirect response
can't write to `localStorage`. Landing on a frontend page — which can run
JavaScript to receive the token from a normal JSON response and store it —
is the only option compatible with R1's bearer-token decision, and it is
also the option that already has a working, tested precedent in this
codebase (`DiscogsCallbackPage.tsx` + `useCompleteDiscogsLink`).

---

## R7: Silent session renewal (Clarification, Session 2026-07-16)

**Decision**: No explicit refresh endpoint or client-side refresh logic.
`SessionStorePort.touchSession` (R4) extends `expiresAt` as a side effect of
every successful verification. As long as the user keeps making authenticated
requests before the sliding window lapses, the session simply never expires
from their perspective — this *is* "silent renewal with no visible
interruption" (the clarified requirement), implemented as an inherent
property of the session-store design rather than as a separate round trip.
A 401 therefore only ever means genuine expiration (idle past the sliding
window, explicit logout of that device, or a rejected legacy Firebase ID
token per FR-019) — there is no intermediate "renewal failed, now show
expired" state to build, because renewal and verification are the same
operation.

**Rationale**: Directly satisfies FR-018 with the simplest possible
mechanism (Principle III) — an access/refresh-token pair with a distinct
client-side silent-refresh interceptor was the natural alternative and is
explicitly rejected as unnecessary complexity once sliding-window
server-side expiration delivers the same observable behavior.

**New frontend concern this creates**: because there is no more SDK
`onAuthStateChanged` listener reacting to token invalidation, `apiClient.ts`
must itself detect a `401` from any `authorizedFetch` call and notify
`AuthContext` to clear the signed-in user and clear the stored token — the
one piece of reactive behavior the client SDK used to provide for free.
This is a small addition (a callback `AuthProvider` registers with
`apiClient` on mount), not a new subsystem.

---

## R8: Naming and file layout (Principle VIII compliance)

Two new backend domains, one small extension to the existing `auth` domain:

- `domain/googleAuth/` — `types.ts` (`GoogleIdentity`), `googleAuthErrors.ts`
  (`GoogleAuthFlowError` with codes `denied | invalid_state | expired_state
  | exchange_failed`, mirroring `DiscogsOauthFlowError`'s shape).
- `domain/auth/session.ts` — `Session` type (extends the existing
  `domain/auth/types.ts`).
- `ports/googleAuth/googleIdentityPort.ts` — `getAuthorizeUrl(state)`,
  `exchangeCodeForIdentity(code)`.
- `ports/auth/sessionStorePort.ts` — `createSession(uid)`,
  `touchSession(token)`, `revokeSession(token)`.
- `ports/auth/identityResolverPort.ts` — `resolveOrCreateUser(identity)`.
- `ports/auth/authVerifierPort.ts` — updated per R4.
- `adapters/googleAuth/googleIdentityAdapter.ts` — real Google HTTP calls.
- `adapters/googleAuth/googleAuthRoutes.ts` — public routes (R6).
- `adapters/auth/firestoreSessionStoreAdapter.ts`,
  `adapters/auth/firebaseIdentityResolverAdapter.ts`,
  `adapters/auth/sessionAuthVerifierAdapter.ts`.
- `application/googleAuth/startLogin.ts`, `completeLogin.ts`.
- `application/auth/logoutSession.ts`.

This keeps the OAuth-provider-specific concern (`googleAuth`, talking to
Google) separate from the provider-agnostic session concern (`auth`,
issuing/verifying/revoking Vinylmania's own session), the same separation
already drawn between `discogsOauth` (provider-specific) and `library`
(domain data) elsewhere in the codebase.

---

## Summary of resolved unknowns

| Spec Assumption | Resolution |
|---|---|
| Exact session mechanism (cookie vs. token), CSRF | R1: bearer token in `localStorage`, no CSRF exposure (never auto-attached) |
| `redirect_uri` target (backend route vs. frontend page) | R6: frontend page, POSTs to a public backend completion endpoint |
| Backend Jest tests vs. Auth Emulator | R5: mostly no longer needed; a direct-Firestore-write test helper replaces ID-token minting for non-login tests |

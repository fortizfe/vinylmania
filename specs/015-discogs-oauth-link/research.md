# Research: Link Vinylmania Account with Discogs (OAuth)

**Feature**: 015-discogs-oauth-link | **Date**: 2026-07-06

All Technical Context unknowns resolved. Sources: attached Discogs "Authentication" documentation (OAuth 1.0a flow, PLAINTEXT signatures, 15-minute verifier validity, non-expiring access tokens), https://www.discogs.com/developers, and the existing codebase (`backend/src/discogs/discogsClient.ts`, `backend/src/services/userService.ts`, `e2e/playwright.config.ts`).

## R1. OAuth 1.0a implementation: hand-built PLAINTEXT headers, no new dependency

**Decision**: Implement OAuth 1.0a with the PLAINTEXT signature method as a small in-project module (`oauthSignature.ts`) that builds the `Authorization: OAuth ...` header for the three calls that need it (request token, access token, identity). Signature is `consumer_secret&` for the request-token call and `consumer_secret&token_secret` for token-bearing calls; plus `oauth_consumer_key`, `oauth_nonce` (crypto-random), `oauth_timestamp`, `oauth_signature_method="PLAINTEXT"`, `oauth_callback` / `oauth_token` / `oauth_verifier` as each step requires.

**Rationale**: Discogs' own documentation recommends PLAINTEXT over HMAC-SHA1 ("simple yet secure" over HTTPS). PLAINTEXT needs no base-string construction, no percent-encoding-sensitive signing — it is a header formatter of ~40 lines, fully unit-testable. Adding a dependency (`oauth-1.0a`, `client-oauth2`-style wrappers) brings HMAC machinery we would not use and another supply-chain surface, violating YAGNI/KISS for zero benefit.

**Alternatives considered**:
- `oauth-1.0a` npm package: mature but designed around HMAC-SHA1 signing of full base strings; overkill for PLAINTEXT, and still requires manual header assembly for Discogs' quirks. Rejected.
- HMAC-SHA1 signatures (hand-built or via library): more complex, error-prone (encoding of base strings), and explicitly not recommended as necessary by Discogs over HTTPS. Rejected.

## R2. Flow topology: backend-driven exchange, frontend callback route

**Decision**: The backend performs every server-to-Discogs call; the browser only visits Discogs' authorize page and returns to the frontend.

1. `POST /api/discogs/oauth/request` (authenticated): backend obtains a request token (passing `oauth_callback` = `DISCOGS_OAUTH_CALLBACK_URL`), persists a pending attempt (`oauth_token` → `{uid, requestTokenSecret, expiresAt}`), and returns `{ authorizeUrl }`.
2. Frontend redirects the browser (`window.location.assign`) to `authorizeUrl` (`{DISCOGS_AUTHORIZE_BASE_URL}?oauth_token=...`).
3. Discogs redirects back to the frontend callback route `/app/profile/discogs/callback?oauth_token=...&oauth_verifier=...` (or `denied=...` when the user refuses).
4. The callback page calls `POST /api/discogs/oauth/complete` with `{ oauthToken, oauthVerifier }` via `authorizedFetch`; the backend validates the pending attempt (exists, same uid, not expired), exchanges it for the access token/secret, calls `GET /oauth/identity` to verify and capture the Discogs username, persists the connection, deletes the pending attempt, and returns the public connection status.

**Rationale**: Frontend and backend deploy as separate Vercel projects; landing the Discogs redirect on a frontend route keeps the callback on the same origin the user is browsing and lets the completion request carry the Firebase ID token — which is what cryptographically ties the link to the signed-in user (FR-007) and lets `requireAuth` reject anonymous completion attempts. The pending-attempt record keyed by `oauth_token` additionally binds the flow to the uid that started it, so a verifier stolen or replayed by another signed-in user is rejected (uid mismatch).

**Alternatives considered**:
- Callback lands on a backend endpoint that completes the exchange and 302s to the frontend: the backend callback request carries no Firebase credentials (it is a bare browser redirect), so the link could only be tied to a user via the pending record — weaker (no authenticated principal on the completing request) and it puts a user-facing browser navigation on the API origin. Rejected.
- Popup window + postMessage instead of full-page redirect: more moving parts (popup blockers, message-origin validation) for no functional gain on a profile settings action. Rejected.

## R3. Persistence: two Firestore collections, admin-SDK-only access

**Decision**:
- `discogsConnections/{uid}` — durable connection: `uid`, `discogsUsername`, `discogsUserId`, `accessToken`, `accessTokenSecret`, `linkedAt`. Deleted wholesale on disconnect.
- `discogsOAuthRequests/{oauthToken}` — pending attempt: `uid`, `requestTokenSecret`, `createdAt`, `expiresAt` (now + 15 min). Deleted on successful completion; expired or uid-mismatched attempts are rejected and deleted lazily when touched.

**Rationale**: Firestore is the constitution-mandated store for user state, and connections are exactly that. Keeping secrets in dedicated top-level collections (rather than fields on `users/{uid}`) means the existing `/api/auth/me` mapping can never accidentally serialize a token to the browser, and any future client-side Firestore rules simply never grant these collections. Keying pending attempts by `oauth_token` gives O(1) lookup on completion, exactly matching what Discogs echoes back. One connection per user falls out of the document ID being the uid (FR-008).

**Alternatives considered**:
- Fields/map on `users/{uid}`: risks leaking through any code path that returns the raw user document; mixes durable identity data with third-party secrets. Rejected.
- Subcollection `users/{uid}/private/...`: equivalent isolation but more path plumbing for no benefit at this scale. Rejected.
- Redis for pending attempts (native TTL): attractive expiry semantics, but Redis is a cache tier in this project (cache-aside, mock in tests) and linking must not break when Redis is cold/unavailable; Firestore with an `expiresAt` check keeps the flow dependency-free. Rejected.

## R4. No Redis involvement; no caching of OAuth calls

**Decision**: OAuth endpoints bypass the cache-aside layer entirely; a dedicated axios instance (`oauthHttpClient.ts`) handles `application/x-www-form-urlencoded` bodies, the mandatory `User-Agent`, and maps errors to the existing `DiscogsRateLimitError`/`DiscogsUnavailableError` family.

**Rationale**: Token exchanges are one-shot, side-effecting requests — caching them would be incorrect. Reusing the existing error classes keeps route-level error mapping consistent with the catalog endpoints (429 → friendly rate-limit message, 5xx/network → unavailable message), satisfying the spec's Story 3 and the constitution's graceful-degradation rule. The existing catalog client (`discogsClient.ts`) is untouched and keeps using the app-level `DISCOGS_TOKEN`.

**Alternatives considered**: Extending `discogsClient.ts` with OAuth methods — would tangle per-user auth into a module whose contract is app-level catalog access, violating single responsibility. Rejected.

## R5. Token storage security posture: Firestore at-rest encryption, no app-layer crypto

**Decision**: Store access token/secret as plain fields in `discogsConnections/{uid}`, relying on Firestore's default encryption at rest, backend-only Admin SDK access, and HTTPS in transit. No application-level encryption layer in this version.

**Rationale**: The tokens grant scoped access to one user's Discogs account and are revocable by the user at Discogs at any time. The realistic threat (leaking to the browser or repo) is addressed structurally (R3, env-only consumer secret, DTOs that never include token fields — enforced by contract tests asserting response shapes). App-layer encryption would need its own key in env vars sitting right next to the data path it protects — added complexity with marginal benefit at this scale (Principle III). Revisit if the app ever handles marketplace/financial scopes.

**Alternatives considered**: Encrypting tokens with a `TOKEN_ENCRYPTION_KEY` env secret (AES-GCM): defensible hardening, but the key lives in the same trust domain as the ciphertext, so it only defends against raw-Firestore-export exposure; deferred as YAGNI with a documented revisit trigger.

## R6. E2E strategy: local Discogs OAuth stub via env-overridable base URLs

**Decision**: The OAuth module reads its Discogs base URLs from env with production defaults (`DISCOGS_OAUTH_BASE_URL` → `https://api.discogs.com`, `DISCOGS_AUTHORIZE_BASE_URL` → `https://www.discogs.com/oauth/authorize`). For e2e, a tiny local stub (`e2e/helpers/discogsOauthStub.ts`, started from Playwright's `webServer` list or a fixture) implements: `GET /oauth/request_token` (urlencoded token+secret+callback_confirmed), `GET /oauth/authorize` (an HTML page with an "Authorize"/"Deny" control that redirects to the app's callback with `oauth_verifier` or `denied`), `POST /oauth/access_token`, and `GET /oauth/identity` (fixed username). The backend dev server in `playwright.config.ts` gets these env overrides plus fake consumer credentials.

**Rationale**: The real Discogs authorize page cannot be scripted in CI (real account, real consent, rate limits). The constitution requires e2e coverage of the changed frontend flow; a stub exercising the genuine backend code path (real HTTP, real parameter parsing, real Firestore writes against the emulator) is the highest-fidelity option that stays hermetic — the only untested seam is the literal Discogs hostname. Unit/contract tests cover protocol details against nock-recorded shapes from the official docs.

**Alternatives considered**:
- Playwright `page.route` interception: only intercepts browser-originated requests; the token exchange is server-to-server, so it cannot be intercepted this way. Rejected as insufficient.
- nock inside the running dev backend: nock patches the current process; wiring it into `ts-node-dev` for e2e is brittle and pollutes production code paths. Rejected.
- Skipping e2e for the OAuth leg and only testing UI states with seeded Firestore data: violates the constitution's e2e gate for the changed flow. Rejected.

## R7. UX for the callback leg and denial/expiry messaging

**Decision**: `DiscogsCallbackPage` (route `/app/profile/discogs/callback`) renders the standard skeleton while `complete` is in flight, then navigates to `/app/profile` passing an outcome via router state: `linked` (success), `denied` (Discogs `denied` param present / verifier missing), `expired` (backend 400 with `expired_request` code), or `error`. `ProfilePage` shows the outcome as a dismissible inline message in the connection card area; the card itself always re-fetches status after completion (query invalidation), so the displayed state and the message never disagree. While a connection exists, the card's only action is Disconnect (with an inline confirm step — 2 interactions max, SC-004); the backend additionally answers `409 already_connected` to a `request`/`complete` from a stale tab (FR-008).

**Rationale**: Keeps all connection UI on one screen (spec: profile is the home of account sync), uses router state instead of query params so a refresh of `/app/profile` doesn't replay the message, and satisfies Story 3's "clear, non-technical message + retriable" requirement with no partial state — the pending attempt is either consumed (success) or left to expire (denial/abandon), never half-applied.

**Alternatives considered**: Completing the exchange from `ProfilePage` itself by parsing query params there (no dedicated route): conflates two responsibilities and makes the in-flight state ambiguous on direct profile visits. Rejected.

## R8. Versioning & changelog classification

**Decision**: Backend `0.2.0 → 0.3.0` (MINOR: new endpoints + new collections, fully backward compatible). Frontend `0.5.0 → 0.6.0` (MINOR: new profile capability + new route). Dated `Added` entries in both CHANGELOGs in the same PR, per the constitution's no-`[Unreleased]` policy.

**Rationale**: Purely additive feature; no existing contract, schema, or stored-data shape changes (Principle VI).

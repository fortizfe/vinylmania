# Contract — native OAuth (Google sign-in + Discogs link)

**Change type**: MINOR, additive. The web flow is byte-for-byte unchanged: every
new parameter is optional and defaults to the web behaviour.

## Why a backend change

- The session is an opaque **Bearer token** (`sessionToken` from
  `POST /api/auth/google/complete`; the web keeps it in `localStorage`), so the
  native app can use the same session mechanism — no cookie work.
- But both OAuth providers redirect to **frontend** URLs
  (`GOOGLE_OAUTH_CALLBACK_URL`, `DISCOGS_OAUTH_CALLBACK_URL`). A native app needs
  the browser to come back to `vinylmania://…`. Google web clients don't accept
  custom-scheme redirect URIs, so the backend gets an `https` callback per flow
  that **relays** the provider's query to a fixed app URL.
- A custom scheme can be claimed by another Android app. Anyone intercepting
  `code + state` could finish the Google sign-in and get a session, so native
  Google logins are bound to the app instance with **PKCE (S256)** checked by our
  backend. Discogs needs no PKCE: `/complete` already requires the caller's
  session and checks `pending.uid === uid`.

## Fixed values

| Name | Value |
|---|---|
| App callback, Google | `vinylmania://auth/callback` (constant, not config) |
| App callback, Discogs | `vinylmania://discogs/callback` (constant, not config) |
| New env `GOOGLE_OAUTH_NATIVE_CALLBACK_URL` | `https://<backend>/api/auth/google/native/callback`. Must also be added as an authorized redirect URI on the **existing** Google web OAuth client. Required only for native logins. |
| New env `DISCOGS_OAUTH_NATIVE_CALLBACK_URL` | `https://<backend>/api/discogs/oauth/native/callback`. No Discogs console change (`oauth_callback` is sent per request). |

The relay targets are constants, so there is no open redirect.

## Google sign-in

### `GET /api/auth/google/authorize` (changed: optional query)

| Query | Rule |
|---|---|
| `client` | optional, `web` (default) \| `native` |
| `code_challenge` | **required when `client=native`**, forbidden otherwise; base64url, 43–128 chars (`^[A-Za-z0-9_-]{43,128}$`). Method is always S256 (no `code_challenge_method` param). |

- Invalid query → `400 { error: "validation_error", message: "The sign-in request is malformed." }` (JSON, as today).
- `native`: the pending login doc stores `{ client: "native", codeChallenge }`, and the Google authorize URL uses `redirect_uri = GOOGLE_OAUTH_NATIVE_CALLBACK_URL`.
- `web`: same as today (pending doc stores `client: "web"`; docs written before this change have no `client` and are read as `web`).
- Response unchanged: `302 Location: <google authorize url>`.

### `GET /api/auth/google/native/callback` (new, public, strict rate limit)

Google redirects here. The backend copies **only** `code`, `state` and `error`
(when present) into a new query string, then:

`302 Location: vinylmania://auth/callback?<code|error>&state=…`

There's no state lookup here: `/complete` validates `state`. Missing `state` →
`400` JSON `validation_error`.

### `POST /api/auth/google/complete` (changed: optional body field)

```json
{ "state": "…", "code": "…", "error": "…", "codeVerifier": "…" }
```

- `codeVerifier`: optional string, 43–128 chars, `[A-Za-z0-9-._~]`.
- When the pending login is `native`: `codeVerifier` is required, and
  `base64url(sha256(codeVerifier)) === codeChallenge` must hold; otherwise
  `400 { error: "invalid_state", message: "This sign-in attempt is not valid. Please try signing in again." }`
  (existing error, no new code). The pending doc is **not** deleted on mismatch
  (same as the Discogs uid-mismatch rule), so the real app can still complete.
  Its 15-minute TTL still applies.
- Code exchange uses the `redirect_uri` that matches the pending login's client.
- `web` pendings ignore `codeVerifier`.
- Success response unchanged: `200 { sessionToken, user }`.

## Discogs account link

### `POST /api/discogs/oauth/request` (changed: optional body)

```json
{ "client": "native" }
```

Optional. Missing body or `client: "web"` → today's behaviour. `native` → the
request-token call sends `oauth_callback = DISCOGS_OAUTH_NATIVE_CALLBACK_URL`.
Any other value → `400 validation_error`. Response unchanged: `{ authorizeUrl }`.

### `GET /api/discogs/oauth/native/callback` (new, public: no `requireAuth`, strict rate limit)

The backend copies only `oauth_token`, `oauth_verifier` and `denied`:

`302 Location: vinylmania://discogs/callback?<same three, when present>`

### `POST /api/discogs/oauth/complete`, `GET /status`, `DELETE /connection`

Unchanged. The app calls `/complete` with its Bearer token, exactly like the web.

## Hexagonal placement (backend-agent)

| Layer | Change |
|---|---|
| `domain/auth/types.ts` | `export type OAuthClient = 'web' \| 'native';` |
| `domain/googleAuth/types.ts` | `PendingGoogleLogin` gains `client: OAuthClient; codeChallenge?: string` |
| `domain/googleAuth/pkceS256.ts` (new) | `export function matchesPkceS256(verifier: string, challenge: string): boolean` (uses `node:crypto`: stdlib, no infra) |
| `ports/googleAuth/googleIdentityPort.ts` | `getAuthorizeUrl(state, client)`, `exchangeCodeForIdentity(code, client)`, `createPendingLogin(input: { client: OAuthClient; codeChallenge?: string })` |
| `application/googleAuth/startLogin.ts` | takes `{ client, codeChallenge? }` and passes it through |
| `application/googleAuth/completeLogin.ts` | takes `codeVerifier?`; PKCE check after the expiry check; exchange with `pending.client` |
| `adapters/googleAuth/googleIdentityAdapter.ts` | picks callback env by client; persists/reads `client`, `codeChallenge` |
| `adapters/googleAuth/googleAuthRoutes.ts` | zod for the new query/body fields; new `GET /native/callback` relay |
| `ports/discogsOauth/discogsConnectionPort.ts` | `createPendingRequest(uid, client: OAuthClient)` |
| `application/discogsOauth/startLink.ts` | `startLink(uid, client)` |
| `adapters/discogsOauth/discogsConnectionAdapter.ts` | picks callback env by client |
| `adapters/discogsOauth/discogsRoutes.ts` | optional body zod; new `GET /native/callback` relay (declared **without** `requireAuth`) |
| `backend/README.md` | document both env vars |

## Tests first

- Unit `tests/unit/googleAuth/application/`: native start stores the challenge; complete with a matching verifier succeeds; a missing or wrong verifier → `invalid_state` and the pending login is kept; a web pending ignores the verifier.
- Unit `tests/unit/googleAuth/domain/pkceS256.test.ts`: RFC 7636 Appendix B vector (`dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` → `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`).
- Unit `tests/unit/discogsOauth/application/`: `startLink(uid, 'native')` forwards the client.
- Contract `tests/contract/googleAuth/googleAuthRoutes.test.ts`: authorize `client=native` without/with a bad challenge → 400; with a challenge → 302 whose `redirect_uri` is the native callback; the relay route → 302 to `vinylmania://auth/callback` carrying only the whitelisted params (an extra `foo=bar` is dropped); the web authorize is unchanged.
- Contract `tests/contract/discogsOauth/discogsOauthRoutes.test.ts`: `/request {client:'native'}` sends the native `oauth_callback` (nock asserts it); an invalid client → 400; the relay works with no Authorization header.

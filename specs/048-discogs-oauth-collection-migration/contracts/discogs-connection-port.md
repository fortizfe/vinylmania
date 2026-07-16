# Port Contract: `DiscogsConnectionPort`

**Feature**: 048-discogs-oauth-collection-migration | **Layer**: `ports/discogsOauth/discogsConnectionPort.ts`
**Adapter**: `adapters/discogsOauth/discogsConnectionAdapter.ts` (wraps `firebase-admin` for Firestore, and `axios` — via the relocated `oauthHttpClient.ts` — for the OAuth handshake, both directly)

Per this spec's Clarifications session (`spec.md`), this single port covers both the
Firestore-backed pending-request/connection persistence **and** the three-step OAuth
1.0a handshake, since `startLink`/`completeLink` perform both today and neither is
independently useful to this domain's linking flow. Method boundaries are drawn so
that the ownership/expiration business rules stay in the application layer, testable
against a fake port — see `research.md` Decision 3.

```ts
export interface DiscogsConnectionPort {
  /**
   * Performs the OAuth request-token handshake call and persists the
   * resulting pending request. Returns the URL the user is sent to on
   * Discogs to authorize the link. Reads `DISCOGS_OAUTH_CALLBACK_URL` from
   * `process.env` internally — adapter-owned configuration, not a
   * caller-supplied argument, mirroring `getCredentials()`'s existing
   * handling of `DISCOGS_CONSUMER_KEY`/`DISCOGS_CONSUMER_SECRET`.
   */
  createPendingRequest(uid: string): Promise<{ authorizeUrl: string }>;

  /** Returns null when the token is unknown or already consumed. */
  getPendingRequest(oauthToken: string): Promise<PendingOAuthRequest | null>;

  deletePendingRequest(oauthToken: string): Promise<void>;

  /**
   * Performs the OAuth access-token exchange call. Rejects with
   * `DiscogsOauthFlowError('expired_request', ...)` when Discogs responds
   * with a 4xx (its own signal for an expired/invalid verifier) — every
   * other failure propagates as-is.
   */
  exchangeAccessToken(
    oauthToken: string,
    requestTokenSecret: string,
    verifier: string,
  ): Promise<{ accessToken: string; accessTokenSecret: string }>;

  /** Performs the OAuth identity lookup call. */
  fetchIdentity(
    accessToken: string,
    accessTokenSecret: string,
  ): Promise<{ discogsUserId: number; discogsUsername: string }>;

  saveConnection(
    uid: string,
    connection: Omit<DiscogsConnection, 'uid'>,
  ): Promise<void>;

  /** Returns null when the user has no Discogs account linked. */
  getConnection(uid: string): Promise<DiscogsConnection | null>;

  deleteConnection(uid: string): Promise<void>;

  /**
   * Marks a connection's first library synchronization (union-merge + legacy
   * migration) as completed; every later sync for this user runs in mirror
   * mode. Called only when a first sync completes with zero failures.
   */
  markInitialLibrarySync(uid: string): Promise<void>;
}
```

## Preconditions / Postconditions (unchanged from today's `discogsOauthService.ts`)

- `createPendingRequest`: the pending request's `expiresAt` is set to `now + 15
  minutes` (`PENDING_TTL_MS`) at write time — the port, not the application layer,
  owns this timestamp's computation, since it is set in the same call that performs
  the Firestore write.
- `getPendingRequest` / `deletePendingRequest`: pure reads/deletes — the
  ownership-mismatch and expiration **decisions** are not made here; the application
  layer's `completeLink` makes them by comparing the returned record's `uid` and
  `expiresAt` against the requesting user and the current time (data-model.md's
  Linking-Flow Rules §2).
- `exchangeAccessToken`: a Discogs 4xx response (verified today via
  `isAxiosError(err) && err.response.status >= 400 && err.response.status < 500`) — the
  adapter MUST throw `DiscogsOauthFlowError('expired_request', ...)` itself on this
  path (never a raw `axios`-derived error): `completeLink` (application layer) MUST NOT
  need to import `axios`'s `isAxiosError` to classify the failure, per Constitution
  Principle VIII. `completeLink` catches this specific error, calls
  `deletePendingRequest` before re-throwing, so the pending record is still deleted on
  this path, exactly as today.
- `saveConnection` / `getConnection` / `deleteConnection`: identical Firestore
  document shape to today (`discogsConnections/{uid}`) — `linkedAt` and
  `initialLibrarySyncAt` remain Firestore `Timestamp`s internally, serialized to ISO
  8601 strings on the way out, exactly as `discogsOauthService.ts` does today.
- `markInitialLibrarySync` / `getConnection`: identical signatures to the library
  domain's existing provisional `DiscogsConnectionPort` — no shape change for these
  two, only their import path changes for that domain's consumers.
- Every method may reject with a `DiscogsError` subclass (`rate_limited`/
  `unavailable`) for handshake-step failures, exactly as `oauthHttpClient.ts` throws
  them today via its response interceptor — unchanged, still imported from the unmoved
  `discogs/discogsErrors.ts`. Application-layer-thrown `DiscogsOauthFlowError`
  (`invalid_request`/`expired_request`/`already_connected`) is a separate,
  domain-owned error type (`domain/discogsOauth/discogsOauthErrors.ts`) — see
  data-model.md's Domain Errors table.

## Explicitly out of this port's surface

The already-connected check, the pending-token ownership/expiration comparison, and
the `authorizeUrl` construction beyond the raw handshake call are application-layer
decisions (`startLink`/`completeLink`/`getConnectionStatus`/`disconnectConnection`,
`research.md` Decision 2-3) — not exposed as separate port methods, since they are the
actual business rules this migration exists to make independently testable.

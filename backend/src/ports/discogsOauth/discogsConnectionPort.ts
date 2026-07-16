import type { DiscogsConnection, PendingOAuthRequest } from '../../domain/discogsOauth/types';

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

  saveConnection(uid: string, connection: Omit<DiscogsConnection, 'uid'>): Promise<void>;

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

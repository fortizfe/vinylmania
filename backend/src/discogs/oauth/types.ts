/**
 * A user's durable link to their Discogs account.
 * Stored in `discogsConnections/{uid}` — token fields never leave the backend.
 */
export interface DiscogsConnection {
  uid: string;
  discogsUsername: string;
  discogsUserId: number;
  accessToken: string;
  accessTokenSecret: string;
  linkedAt: string; // ISO 8601
  /**
   * Set once the first library synchronization (union merge + legacy
   * migration, feature 016) completes for this connection. Absent ⇒ the
   * next sync runs in first-sync mode. Deleted with the doc on disconnect,
   * so relinking re-runs the merge.
   */
  initialLibrarySyncAt?: string; // ISO 8601
}

/**
 * A short-lived OAuth flow in progress (spec: "Pending Link Attempt").
 * Stored in `discogsOAuthRequests/{oauthToken}`; expires 15 minutes after
 * creation per Discogs' verifier validity window.
 */
export interface PendingOAuthRequest {
  uid: string;
  requestTokenSecret: string;
  createdAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
}

/**
 * The only connection shape ever serialized to the browser.
 * Token fields are structurally absent.
 */
export type ConnectionStatus =
  { connected: false } | { connected: true; discogsUsername: string; linkedAt: string };

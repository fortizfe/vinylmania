import type { OAuthClient } from '../auth/types';

export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface PendingGoogleLogin {
  state: string;
  /** Docs written before feature 070 have no `client`; the adapter reads them as `web`. */
  client: OAuthClient;
  /** S256 PKCE challenge; present only when `client` is `native`. */
  codeChallenge?: string;
  createdAt: string;
  expiresAt: string;
}

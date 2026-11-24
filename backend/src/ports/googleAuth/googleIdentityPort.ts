import type { OAuthClient } from '../../domain/auth/types';
import type { GoogleIdentity, PendingGoogleLogin } from '../../domain/googleAuth/types';

export interface GoogleIdentityPort {
  /** Builds the browser-facing URL to Google's OAuth 2.0 authorize endpoint (redirect URI per client). */
  getAuthorizeUrl(state: string, client: OAuthClient): string;

  /** Exchanges an authorization code for the caller's Google identity (server-to-server). */
  exchangeCodeForIdentity(code: string, client: OAuthClient): Promise<GoogleIdentity>;

  /** Creates and persists a fresh anti-forgery `state` for an in-flight login. */
  createPendingLogin(input: {
    client: OAuthClient;
    codeChallenge?: string;
  }): Promise<{ state: string }>;

  getPendingLogin(state: string): Promise<PendingGoogleLogin | null>;

  deletePendingLogin(state: string): Promise<void>;
}

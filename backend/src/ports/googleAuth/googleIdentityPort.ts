import type { GoogleIdentity, PendingGoogleLogin } from '../../domain/googleAuth/types';

export interface GoogleIdentityPort {
  /** Builds the browser-facing URL to Google's OAuth 2.0 authorize endpoint. */
  getAuthorizeUrl(state: string): string;

  /** Exchanges an authorization code for the caller's Google identity (server-to-server). */
  exchangeCodeForIdentity(code: string): Promise<GoogleIdentity>;

  /** Creates and persists a fresh anti-forgery `state` for an in-flight login. */
  createPendingLogin(): Promise<{ state: string }>;

  getPendingLogin(state: string): Promise<PendingGoogleLogin | null>;

  deletePendingLogin(state: string): Promise<void>;
}

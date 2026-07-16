import type { Session } from '../../domain/auth/session';

export interface SessionStorePort {
  /** Creates a new session for `uid` and returns it (the `sessionId` is the bearer token). */
  createSession(uid: string): Promise<Session>;

  /**
   * Verifies a session token and, if valid, extends its sliding-window
   * expiry (silent renewal, feature 051 clarification) as a side effect.
   * Resolves `null` for an unknown or expired token — no error translation;
   * the driving adapter is responsible for turning that into a 401.
   */
  touchSession(sessionId: string): Promise<Session | null>;

  /** Revokes only the targeted session; other sessions for the same uid are untouched. */
  revokeSession(sessionId: string): Promise<void>;
}

import type { AuthenticatedUser } from '../../domain/auth/types';

export interface AuthVerifierPort {
  /**
   * Verifies a Vinylmania session token and resolves the caller's identity.
   * Rejects on any invalid, expired, or malformed token — this port performs
   * no error translation; the driving adapter (`requireAuth`) is responsible
   * for turning a rejection into the existing 401 response.
   */
  verifySession(sessionToken: string): Promise<AuthenticatedUser>;
}

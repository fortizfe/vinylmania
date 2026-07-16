import type { AuthenticatedUser } from '../../domain/auth/types';
import type { AuthVerifierPort } from '../../ports/auth/authVerifierPort';
import type { SessionStorePort } from '../../ports/auth/sessionStorePort';
import { firestoreSessionStoreAdapter } from './firestoreSessionStoreAdapter';

export function createSessionAuthVerifierAdapter(deps: {
  sessionStore: SessionStorePort;
}): AuthVerifierPort {
  return {
    async verifySession(sessionToken: string): Promise<AuthenticatedUser> {
      const session = await deps.sessionStore.touchSession(sessionToken);
      if (!session) {
        throw new Error('unknown or expired session');
      }
      return { uid: session.uid };
    },
  };
}

export const sessionAuthVerifierAdapter: AuthVerifierPort = createSessionAuthVerifierAdapter({
  sessionStore: firestoreSessionStoreAdapter,
});

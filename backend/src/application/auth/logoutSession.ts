import { logger } from '../../config/logger';
import type { SessionStorePort } from '../../ports/auth/sessionStorePort';

export function createLogoutSessionUseCase(deps: { sessionStore: SessionStorePort }) {
  return async function logoutSession(sessionToken: string): Promise<void> {
    await deps.sessionStore.revokeSession(sessionToken);
    logger.info({ route: 'auth', outcome: 'logged_out' });
  };
}

import { logger } from '../../config/logger';
import type { GoogleIdentityPort } from '../../ports/googleAuth/googleIdentityPort';

export function createStartLoginUseCase(deps: { googleIdentity: GoogleIdentityPort }) {
  return async function startLogin(): Promise<{ authorizeUrl: string }> {
    const { state } = await deps.googleIdentity.createPendingLogin();
    const authorizeUrl = deps.googleIdentity.getAuthorizeUrl(state);
    logger.info({ route: 'google-auth', outcome: 'login_started' });
    return { authorizeUrl };
  };
}

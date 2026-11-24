import { logger } from '../../config/logger';
import type { OAuthClient } from '../../domain/auth/types';
import type { GoogleIdentityPort } from '../../ports/googleAuth/googleIdentityPort';

export function createStartLoginUseCase(deps: { googleIdentity: GoogleIdentityPort }) {
  return async function startLogin(input: {
    client: OAuthClient;
    codeChallenge?: string;
  }): Promise<{ authorizeUrl: string }> {
    const { state } = await deps.googleIdentity.createPendingLogin(input);
    const authorizeUrl = deps.googleIdentity.getAuthorizeUrl(
      state,
      input.client,
      input.codeChallenge,
    );
    logger.info({ route: 'google-auth', outcome: 'login_started' });
    return { authorizeUrl };
  };
}

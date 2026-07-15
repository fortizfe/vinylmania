import { logger } from '../../config/logger';
import { DiscogsOauthFlowError } from '../../domain/discogsOauth/discogsOauthErrors';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';

export function createStartLinkUseCase(deps: { discogsConnection: DiscogsConnectionPort }) {
  return async function startLink(uid: string): Promise<{ authorizeUrl: string }> {
    const existing = await deps.discogsConnection.getConnection(uid);
    if (existing) {
      throw new DiscogsOauthFlowError(
        'already_connected',
        'Your Discogs account is already linked. Disconnect it first to link again.',
      );
    }

    const { authorizeUrl } = await deps.discogsConnection.createPendingRequest(uid);
    logger.info({ route: 'discogs-oauth', outcome: 'link_started', uid });
    return { authorizeUrl };
  };
}

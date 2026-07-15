import { logger } from '../../config/logger';
import { DiscogsOauthFlowError } from '../../domain/discogsOauth/discogsOauthErrors';
import type { ConnectionStatus } from '../../domain/discogsOauth/types';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';

function logFailure(uid: string, message: string): void {
  logger.warn({ route: 'discogs-oauth', outcome: 'link_failed', uid, message });
}

export function createCompleteLinkUseCase(deps: { discogsConnection: DiscogsConnectionPort }) {
  return async function completeLink(
    uid: string,
    oauthToken: string,
    oauthVerifier: string,
  ): Promise<ConnectionStatus> {
    const existing = await deps.discogsConnection.getConnection(uid);
    if (existing) {
      throw new DiscogsOauthFlowError(
        'already_connected',
        'Your Discogs account is already linked. Disconnect it first to link again.',
      );
    }

    const pending = await deps.discogsConnection.getPendingRequest(oauthToken);

    if (!pending) {
      logFailure(uid, 'unknown or already-consumed oauth token');
      throw new DiscogsOauthFlowError('invalid_request', 'Unknown link attempt.');
    }

    if (pending.uid !== uid) {
      // Retain the doc: its rightful owner may still complete the flow.
      logFailure(uid, 'pending link attempt belongs to a different user');
      throw new DiscogsOauthFlowError(
        'invalid_request',
        'Link attempt belongs to another session.',
      );
    }

    if (new Date(pending.expiresAt).getTime() < Date.now()) {
      await deps.discogsConnection.deletePendingRequest(oauthToken);
      logFailure(uid, 'link attempt expired');
      throw new DiscogsOauthFlowError('expired_request', 'Link attempt expired.');
    }

    let accessToken: string;
    let accessTokenSecret: string;
    try {
      ({ accessToken, accessTokenSecret } = await deps.discogsConnection.exchangeAccessToken(
        oauthToken,
        pending.requestTokenSecret,
        oauthVerifier,
      ));
    } catch (err) {
      if (err instanceof DiscogsOauthFlowError && err.code === 'expired_request') {
        await deps.discogsConnection.deletePendingRequest(oauthToken);
        logFailure(uid, err.message);
        throw err;
      }
      logFailure(uid, err instanceof Error ? err.message : 'token exchange failed');
      throw err;
    }

    const { discogsUserId, discogsUsername } = await deps.discogsConnection.fetchIdentity(
      accessToken,
      accessTokenSecret,
    );

    const linkedAt = new Date().toISOString();
    await deps.discogsConnection.saveConnection(uid, {
      discogsUsername,
      discogsUserId,
      accessToken,
      accessTokenSecret,
      linkedAt,
    });
    await deps.discogsConnection.deletePendingRequest(oauthToken);

    logger.info({
      route: 'discogs-oauth',
      outcome: 'link_completed',
      uid,
      meta: { discogsUsername },
    });

    return {
      connected: true,
      discogsUsername,
      linkedAt,
    };
  };
}

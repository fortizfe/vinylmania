import { logger } from '../../config/logger';
import { fieldsCacheKey } from '../../domain/discogsOauth/collectionTypes';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';
import type { CachePort } from '../../ports/cache/cachePort';

export function createDisconnectConnectionUseCase(deps: {
  discogsConnection: DiscogsConnectionPort;
  cache: CachePort;
}) {
  return async function disconnectConnection(uid: string): Promise<void> {
    await deps.discogsConnection.deleteConnection(uid);
    // The cached collection field map belongs to the departing Discogs account.
    await deps.cache.invalidate(fieldsCacheKey(uid));
    logger.info({ route: 'discogs-oauth', outcome: 'disconnected', uid });
  };
}

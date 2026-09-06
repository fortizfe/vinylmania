import { logger } from '../../config/logger';
import { DiscogsNotFoundError } from '../../discogs/discogsErrors';
import { DiscogsNotLinkedError } from '../../domain/wantlist/wantlistErrors';
import type { CachePort } from '../../ports/cache/cachePort';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';
import type { DiscogsWantlistPort } from '../../ports/discogsOauth/discogsWantlistPort';
import { requireConnection } from '../library/syncLibrary';
import { wantlistCacheKey } from './listWantlist';

export { DiscogsNotLinkedError };

const ROUTE = 'wantlistSync';

/**
 * Explicit removal of a release from the caller's Discogs wantlist (US4,
 * FR-011/FR-017, `DELETE /api/wantlist/:releaseId`). The frontend gates this
 * behind a confirmation dialog; the backend removes unconditionally when called.
 *
 * `discogsWantlist.deleteWant` maps a Discogs `404` to `DiscogsNotFoundError` —
 * here that just means the release was not a want, so it is reported as
 * `'not_in_wantlist'` (the driving adapter answers `404`), not an error. The
 * `discogs:wantlist:{uid}` cache is invalidated on both outcomes: after a real
 * delete it is now stale, and a `404` proves it never held the entry — either
 * way a fresh sync is the safe next state. Any other Discogs failure propagates
 * untouched (FR-017) with the cache left intact, so the removal is never
 * reported as done.
 */
export function createRemoveFromWantlistUseCase(deps: {
  discogsWantlist: DiscogsWantlistPort;
  discogsConnection: DiscogsConnectionPort;
  cache: CachePort;
}) {
  const { discogsWantlist, discogsConnection, cache } = deps;

  async function removeFromWantlist(
    uid: string,
    releaseId: number,
  ): Promise<'removed' | 'not_in_wantlist'> {
    const connection = await requireConnection(discogsConnection, uid);

    try {
      await discogsWantlist.deleteWant(connection, releaseId);
    } catch (err) {
      if (err instanceof DiscogsNotFoundError) {
        await cache.invalidate(wantlistCacheKey(uid));
        logger.info({
          route: ROUTE,
          outcome: 'entry_removed',
          uid,
          meta: { releaseId, alreadyAbsent: true },
        });
        return 'not_in_wantlist';
      }
      throw err;
    }

    await cache.invalidate(wantlistCacheKey(uid));
    logger.info({
      route: ROUTE,
      outcome: 'entry_removed',
      uid,
      meta: { releaseId },
    });

    return 'removed';
  }

  return { removeFromWantlist };
}

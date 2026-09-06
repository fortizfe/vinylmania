import { logger } from '../../config/logger';
import type { EnrichedWantEntry } from '../../domain/discogsOauth/wantlistTypes';
import { DiscogsNotLinkedError } from '../../domain/wantlist/wantlistErrors';
import type { CachePort } from '../../ports/cache/cachePort';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';
import type { DiscogsWantlistPort } from '../../ports/discogsOauth/discogsWantlistPort';
import { requireConnection } from '../library/syncLibrary';
import { enrichWantEntries } from './enrichWantEntry';

export { DiscogsNotLinkedError };

const ROUTE = 'wantlistSync';
const WANTLIST_CACHE_TTL_SECONDS = 300;

/** Single inline key (mirrors `syncLibrary.ts`'s `syncMarkerKey`, data-model.md §7). */
export function wantlistCacheKey(uid: string): string {
  return `discogs:wantlist:${uid}`;
}

function newestFirst(a: EnrichedWantEntry, b: EnrichedWantEntry): number {
  return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
}

/**
 * Lists the caller's wantlist as a synchronized projection of their Discogs
 * wantlist — no Firestore mirror (research.md Decision 2). The full enriched,
 * newest-first array is served from `discogs:wantlist:{uid}` for 5 minutes;
 * `force` invalidates it first. Returns the whole array; the HTTP adapter
 * slices the requested page.
 */
export function createListWantlistUseCase(deps: {
  discogsWantlist: DiscogsWantlistPort;
  discogsConnection: DiscogsConnectionPort;
  cache: CachePort;
}) {
  const { discogsWantlist, discogsConnection, cache } = deps;

  async function listWantlist(
    uid: string,
    options: { force?: boolean } = {},
  ): Promise<EnrichedWantEntry[]> {
    const connection = await requireConnection(discogsConnection, uid);
    const key = wantlistCacheKey(uid);

    if (options.force) {
      await cache.invalidate(key);
    }

    // `withCache` hides whether it hit; `has` before the read decides which
    // log line to emit (matches `syncLibrary.ts`'s `isMarkerFresh` check).
    const warm = !options.force && (await cache.has(key));
    logger.info({ route: ROUTE, outcome: warm ? 'sync_skipped' : 'sync_started', uid });

    const entries = await cache.withCache(key, WANTLIST_CACHE_TTL_SECONDS, async () => {
      const wants = await discogsWantlist.listWants(connection);
      const enriched = await enrichWantEntries(uid, wants);
      return enriched.sort(newestFirst);
    });

    if (!warm) {
      logger.info({
        route: ROUTE,
        outcome: 'sync_completed',
        uid,
        meta: { totalItems: entries.length },
      });
    }

    return entries;
  }

  return { listWantlist };
}

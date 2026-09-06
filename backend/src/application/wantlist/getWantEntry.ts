import type {
  EnrichedWantEntry,
  WantEntryDetail,
  WantItem,
} from '../../domain/discogsOauth/wantlistTypes';
import { DiscogsNotLinkedError } from '../../domain/wantlist/wantlistErrors';
import type { CachePort } from '../../ports/cache/cachePort';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';
import type { DiscogsWantlistPort } from '../../ports/discogsOauth/discogsWantlistPort';
import { requireConnection } from '../library/syncLibrary';
import { wantlistCacheKey } from './listWantlist';

export { DiscogsNotLinkedError };

const WANTLIST_CACHE_TTL_SECONDS = 300;

function toDetail(want: WantItem): WantEntryDetail {
  return {
    discogsReleaseId: want.releaseId,
    rating: want.rating,
    notes: want.notes,
    addedAt: want.dateAdded,
  };
}

/**
 * Single-entry lookup for the release detail page's wantlist panel
 * (`GET /api/wantlist/:releaseId`, contract `contracts/wantlist-api.md`).
 *
 * When the caller's full wantlist is already warm in `discogs:wantlist:{uid}`
 * the entry is picked out of that cached, enriched array (zero Discogs
 * requests). Otherwise — cold cache, or the release simply not present in the
 * cached array — it falls back to `discogsWantlist.getWant` (a
 * `GET /users/{username}/wants` list walk; Discogs has no single-want endpoint).
 * No catalog enrichment: the detail page already loaded the `Release`.
 */
export function createGetWantEntryUseCase(deps: {
  discogsWantlist: DiscogsWantlistPort;
  discogsConnection: DiscogsConnectionPort;
  cache: CachePort;
}) {
  const { discogsWantlist, discogsConnection, cache } = deps;

  async function getWantEntry(
    uid: string,
    releaseId: number,
  ): Promise<WantEntryDetail | null> {
    const connection = await requireConnection(discogsConnection, uid);
    const key = wantlistCacheKey(uid);

    if (await cache.has(key)) {
      // `withCache` returns the cached array without invoking the fetcher when
      // the key is present; the `[]` fetcher is only a defensive fallback for
      // the razor-thin expiry race between `has` and this read.
      const cached = await cache.withCache<EnrichedWantEntry[]>(
        key,
        WANTLIST_CACHE_TTL_SECONDS,
        async () => [],
      );
      const hit = cached.find((entry) => entry.discogsReleaseId === releaseId);
      if (hit) {
        return {
          discogsReleaseId: hit.discogsReleaseId,
          rating: hit.rating,
          notes: hit.notes,
          addedAt: hit.addedAt,
        };
      }
    }

    const want = await discogsWantlist.getWant(connection, releaseId);
    return want ? toDetail(want) : null;
  }

  return { getWantEntry };
}

import { logger } from '../../config/logger';
import type {
  EnrichedWantEntry,
  UpdateWantEntryPatch,
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

const ROUTE = 'wantlistSync';
const WANTLIST_CACHE_TTL_SECONDS = 300;

function clampRating(rating: number): number {
  return Math.min(5, Math.max(0, Math.trunc(rating)));
}

function toDetail(want: WantItem): WantEntryDetail {
  return {
    discogsReleaseId: want.releaseId,
    rating: want.rating,
    notes: want.notes,
    addedAt: want.dateAdded,
  };
}

/**
 * Per-field autosave for a wantlist entry (US3, FR-008/FR-009,
 * `PATCH /api/wantlist/:releaseId`). Maps to `PUT /users/{username}/wants/{id}`
 * with ONLY the field the patch carries — Discogs leaves omitted fields
 * untouched.
 *
 * An existence check runs first: a release that is not a want resolves to
 * `null` so the driving adapter answers `404 not_in_wantlist` — never a silent
 * create. When `discogs:wantlist:{uid}` is warm that check reads the cached,
 * enriched array (zero Discogs requests — the autosave hot path); only on a
 * cold cache does it fall back to `discogsWantlist.getWant` (a full `/wants`
 * walk). A `putWant` failure propagates unchanged (the cache is left intact
 * and the update is not logged): the write is never reported as saved (FR-017).
 */
export function createUpdateWantEntryUseCase(deps: {
  discogsWantlist: DiscogsWantlistPort;
  discogsConnection: DiscogsConnectionPort;
  cache: CachePort;
}) {
  const { discogsWantlist, discogsConnection, cache } = deps;

  async function updateWantEntry(
    uid: string,
    releaseId: number,
    patch: UpdateWantEntryPatch,
  ): Promise<WantEntryDetail | null> {
    const connection = await requireConnection(discogsConnection, uid);
    const key = wantlistCacheKey(uid);

    let isWant: boolean;
    if (await cache.has(key)) {
      // `withCache` returns the cached array without invoking the fetcher when
      // the key is present; the `[]` fetcher only covers the thin expiry race
      // between `has` and this read (mirrors `getWantEntry.ts`).
      const cached = await cache.withCache<EnrichedWantEntry[]>(
        key,
        WANTLIST_CACHE_TTL_SECONDS,
        async () => [],
      );
      isWant = cached.some((entry) => entry.discogsReleaseId === releaseId);
    } else {
      isWant = (await discogsWantlist.getWant(connection, releaseId)) !== null;
    }
    if (!isWant) {
      return null;
    }

    const fields: { rating?: number; notes?: string } = {};
    if (patch.rating !== undefined) {
      fields.rating = clampRating(patch.rating);
    }
    if (patch.notes !== undefined) {
      fields.notes = patch.notes;
    }

    const updated = await discogsWantlist.putWant(connection, releaseId, fields);
    await cache.invalidate(wantlistCacheKey(uid));

    logger.info({
      route: ROUTE,
      outcome: 'entry_updated',
      uid,
      meta: { releaseId, fields: Object.keys(patch) },
    });

    return toDetail(updated);
  }

  return { updateWantEntry };
}

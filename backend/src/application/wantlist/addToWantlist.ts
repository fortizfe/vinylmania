import { getRelease } from '../../adapters/discogsCatalog/discogsCatalogAdapter';
import { logger } from '../../config/logger';
import {
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../discogs/discogsErrors';
import type { AddToWantlistResult } from '../../domain/discogsOauth/wantlistTypes';
import {
  CatalogUnavailableForWantError,
  ReleaseNotFoundForWantError,
} from '../../domain/wantlist/wantlistErrors';
import type { CachePort } from '../../ports/cache/cachePort';
import type { DiscogsCollectionPort } from '../../ports/discogsOauth/discogsCollectionPort';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';
import type { DiscogsWantlistPort } from '../../ports/discogsOauth/discogsWantlistPort';
import { requireConnection } from '../library/syncLibrary';
import { enrichWantEntry } from './enrichWantEntry';
import { wantlistCacheKey } from './listWantlist';

const ROUTE = 'wantlistSync';

/**
 * Adds a release to the caller's Discogs wantlist (US2, FR-005/006/007/007a).
 * There is no Firestore mirror — the Discogs wantlist is the sole system of
 * record. The flow (contract `POST /api/wantlist`, research.md Decision 6):
 *
 *   requireConnection → catalog `getRelease` gate → `getWant` (idempotency) →
 *   `putWant` when absent → `getInstancesForRelease` ("already in library",
 *   read-only) → bust `discogs:wantlist:{uid}` → enrich → assemble result.
 *
 * The catalog gate mirrors `createLibraryEntry`: a 404 becomes
 * {@link ReleaseNotFoundForWantError} and a rate-limit/unavailable becomes
 * {@link CatalogUnavailableForWantError}, both distinct from a Discogs failure
 * raised later by the wants write (which falls through to the shared
 * collection-error mapping). The library is never modified (FR-007a).
 */
export function createAddToWantlistUseCase(deps: {
  discogsWantlist: DiscogsWantlistPort;
  discogsCollection: DiscogsCollectionPort;
  discogsConnection: DiscogsConnectionPort;
  cache: CachePort;
}) {
  const { discogsWantlist, discogsCollection, discogsConnection, cache } = deps;

  async function addToWantlist(
    uid: string,
    discogsReleaseId: number,
  ): Promise<AddToWantlistResult> {
    const connection = await requireConnection(discogsConnection, uid);

    // Catalog lookup gates the add: never push an unknown release to the
    // user's wantlist, and keep release_not_found / catalog_unavailable
    // semantics identical to `POST /api/library`.
    try {
      await getRelease({ type: 'vinylmania' }, discogsReleaseId);
    } catch (err) {
      if (err instanceof DiscogsNotFoundError) {
        throw new ReleaseNotFoundForWantError(err);
      }
      if (err instanceof DiscogsRateLimitError || err instanceof DiscogsUnavailableError) {
        throw new CatalogUnavailableForWantError(err);
      }
      throw err;
    }

    const existing = await discogsWantlist.getWant(connection, discogsReleaseId);
    const alreadyInWantlist = existing !== null;

    // Idempotent: an existing want is returned unchanged, no duplicate write.
    const want = existing ?? (await discogsWantlist.putWant(connection, discogsReleaseId, {}));

    // Authoritative ownership check (research.md Decision 6) — read-only.
    const instances = await discogsCollection.getInstancesForRelease(
      connection,
      discogsReleaseId,
    );
    const alreadyInLibrary = instances.length > 0;

    await cache.invalidate(wantlistCacheKey(uid));

    logger.info({
      route: ROUTE,
      outcome: 'entry_added',
      uid,
      meta: { releaseId: discogsReleaseId, alreadyInWantlist, alreadyInLibrary },
    });

    const enriched = await enrichWantEntry(uid, want);
    return { ...enriched, alreadyInWantlist, alreadyInLibrary };
  }

  return { addToWantlist };
}

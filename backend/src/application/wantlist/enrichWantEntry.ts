import { getRelease } from '../../adapters/discogsCatalog/discogsCatalogAdapter';
import { logger } from '../../config/logger';
import { DiscogsError } from '../../discogs/discogsErrors';
import type {
  EnrichedWantEntry,
  WantItem,
} from '../../domain/discogsOauth/wantlistTypes';
import { mapWithConcurrency } from '../../shared/concurrency';

const ENRICHMENT_CONCURRENCY = 5;

/**
 * Joins one Discogs {@link WantItem} with its catalog {@link EnrichedWantEntry.release}
 * via the app-token, Redis-cached catalog path (`getRelease`, feature 011). There is
 * no Firestore row for a want, so — unlike `enrichLibraryEntry` — nothing is written
 * back. A per-release catalog failure degrades that one entry to
 * `catalogStatus: 'unavailable'` / `release: null`; the rest of the list still renders
 * (research.md Decision 3, Principle VII).
 */
export async function enrichWantEntry(
  uid: string,
  want: WantItem,
): Promise<EnrichedWantEntry> {
  const base = {
    discogsReleaseId: want.releaseId,
    rating: want.rating,
    notes: want.notes,
    addedAt: want.dateAdded,
  };

  try {
    const release = await getRelease({ type: 'vinylmania' }, want.releaseId);
    return { ...base, catalogStatus: 'ok', release };
  } catch (err) {
    const cause = err instanceof DiscogsError ? err.code : 'unknown';
    logger.warn({
      route: 'wantlistEnrichment',
      outcome: 'unavailable',
      uid,
      message: `Failed to enrich want for release ${want.releaseId}: ${cause}`,
    });
    return { ...base, catalogStatus: 'unavailable', release: null };
  }
}

export async function enrichWantEntries(
  uid: string,
  wants: WantItem[],
): Promise<EnrichedWantEntry[]> {
  return mapWithConcurrency(wants, ENRICHMENT_CONCURRENCY, (want) =>
    enrichWantEntry(uid, want),
  );
}

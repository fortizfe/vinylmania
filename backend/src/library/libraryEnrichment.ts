import { logger } from '../config/logger';
import { getRelease } from '../discogs/discogsClient';
import { DiscogsError } from '../discogs/discogsErrors';
import { mapWithConcurrency } from './concurrency';
import type { EnrichedLibraryEntry, LibraryEntry } from './types';

const ENRICHMENT_CONCURRENCY = 5;

export async function enrichEntry(entry: LibraryEntry): Promise<EnrichedLibraryEntry> {
  try {
    const release = await getRelease(entry.discogsReleaseId);
    return { ...entry, catalogStatus: 'ok', release, discogs: null };
  } catch (err) {
    const cause = err instanceof DiscogsError ? err.code : 'unknown';
    logger.warn({
      route: 'libraryEnrichment',
      outcome: 'unavailable',
      message: `Failed to enrich entry ${entry.id} (release ${entry.discogsReleaseId}): ${cause}`,
    });
    return { ...entry, catalogStatus: 'unavailable', release: null, discogs: null };
  }
}

export async function enrichEntries(
  entries: LibraryEntry[],
): Promise<EnrichedLibraryEntry[]> {
  return mapWithConcurrency(entries, ENRICHMENT_CONCURRENCY, enrichEntry);
}

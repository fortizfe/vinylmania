import { logger } from '../config/logger';
import { getRelease } from '../discogs/discogsClient';
import { DiscogsError } from '../discogs/discogsErrors';
import { mapWithConcurrency } from '../shared/concurrency';
import { persistCatalogFields } from './libraryService';
import type { EnrichedLibraryEntry, LibraryEntry } from './types';

const ENRICHMENT_CONCURRENCY = 5;

export async function enrichEntry(
  uid: string,
  entry: LibraryEntry,
): Promise<EnrichedLibraryEntry> {
  try {
    const release = await getRelease(entry.discogsReleaseId);
    const catalogFields = {
      genre: release.genres,
      style: release.styles,
      format: release.formats.map((format) => format.name),
    };
    // Write-back the entry's genre/style/format on every successful lookup
    // (feature 038, FR-018/FR-020, research.md Decision 3) — this is what
    // backfills pre-existing entries (FR-019) and keeps them current on
    // Refresh, with no separate migration/sync machinery.
    await persistCatalogFields(uid, entry.id, catalogFields);
    return { ...entry, ...catalogFields, catalogStatus: 'ok', release, discogs: null };
  } catch (err) {
    const cause = err instanceof DiscogsError ? err.code : 'unknown';
    logger.warn({
      route: 'libraryEnrichment',
      outcome: 'unavailable',
      message: `Failed to enrich entry ${entry.id} (release ${entry.discogsReleaseId}): ${cause}`,
    });
    // No write-back on failure: previously persisted genre/style/format (if
    // any) are left untouched (FR-024, Clarifications Session 2026-07-12).
    return { ...entry, catalogStatus: 'unavailable', release: null, discogs: null };
  }
}

export async function enrichEntries(
  uid: string,
  entries: LibraryEntry[],
): Promise<EnrichedLibraryEntry[]> {
  return mapWithConcurrency(entries, ENRICHMENT_CONCURRENCY, (entry) =>
    enrichEntry(uid, entry),
  );
}

import type { CatalogSearchResult, CatalogSuggestion } from './types';

/**
 * The suggestion panel's allocation rule (feature 069, spec FR-011, SC-011;
 * data-model.md §3): at most five suggestions, base allowance 2 artists +
 * 3 albums, cross-filled to five from whichever group still has hits.
 *
 * Pure: one upstream page of already-mapped hits in, at most five
 * `CatalogSuggestion`s out. No clock, no randomness, no I/O.
 */

const MAX_SUGGESTIONS = 5;
const BASE_ARTISTS = 2;
const BASE_ALBUMS = 3;

/** The narrow panel projection (data-model.md §2) — absent fields are omitted, never null. */
function toSuggestion(hit: CatalogSearchResult): CatalogSuggestion {
  const format = hit.formats?.[0];
  return {
    discogsId: hit.discogsId,
    resultType: hit.resultType,
    title: hit.title,
    ...(hit.artist ? { artist: hit.artist } : {}),
    ...(hit.year !== undefined ? { year: hit.year } : {}),
    ...(format ? { format } : {}),
    ...(hit.thumbnailUrl ? { thumbnailUrl: hit.thumbnailUrl } : {}),
  };
}

export function allocateSuggestions(hits: CatalogSearchResult[]): CatalogSuggestion[] {
  // An "album" is a release or a master (data-model.md §1); both land in
  // the same bucket, each group keeping Discogs' own order.
  const artists = hits.filter((hit) => hit.resultType === 'artist');
  const albums = hits.filter((hit) => hit.resultType !== 'artist');

  let takenArtists = Math.min(BASE_ARTISTS, artists.length);
  let takenAlbums = Math.min(BASE_ALBUMS, albums.length);

  // Cross-fill the unused allowance: the next album first, then the next
  // artist, until five are taken or both groups are exhausted.
  while (takenArtists + takenAlbums < MAX_SUGGESTIONS) {
    if (takenAlbums < albums.length) {
      takenAlbums += 1;
    } else if (takenArtists < artists.length) {
      takenArtists += 1;
    } else {
      break;
    }
  }

  return [...artists.slice(0, takenArtists), ...albums.slice(0, takenAlbums)].map(toSuggestion);
}

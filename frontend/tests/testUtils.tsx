import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';

import type { CatalogSearchResult } from '../src/services/discogsApi';
import type { EnrichedLibraryEntry } from '../src/services/libraryApi';

// Fresh, retry-disabled QueryClient per test so cache state never leaks
// across test cases and failures surface immediately instead of retrying.
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function renderWithQueryClient(
  ui: ReactElement,
  client: QueryClient = createTestQueryClient(),
): RenderResult {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// ---------------------------------------------------------------------------
// Feature 017: record rating badges. Reusable rating/no-rating fixture
// variants for search-result and library card tests.
// ---------------------------------------------------------------------------

/** A search result with a valid, votable community rating (defaults to a "high" band value). */
export function buildRatedSearchResult(
  overrides: Partial<CatalogSearchResult> = {},
): CatalogSearchResult {
  return {
    discogsId: 1,
    resultType: 'release',
    title: 'Kind Of Blue',
    artist: 'Miles Davis',
    thumbnailUrl: 'https://example.com/cover.jpg',
    year: 1959,
    formats: ['Vinyl'],
    communityRating: { average: 4.5, count: 42 },
    ...overrides,
  };
}

/** A search result with no valid community rating (badge shows the unrated placeholder, feature 019). */
export function buildUnratedSearchResult(
  overrides: Partial<CatalogSearchResult> = {},
): CatalogSearchResult {
  const result = buildRatedSearchResult(overrides);
  delete result.communityRating;
  return result;
}

/** A library entry whose release carries a valid community rating. */
export function buildRatedLibraryEntry(
  overrides: Partial<EnrichedLibraryEntry> = {},
): EnrichedLibraryEntry {
  return {
    id: 'entry-1',
    discogsReleaseId: 1,
    addedAt: '2026-07-03T00:00:00.000Z',
    catalogStatus: 'ok',
    release: {
      discogsId: 1,
      title: 'Stockholm',
      artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
      labels: [],
      formats: [],
      genres: [],
      styles: [],
      identifiers: [],
      community: { have: 10, want: 5, rating: { average: 4.5, count: 42 } },
      tracklist: [],
      images: [],
      discogsUrl: 'https://www.discogs.com/release/1',
    },
    discogs: null,
    ...overrides,
  };
}

/** A library entry whose release has no valid community rating (badge shows the unrated placeholder, feature 019). */
export function buildUnratedLibraryEntry(
  overrides: Partial<EnrichedLibraryEntry> = {},
): EnrichedLibraryEntry {
  const entry = buildRatedLibraryEntry(overrides);
  if (entry.release) {
    delete entry.release.community;
  }
  return entry;
}

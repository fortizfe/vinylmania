import nock from 'nock';

export const DISCOGS_BASE_URL = 'https://api.discogs.com';

beforeAll(() => {
  // Block all real network except localhost, so supertest can still reach
  // the in-process Express app under test while Discogs calls stay mocked.
  nock.disableNetConnect();
  nock.enableNetConnect((host) => host.includes('127.0.0.1') || host.includes('localhost'));
});

afterEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.enableNetConnect();
});

export function discogsScope(): nock.Scope {
  return nock(DISCOGS_BASE_URL);
}

// ---------------------------------------------------------------------------
// Feature 016: authenticated user-collection endpoints. The collection client
// reads DISCOGS_OAUTH_BASE_URL, which is unset under test, so its default
// (api.discogs.com) makes discogsScope() intercept these calls too.
// ---------------------------------------------------------------------------

export interface RawInstanceOverrides {
  instanceId?: number;
  folderId?: number;
  rating?: number;
  dateAdded?: string;
  mediaCondition?: string;
  sleeveCondition?: string;
  notes?: string;
}

/** Builds an instance payload as returned by Discogs' collection listings. */
export function rawCollectionInstance(releaseId: number, overrides: RawInstanceOverrides = {}) {
  const noteValues = [
    ...(overrides.mediaCondition ? [{ field_id: 1, value: overrides.mediaCondition }] : []),
    ...(overrides.sleeveCondition ? [{ field_id: 2, value: overrides.sleeveCondition }] : []),
    ...(overrides.notes ? [{ field_id: 3, value: overrides.notes }] : []),
  ];
  return {
    instance_id: overrides.instanceId ?? releaseId * 10,
    folder_id: overrides.folderId ?? 1,
    rating: overrides.rating ?? 0,
    date_added: overrides.dateAdded ?? '2026-01-01T00:00:00-08:00',
    basic_information: { id: releaseId, title: `Release ${releaseId}`, year: 2000 },
    notes: noteValues,
  };
}

export const RAW_COLLECTION_FIELDS = {
  fields: [
    { id: 1, name: 'Media Condition', type: 'dropdown' },
    { id: 2, name: 'Sleeve Condition', type: 'dropdown' },
    { id: 3, name: 'Notes', type: 'textarea' },
  ],
};

/** Stubs the custom-fields listing for a user (media/sleeve/notes defaults). */
export function stubCollectionFields(
  username: string,
  body: nock.Body = RAW_COLLECTION_FIELDS,
): nock.Scope {
  return discogsScope().get(`/users/${username}/collection/fields`).reply(200, body);
}

/** Stubs one page of the all-folders collection listing for a user. */
export function stubCollectionPage(
  username: string,
  instances: ReturnType<typeof rawCollectionInstance>[],
  { page = 1, pages = 1 }: { page?: number; pages?: number } = {},
): nock.Scope {
  return discogsScope()
    .get(`/users/${username}/collection/folders/0/releases`)
    .query((query) => Number(query.page ?? 1) === page)
    .reply(200, {
      pagination: { page, pages, per_page: 100, items: instances.length },
      releases: instances,
    });
}

// ---------------------------------------------------------------------------
// Feature 017: record rating badges. Search-result rating enrichment fetches
// GET /releases/{id}/rating per release; these builders cover the enriched,
// unrated, failed, and slow/timed-out cases the backend must degrade against.
// ---------------------------------------------------------------------------

export interface RawSearchResultOverrides {
  id?: number;
  type?: 'release' | 'artist';
  title?: string;
  thumb?: string;
  cover_image?: string;
  year?: string | number;
  format?: string[];
}

/** Builds a raw `/database/search` result item as Discogs returns it. */
export function rawSearchResultItem(overrides: RawSearchResultOverrides = {}) {
  return {
    id: 1,
    type: 'release' as const,
    title: 'The Persuader - Stockholm',
    thumb: '',
    cover_image: '',
    year: '1999',
    format: ['Vinyl'],
    ...overrides,
  };
}

/** Stubs a successful community-rating lookup for a release. */
export function stubReleaseRating(
  releaseId: number,
  rating: { average: number; count: number },
): nock.Scope {
  return discogsScope()
    .get(`/releases/${releaseId}/rating`)
    .reply(200, { release_id: releaseId, rating });
}

/** Stubs a rating lookup that never resolves within the 2-second lookup timeout. */
export function stubReleaseRatingNeverResolves(releaseId: number): nock.Scope {
  return discogsScope()
    .get(`/releases/${releaseId}/rating`)
    .delay(2_500)
    .reply(200, { release_id: releaseId, rating: { average: 4.5, count: 10 } });
}

/** Stubs a rating lookup that fails outright (service error). */
export function stubReleaseRatingUnavailable(releaseId: number): nock.Scope {
  return discogsScope().get(`/releases/${releaseId}/rating`).reply(503, { message: 'unavailable' });
}

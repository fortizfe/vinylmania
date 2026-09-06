import { createGetWantEntryUseCase } from '../../../../src/application/wantlist/getWantEntry';
import { createUpdateWantEntryUseCase } from '../../../../src/application/wantlist/updateWantEntry';
import { DiscogsNotLinkedError } from '../../../../src/domain/wantlist/wantlistErrors';
import { logger } from '../../../../src/config/logger';
import type { Release } from '../../../../src/domain/discogsCatalog/types';
import type { DiscogsConnection } from '../../../../src/domain/discogsOauth/types';
import type {
  EnrichedWantEntry,
  WantItem,
} from '../../../../src/domain/discogsOauth/wantlistTypes';
import type { CachePort } from '../../../../src/ports/cache/cachePort';
import type { DiscogsWantlistPort } from '../../../../src/ports/discogsOauth/discogsWantlistPort';
import type { DiscogsConnectionPort } from '../../../../src/ports/discogsOauth/discogsConnectionPort';

const UID = 'user-1';
const RELEASE_ID = 555;

function connection(overrides: Partial<DiscogsConnection> = {}): DiscogsConnection {
  return {
    uid: UID,
    discogsUsername: 'collector',
    discogsUserId: 9,
    accessToken: 'at',
    accessTokenSecret: 'as',
    linkedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function want(releaseId: number, overrides: Partial<WantItem> = {}): WantItem {
  return {
    releaseId,
    rating: 0,
    notes: null,
    dateAdded: '2025-08-01T12:00:00.000Z',
    basicInformation: {
      title: `Release ${releaseId}`,
      year: 1979,
      artists: [],
      thumb: null,
    },
    ...overrides,
  };
}

function release(discogsId: number): Release {
  return {
    discogsId,
    title: `Release ${discogsId}`,
    artists: [],
    labels: [],
    formats: [],
    genres: [],
    styles: [],
    identifiers: [],
    tracklist: [],
    images: [],
    discogsUrl: `https://www.discogs.com/release/${discogsId}`,
  };
}

function enriched(
  releaseId: number,
  overrides: Partial<EnrichedWantEntry> = {},
): EnrichedWantEntry {
  return {
    discogsReleaseId: releaseId,
    rating: 0,
    notes: null,
    addedAt: '2025-08-01T12:00:00.000Z',
    catalogStatus: 'ok',
    release: release(releaseId),
    ...overrides,
  };
}

function fakeDiscogsWantlist(): jest.Mocked<DiscogsWantlistPort> {
  return {
    listWants: jest.fn().mockResolvedValue([]),
    getWant: jest.fn().mockResolvedValue(null),
    putWant: jest
      .fn()
      .mockImplementation(
        async (_conn, releaseId: number, fields: { notes?: string; rating?: number }) =>
          want(releaseId, {
            rating: fields.rating ?? 0,
            notes: fields.notes && fields.notes !== '' ? fields.notes : null,
          }),
      ),
    deleteWant: jest.fn(),
  };
}

function fakeDiscogsConnection(): jest.Mocked<DiscogsConnectionPort> {
  return {
    createPendingRequest: jest.fn(),
    getPendingRequest: jest.fn(),
    deletePendingRequest: jest.fn(),
    exchangeAccessToken: jest.fn(),
    fetchIdentity: jest.fn(),
    saveConnection: jest.fn(),
    getConnection: jest.fn().mockResolvedValue(connection()),
    deleteConnection: jest.fn(),
    markInitialLibrarySync: jest.fn().mockResolvedValue(undefined),
  };
}

function fakeCache(): jest.Mocked<CachePort> {
  return {
    has: jest.fn().mockResolvedValue(false),
    set: jest.fn().mockResolvedValue(undefined),
    withCache: jest.fn().mockImplementation((_key, _ttl, fetcher) => fetcher()),
    invalidate: jest.fn().mockResolvedValue(undefined),
  };
}

function buildGet(
  overrides: {
    discogsWantlist?: jest.Mocked<DiscogsWantlistPort>;
    discogsConnection?: jest.Mocked<DiscogsConnectionPort>;
    cache?: jest.Mocked<CachePort>;
  } = {},
) {
  const discogsWantlist = overrides.discogsWantlist ?? fakeDiscogsWantlist();
  const discogsConnection = overrides.discogsConnection ?? fakeDiscogsConnection();
  const cache = overrides.cache ?? fakeCache();
  const { getWantEntry } = createGetWantEntryUseCase({
    discogsWantlist,
    discogsConnection,
    cache,
  });
  return { getWantEntry, discogsWantlist, discogsConnection, cache };
}

function buildUpdate(
  overrides: {
    discogsWantlist?: jest.Mocked<DiscogsWantlistPort>;
    discogsConnection?: jest.Mocked<DiscogsConnectionPort>;
    cache?: jest.Mocked<CachePort>;
  } = {},
) {
  const discogsWantlist = overrides.discogsWantlist ?? fakeDiscogsWantlist();
  const discogsConnection = overrides.discogsConnection ?? fakeDiscogsConnection();
  const cache = overrides.cache ?? fakeCache();
  const { updateWantEntry } = createUpdateWantEntryUseCase({
    discogsWantlist,
    discogsConnection,
    cache,
  });
  return { updateWantEntry, discogsWantlist, discogsConnection, cache };
}

describe('getWantEntry', () => {
  it('throws DiscogsNotLinkedError when the user has no connection', async () => {
    const discogsConnection = fakeDiscogsConnection();
    discogsConnection.getConnection.mockResolvedValue(null);
    const { getWantEntry, discogsWantlist } = buildGet({ discogsConnection });

    await expect(getWantEntry(UID, RELEASE_ID)).rejects.toBeInstanceOf(
      DiscogsNotLinkedError,
    );
    expect(discogsWantlist.getWant).not.toHaveBeenCalled();
  });

  it('returns a WantEntryDetail from discogsWantlist.getWant when the cache is cold', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.getWant.mockResolvedValue(
      want(RELEASE_ID, {
        rating: 4,
        notes: 'Original pressing only',
        dateAdded: '2025-06-01T00:00:00.000Z',
      }),
    );
    const { getWantEntry } = buildGet({ discogsWantlist });

    const result = await getWantEntry(UID, RELEASE_ID);

    expect(result).toEqual({
      discogsReleaseId: RELEASE_ID,
      rating: 4,
      notes: 'Original pressing only',
      addedAt: '2025-06-01T00:00:00.000Z',
    });
  });

  it('returns null when the release is not in the wantlist', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.getWant.mockResolvedValue(null);
    const { getWantEntry } = buildGet({ discogsWantlist });

    await expect(getWantEntry(UID, RELEASE_ID)).resolves.toBeNull();
  });

  it('serves from the warm discogs:wantlist cache without calling getWant', async () => {
    const cache = fakeCache();
    cache.has.mockResolvedValue(true);
    cache.withCache.mockResolvedValue([
      enriched(999),
      enriched(RELEASE_ID, {
        rating: 5,
        notes: 'Warm',
        addedAt: '2025-07-07T00:00:00.000Z',
      }),
    ]);
    const { getWantEntry, discogsWantlist } = buildGet({ cache });

    const result = await getWantEntry(UID, RELEASE_ID);

    expect(result).toEqual({
      discogsReleaseId: RELEASE_ID,
      rating: 5,
      notes: 'Warm',
      addedAt: '2025-07-07T00:00:00.000Z',
    });
    expect(discogsWantlist.getWant).not.toHaveBeenCalled();
    expect(cache.withCache).toHaveBeenCalledWith(
      'discogs:wantlist:user-1',
      expect.any(Number),
      expect.any(Function),
    );
  });

  it('falls through to getWant when the warm cache does not contain the release', async () => {
    const cache = fakeCache();
    cache.has.mockResolvedValue(true);
    cache.withCache.mockResolvedValue([enriched(999)]);
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.getWant.mockResolvedValue(want(RELEASE_ID, { rating: 2 }));
    const { getWantEntry } = buildGet({ cache, discogsWantlist });

    const result = await getWantEntry(UID, RELEASE_ID);

    expect(result).toMatchObject({ discogsReleaseId: RELEASE_ID, rating: 2 });
    expect(discogsWantlist.getWant).toHaveBeenCalledTimes(1);
  });
});

describe('updateWantEntry', () => {
  it('throws DiscogsNotLinkedError when the user has no connection', async () => {
    const discogsConnection = fakeDiscogsConnection();
    discogsConnection.getConnection.mockResolvedValue(null);
    const { updateWantEntry, discogsWantlist } = buildUpdate({ discogsConnection });

    await expect(updateWantEntry(UID, RELEASE_ID, { rating: 3 })).rejects.toBeInstanceOf(
      DiscogsNotLinkedError,
    );
    expect(discogsWantlist.putWant).not.toHaveBeenCalled();
  });

  it('returns null and does not write when the release is not a want', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.getWant.mockResolvedValue(null);
    const { updateWantEntry, cache } = buildUpdate({ discogsWantlist });

    await expect(updateWantEntry(UID, RELEASE_ID, { rating: 3 })).resolves.toBeNull();
    expect(discogsWantlist.putWant).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('uses the warm discogs:wantlist cache for the existence check, skipping getWant', async () => {
    const cache = fakeCache();
    cache.has.mockResolvedValue(true);
    cache.withCache.mockResolvedValue([enriched(999), enriched(RELEASE_ID)]);
    const discogsWantlist = fakeDiscogsWantlist();
    const { updateWantEntry } = buildUpdate({ cache, discogsWantlist });

    await updateWantEntry(UID, RELEASE_ID, { rating: 5 });

    expect(discogsWantlist.getWant).not.toHaveBeenCalled();
    expect(discogsWantlist.listWants).not.toHaveBeenCalled();
    expect(discogsWantlist.putWant).toHaveBeenCalledWith(
      expect.objectContaining({ uid: UID }),
      RELEASE_ID,
      { rating: 5 },
    );
    expect(cache.withCache).toHaveBeenCalledWith(
      'discogs:wantlist:user-1',
      expect.any(Number),
      expect.any(Function),
    );
  });

  it('returns null without a Discogs read when the warm cache lacks the release', async () => {
    const cache = fakeCache();
    cache.has.mockResolvedValue(true);
    cache.withCache.mockResolvedValue([enriched(999)]);
    const discogsWantlist = fakeDiscogsWantlist();
    const { updateWantEntry } = buildUpdate({ cache, discogsWantlist });

    await expect(updateWantEntry(UID, RELEASE_ID, { rating: 5 })).resolves.toBeNull();
    expect(discogsWantlist.getWant).not.toHaveBeenCalled();
    expect(discogsWantlist.putWant).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('sends ONLY the rating field to putWant when the patch carries only rating', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.getWant.mockResolvedValue(want(RELEASE_ID));
    const { updateWantEntry } = buildUpdate({ discogsWantlist });

    await updateWantEntry(UID, RELEASE_ID, { rating: 5 });

    expect(discogsWantlist.putWant).toHaveBeenCalledWith(
      expect.objectContaining({ uid: UID }),
      RELEASE_ID,
      { rating: 5 },
    );
  });

  it('sends ONLY the notes field to putWant when the patch carries only notes', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.getWant.mockResolvedValue(want(RELEASE_ID));
    const { updateWantEntry } = buildUpdate({ discogsWantlist });

    await updateWantEntry(UID, RELEASE_ID, { notes: 'Repress is fine' });

    expect(discogsWantlist.putWant).toHaveBeenCalledWith(
      expect.objectContaining({ uid: UID }),
      RELEASE_ID,
      { notes: 'Repress is fine' },
    );
  });

  it('allows an empty-string note to clear the field', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.getWant.mockResolvedValue(want(RELEASE_ID, { notes: 'old' }));
    const { updateWantEntry } = buildUpdate({ discogsWantlist });

    await updateWantEntry(UID, RELEASE_ID, { notes: '' });

    expect(discogsWantlist.putWant).toHaveBeenCalledWith(
      expect.objectContaining({ uid: UID }),
      RELEASE_ID,
      { notes: '' },
    );
  });

  it('clamps the rating defensively into 0..5', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.getWant.mockResolvedValue(want(RELEASE_ID));
    const { updateWantEntry } = buildUpdate({ discogsWantlist });

    await updateWantEntry(UID, RELEASE_ID, { rating: 9 });

    expect(discogsWantlist.putWant).toHaveBeenCalledWith(
      expect.objectContaining({ uid: UID }),
      RELEASE_ID,
      { rating: 5 },
    );
  });

  it('invalidates the wantlist cache key after a successful write', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.getWant.mockResolvedValue(want(RELEASE_ID));
    const { updateWantEntry, cache } = buildUpdate({ discogsWantlist });

    await updateWantEntry(UID, RELEASE_ID, { rating: 4 });

    expect(cache.invalidate).toHaveBeenCalledWith('discogs:wantlist:user-1');
  });

  it('returns the updated WantEntryDetail from the putWant response', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.getWant.mockResolvedValue(want(RELEASE_ID));
    discogsWantlist.putWant.mockResolvedValue(
      want(RELEASE_ID, {
        rating: 4,
        notes: 'Updated',
        dateAdded: '2025-08-01T12:00:00.000Z',
      }),
    );
    const { updateWantEntry } = buildUpdate({ discogsWantlist });

    const result = await updateWantEntry(UID, RELEASE_ID, { rating: 4 });

    expect(result).toEqual({
      discogsReleaseId: RELEASE_ID,
      rating: 4,
      notes: 'Updated',
      addedAt: '2025-08-01T12:00:00.000Z',
    });
  });

  it('propagates a putWant failure and does not invalidate the cache (FR-017)', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.getWant.mockResolvedValue(want(RELEASE_ID));
    discogsWantlist.putWant.mockRejectedValue(new Error('discogs write failed'));
    const { updateWantEntry, cache } = buildUpdate({ discogsWantlist });

    await expect(updateWantEntry(UID, RELEASE_ID, { rating: 4 })).rejects.toThrow(
      'discogs write failed',
    );
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('logs entry_updated with the patched field names', async () => {
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.getWant.mockResolvedValue(want(RELEASE_ID));
    const { updateWantEntry } = buildUpdate({ discogsWantlist });

    await updateWantEntry(UID, RELEASE_ID, { notes: 'hi' });

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'wantlistSync',
        outcome: 'entry_updated',
        uid: UID,
        meta: { releaseId: RELEASE_ID, fields: ['notes'] },
      }),
    );
    infoSpy.mockRestore();
  });
});

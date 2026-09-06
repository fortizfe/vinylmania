import { createRemoveFromWantlistUseCase } from '../../../../src/application/wantlist/removeFromWantlist';
import {
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../../../src/discogs/discogsErrors';
import { DiscogsNotLinkedError } from '../../../../src/domain/wantlist/wantlistErrors';
import { logger } from '../../../../src/config/logger';
import type { DiscogsConnection } from '../../../../src/domain/discogsOauth/types';
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

function fakeDiscogsWantlist(): jest.Mocked<DiscogsWantlistPort> {
  return {
    listWants: jest.fn().mockResolvedValue([]),
    getWant: jest.fn().mockResolvedValue(null),
    putWant: jest.fn(),
    deleteWant: jest.fn().mockResolvedValue(undefined),
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

function build(
  overrides: {
    discogsWantlist?: jest.Mocked<DiscogsWantlistPort>;
    discogsConnection?: jest.Mocked<DiscogsConnectionPort>;
    cache?: jest.Mocked<CachePort>;
  } = {},
) {
  const discogsWantlist = overrides.discogsWantlist ?? fakeDiscogsWantlist();
  const discogsConnection = overrides.discogsConnection ?? fakeDiscogsConnection();
  const cache = overrides.cache ?? fakeCache();
  const { removeFromWantlist } = createRemoveFromWantlistUseCase({
    discogsWantlist,
    discogsConnection,
    cache,
  });
  return { removeFromWantlist, discogsWantlist, discogsConnection, cache };
}

describe('removeFromWantlist', () => {
  it('throws DiscogsNotLinkedError when the user has no connection', async () => {
    const discogsConnection = fakeDiscogsConnection();
    discogsConnection.getConnection.mockResolvedValue(null);
    const { removeFromWantlist, discogsWantlist } = build({ discogsConnection });

    await expect(removeFromWantlist(UID, RELEASE_ID)).rejects.toBeInstanceOf(
      DiscogsNotLinkedError,
    );
    expect(discogsWantlist.deleteWant).not.toHaveBeenCalled();
  });

  it('calls deleteWant with the release id and resolves "removed" on success', async () => {
    const { removeFromWantlist, discogsWantlist } = build();

    await expect(removeFromWantlist(UID, RELEASE_ID)).resolves.toBe('removed');

    expect(discogsWantlist.deleteWant).toHaveBeenCalledWith(
      expect.objectContaining({ uid: UID }),
      RELEASE_ID,
    );
  });

  it('invalidates the wantlist cache key after a successful delete', async () => {
    const { removeFromWantlist, cache } = build();

    await removeFromWantlist(UID, RELEASE_ID);

    expect(cache.invalidate).toHaveBeenCalledWith('discogs:wantlist:user-1');
  });

  it('maps a DiscogsNotFoundError to "not_in_wantlist" and still invalidates the cache', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.deleteWant.mockRejectedValue(new DiscogsNotFoundError());
    const { removeFromWantlist, cache } = build({ discogsWantlist });

    await expect(removeFromWantlist(UID, RELEASE_ID)).resolves.toBe('not_in_wantlist');
    expect(cache.invalidate).toHaveBeenCalledWith('discogs:wantlist:user-1');
  });

  it.each([
    ['rate limit', new DiscogsRateLimitError()],
    ['unavailable', new DiscogsUnavailableError()],
  ])('propagates a non-404 Discogs error (%s) without invalidating the cache', async (
    _label,
    error,
  ) => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.deleteWant.mockRejectedValue(error);
    const { removeFromWantlist, cache } = build({ discogsWantlist });

    await expect(removeFromWantlist(UID, RELEASE_ID)).rejects.toBe(error);
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('logs entry_removed with the route, uid and releaseId on success', async () => {
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    const { removeFromWantlist } = build();

    await removeFromWantlist(UID, RELEASE_ID);

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'wantlistSync',
        outcome: 'entry_removed',
        uid: UID,
        meta: { releaseId: RELEASE_ID },
      }),
    );
    infoSpy.mockRestore();
  });
});

import {
  discogsScope,
  rawCollectionInstance,
  stubCollectionFields,
  stubCollectionPage,
} from '../../helpers/nock';

import { logger } from '../../../src/config/logger';
import {
  addReleaseToCollection,
  deleteInstance,
  getFieldMap,
  getInstancesForRelease,
  listAllInstances,
  setFieldValue,
  setRating,
} from '../../../src/adapters/discogsOauth/discogsCollectionAdapter';
import type { CollectionFieldMap } from '../../../src/domain/discogsOauth/collectionTypes';
import { getRelease } from '../../../src/adapters/discogsCatalog/discogsCatalogAdapter';
import {
  DiscogsAuthError,
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../../src/discogs/discogsErrors';
import { MAX_WAIT_MS } from '../../../src/discogs/discogsRateLimiter';
import { MAX_ATTEMPTS } from '../../../src/discogs/discogsRetry';
import type { DiscogsConnection } from '../../../src/domain/discogsOauth/types';

const connection: DiscogsConnection = {
  uid: 'user-1',
  discogsUsername: 'testuser',
  discogsUserId: 42,
  accessToken: 'access-token',
  accessTokenSecret: 'access-secret',
  linkedAt: '2026-07-01T00:00:00.000Z',
};

beforeAll(() => {
  // Keep the per-user field map from being cached in a real local Redis:
  // without REDIS_URL the cache-aside layer passes straight through.
  delete process.env.REDIS_URL;
});

const OAUTH_TOKEN_HEADER = /oauth_token="access-token"/;

describe('collectionClient: listAllInstances', () => {
  it('walks every page of folder 0 with a signed request and maps named fields', async () => {
    stubCollectionFields('testuser');
    discogsScope()
      .get('/users/testuser/collection/folders/0/releases')
      .query((query) => Number(query.page ?? 1) === 1)
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(200, {
        pagination: { page: 1, pages: 2, per_page: 100, items: 2 },
        releases: [
          rawCollectionInstance(101, {
            instanceId: 11,
            rating: 4,
            mediaCondition: 'Very Good Plus (VG+)',
            sleeveCondition: 'Generic',
            notes: 'First pressing',
            dateAdded: '2025-12-01T00:00:00-08:00',
          }),
        ],
      });
    stubCollectionPage(
      'testuser',
      [rawCollectionInstance(202, { instanceId: 22, folderId: 3 })],
      {
        page: 2,
        pages: 2,
      },
    );

    const instances = await listAllInstances(connection);

    expect(instances).toHaveLength(2);
    expect(instances[0]).toEqual({
      releaseId: 101,
      instanceId: 11,
      folderId: 1,
      rating: 4,
      mediaCondition: 'Very Good Plus (VG+)',
      sleeveCondition: 'Generic',
      notes: 'First pressing',
      dateAdded: expect.any(String),
    });
    expect(instances[1]).toMatchObject({
      releaseId: 202,
      instanceId: 22,
      folderId: 3,
      rating: 0,
      mediaCondition: null,
      sleeveCondition: null,
      notes: null,
    });
  });

  it('maps a 401 to DiscogsAuthError (externally revoked link)', async () => {
    stubCollectionFields('testuser');
    discogsScope()
      .get('/users/testuser/collection/folders/0/releases')
      .query(true)
      .reply(401, { message: 'You must authenticate.' });

    await expect(listAllInstances(connection)).rejects.toBeInstanceOf(DiscogsAuthError);
  });

  it('exhausts retries and maps a sustained 429 to DiscogsRateLimitError (feature 040, US3)', async () => {
    stubCollectionFields('testuser');
    discogsScope()
      .get('/users/testuser/collection/folders/0/releases')
      .query(true)
      .times(MAX_ATTEMPTS)
      .reply(429, { message: 'Too many requests' });

    await expect(listAllInstances(connection)).rejects.toBeInstanceOf(
      DiscogsRateLimitError,
    );
  }, 8_000);

  it('exhausts retries and maps a sustained 5xx to DiscogsUnavailableError (feature 040, US3)', async () => {
    stubCollectionFields('testuser');
    discogsScope()
      .get('/users/testuser/collection/folders/0/releases')
      .query(true)
      .times(MAX_ATTEMPTS)
      .reply(500, { message: 'boom' });

    await expect(listAllInstances(connection)).rejects.toBeInstanceOf(
      DiscogsUnavailableError,
    );
  }, 8_000);

  it('exhausts retries and maps a sustained network failure to DiscogsUnavailableError (feature 040, US3)', async () => {
    stubCollectionFields('testuser');
    discogsScope()
      .get('/users/testuser/collection/folders/0/releases')
      .query(true)
      .times(MAX_ATTEMPTS)
      .replyWithError('socket hang up');

    await expect(listAllInstances(connection)).rejects.toBeInstanceOf(
      DiscogsUnavailableError,
    );
  }, 8_000);
});

describe('collectionClient: getFieldMap', () => {
  it('resolves field IDs by their default names', async () => {
    stubCollectionFields('testuser', {
      fields: [
        // Customized account: ids differ from the 1/2/3 defaults.
        { id: 7, name: 'Sleeve Condition', type: 'dropdown' },
        { id: 5, name: 'Media Condition', type: 'dropdown' },
        { id: 9, name: 'Notes', type: 'textarea' },
      ],
    });

    await expect(getFieldMap(connection)).resolves.toEqual({
      mediaConditionFieldId: 5,
      sleeveConditionFieldId: 7,
      notesFieldId: 9,
    });
  });

  it('returns null for fields the user deleted on discogs.com', async () => {
    stubCollectionFields('testuser', {
      fields: [{ id: 3, name: 'Notes', type: 'textarea' }],
    });

    await expect(getFieldMap(connection)).resolves.toEqual({
      mediaConditionFieldId: null,
      sleeveConditionFieldId: null,
      notesFieldId: 3,
    });
  });

  it('maps a 403 to DiscogsAuthError', async () => {
    discogsScope()
      .get('/users/testuser/collection/fields')
      .reply(403, { message: 'forbidden' });

    await expect(getFieldMap(connection)).rejects.toBeInstanceOf(DiscogsAuthError);
  });
});

describe('collectionClient: getInstancesForRelease', () => {
  it('returns the instances of one release', async () => {
    stubCollectionFields('testuser');
    discogsScope()
      .get('/users/testuser/collection/releases/101')
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(200, {
        pagination: { page: 1, pages: 1, per_page: 100, items: 2 },
        releases: [
          rawCollectionInstance(101, { instanceId: 30 }),
          rawCollectionInstance(101, { instanceId: 12, rating: 5 }),
        ],
      });

    const instances = await getInstancesForRelease(connection, 101);

    expect(instances.map((instance) => instance.instanceId)).toEqual([30, 12]);
  });
});

describe('collectionClient: addReleaseToCollection', () => {
  it('POSTs to the Uncategorized folder and returns the new instance ids', async () => {
    discogsScope()
      .post('/users/testuser/collection/folders/1/releases/555')
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(201, { instance_id: 777, resource_url: '' });

    await expect(addReleaseToCollection(connection, 555)).resolves.toEqual({
      instanceId: 777,
      folderId: 1,
    });
  });

  it('maps a 404 (unknown release) to DiscogsNotFoundError', async () => {
    discogsScope()
      .post('/users/testuser/collection/folders/1/releases/999')
      .reply(404, { message: 'Release not found.' });

    await expect(addReleaseToCollection(connection, 999)).rejects.toBeInstanceOf(
      DiscogsNotFoundError,
    );
  });
});

describe('collectionClient: instance writes', () => {
  const ref = { folderId: 3, releaseId: 101, instanceId: 11 };

  it('deletes an instance from its folder', async () => {
    discogsScope()
      .delete('/users/testuser/collection/folders/3/releases/101/instances/11')
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(204);

    await expect(deleteInstance(connection, ref)).resolves.toBeUndefined();
  });

  it('maps a 404 on delete to DiscogsNotFoundError so callers can converge', async () => {
    discogsScope()
      .delete('/users/testuser/collection/folders/3/releases/101/instances/11')
      .reply(404, { message: 'Instance not found.' });

    await expect(deleteInstance(connection, ref)).rejects.toBeInstanceOf(
      DiscogsNotFoundError,
    );
  });

  it('sets the rating via the instance endpoint', async () => {
    discogsScope()
      .post('/users/testuser/collection/folders/3/releases/101/instances/11', {
        rating: 4,
      })
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(204);

    await expect(setRating(connection, ref, 4)).resolves.toBeUndefined();
  });

  it('sets a notes-field value via the fields endpoint', async () => {
    discogsScope()
      .post('/users/testuser/collection/folders/3/releases/101/instances/11/fields/2', {
        value: 'Generic',
      })
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(204);

    await expect(setFieldValue(connection, ref, 2, 'Generic')).resolves.toBeUndefined();
  });

  it('maps a 401 on a write to DiscogsAuthError', async () => {
    discogsScope()
      .post('/users/testuser/collection/folders/3/releases/101/instances/11', {
        rating: 2,
      })
      .reply(401, { message: 'You must authenticate.' });

    await expect(setRating(connection, ref, 2)).rejects.toBeInstanceOf(DiscogsAuthError);
  });
});

describe('collectionClient: shared preventive throttle with the catalog client (feature 040, US1, FR-004)', () => {
  const emptyFieldMap: CollectionFieldMap = {
    mediaConditionFieldId: null,
    sleeveConditionFieldId: null,
    notesFieldId: null,
  };

  function rawReleaseFor(id: number) {
    return {
      id,
      title: `Shared Throttle Release ${id}`,
      artists: [],
      labels: [],
      formats: [],
      genres: [],
      styles: [],
      tracklist: [],
      images: [],
      uri: `https://www.discogs.com/release/${id}`,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("draining the shared budget via the collection client delays the catalog client's next request", async () => {
    discogsScope()
      .get('/users/testuser/collection/folders/0/releases')
      .query(true)
      .reply(
        200,
        { pagination: { page: 1, pages: 1, per_page: 100, items: 0 }, releases: [] },
        { 'x-discogs-ratelimit': '60', 'x-discogs-ratelimit-remaining': '8' },
      );
    discogsScope().get('/releases/9101').reply(200, rawReleaseFor(9101));

    // Corrects the shared budget to remaining=8, at/below the
    // ceil(60*0.15)=9 safety threshold — via the collection client.
    await listAllInstances(connection, emptyFieldMap);

    let resolved = false;
    const catalogCall = getRelease({ type: 'vinylmania' }, 9101).then((release) => {
      resolved = true;
      return release;
    });

    await jest.advanceTimersByTimeAsync(MAX_WAIT_MS - 1);
    expect(resolved).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    const release = await catalogCall;

    expect(resolved).toBe(true);
    expect(release.discogsId).toBe(9101);
  });

  it("a catalog response correcting remaining back above the threshold un-throttles the collection client's next request", async () => {
    discogsScope()
      .get('/users/testuser/collection/folders/0/releases')
      .query(true)
      .reply(
        200,
        { pagination: { page: 1, pages: 1, per_page: 100, items: 0 }, releases: [] },
        { 'x-discogs-ratelimit': '60', 'x-discogs-ratelimit-remaining': '5' },
      );
    discogsScope()
      .get('/releases/9102')
      .reply(200, rawReleaseFor(9102), {
        'x-discogs-ratelimit': '60',
        'x-discogs-ratelimit-remaining': '50',
      });

    // Drops the shared budget low via the collection client, then
    // recordRateLimitHeaders() from the catalog client's own response
    // corrects it back up — read by the collection client next.
    await listAllInstances(connection, emptyFieldMap);
    const catalogPromise = getRelease({ type: 'vinylmania' }, 9102);
    await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);
    await catalogPromise;

    discogsScope()
      .get('/users/testuser/collection/folders/0/releases')
      .query(true)
      .reply(200, {
        pagination: { page: 1, pages: 1, per_page: 100, items: 0 },
        releases: [],
      });

    const before = Date.now();
    await listAllInstances(connection, emptyFieldMap);

    expect(Date.now() - before).toBe(0);
  });
});

describe('collectionClient: retry-with-backoff & circuit breaker parity (feature 040, US3)', () => {
  const emptyFieldMap: CollectionFieldMap = {
    mediaConditionFieldId: null,
    sleeveConditionFieldId: null,
    notesFieldId: null,
  };
  const ref = { folderId: 3, releaseId: 101, instanceId: 11 };

  describe('automatic retry on transient failures for safely-idempotent calls (FR-012)', () => {
    it('listAllInstances retries once on a 429 then succeeds', async () => {
      discogsScope()
        .get('/users/testuser/collection/folders/0/releases')
        .query(true)
        .reply(429, { message: 'too many requests' });
      discogsScope()
        .get('/users/testuser/collection/folders/0/releases')
        .query(true)
        .reply(200, {
          pagination: { page: 1, pages: 1, per_page: 100, items: 0 },
          releases: [],
        });

      await expect(listAllInstances(connection, emptyFieldMap)).resolves.toEqual([]);
    });

    it('getFieldMap retries once on a 500 then succeeds', async () => {
      discogsScope()
        .get('/users/testuser/collection/fields')
        .reply(500, { message: 'server error' });
      stubCollectionFields('testuser');

      await expect(getFieldMap(connection)).resolves.toEqual({
        mediaConditionFieldId: 1,
        sleeveConditionFieldId: 2,
        notesFieldId: 3,
      });
    });

    it('setRating retries once on a 429 then succeeds', async () => {
      discogsScope()
        .post('/users/testuser/collection/folders/3/releases/101/instances/11', {
          rating: 5,
        })
        .reply(429, { message: 'too many requests' });
      discogsScope()
        .post('/users/testuser/collection/folders/3/releases/101/instances/11', {
          rating: 5,
        })
        .reply(204);

      await expect(setRating(connection, ref, 5)).resolves.toBeUndefined();
    });

    it('setFieldValue retries once on a 5xx then succeeds', async () => {
      discogsScope()
        .post('/users/testuser/collection/folders/3/releases/101/instances/11/fields/2', {
          value: 'Mint',
        })
        .reply(503, { message: 'unavailable' });
      discogsScope()
        .post('/users/testuser/collection/folders/3/releases/101/instances/11/fields/2', {
          value: 'Mint',
        })
        .reply(204);

      await expect(setFieldValue(connection, ref, 2, 'Mint')).resolves.toBeUndefined();
    });

    it('deleteInstance retries once on a network failure then succeeds', async () => {
      discogsScope()
        .delete('/users/testuser/collection/folders/3/releases/101/instances/11')
        .replyWithError('socket hang up');
      discogsScope()
        .delete('/users/testuser/collection/folders/3/releases/101/instances/11')
        .reply(204);

      await expect(deleteInstance(connection, ref)).resolves.toBeUndefined();
    });

    it('exhausts all retries on a sustained failure and rejects with the same typed error as before (FR-012)', async () => {
      discogsScope()
        .post('/users/testuser/collection/folders/3/releases/101/instances/11', {
          rating: 1,
        })
        .times(MAX_ATTEMPTS)
        .reply(500, { message: 'server error' });

      await expect(setRating(connection, ref, 1)).rejects.toBeInstanceOf(
        DiscogsUnavailableError,
      );
    }, 8_000);
  });

  describe('non-transient failures never retry, unchanged from today (FR-013)', () => {
    it('a 404 on deleteInstance fails after exactly one call', async () => {
      const scope = discogsScope()
        .delete('/users/testuser/collection/folders/3/releases/101/instances/11')
        .reply(404, { message: 'Instance not found.' });

      await expect(deleteInstance(connection, ref)).rejects.toBeInstanceOf(
        DiscogsNotFoundError,
      );
      expect(scope.isDone()).toBe(true);
    });

    it('a 401 on setRating fails after exactly one call', async () => {
      const scope = discogsScope()
        .post('/users/testuser/collection/folders/3/releases/101/instances/11', {
          rating: 2,
        })
        .reply(401, { message: 'You must authenticate.' });

      await expect(setRating(connection, ref, 2)).rejects.toBeInstanceOf(DiscogsAuthError);
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('addReleaseToCollection is retry-exempt even though it is circuit-breaker-eligible (FR-016)', () => {
    it('fails immediately on a 429 with a single attempt — no retry', async () => {
      const scope = discogsScope()
        .post('/users/testuser/collection/folders/1/releases/555')
        .reply(429, { message: 'too many requests' });

      await expect(addReleaseToCollection(connection, 555)).rejects.toBeInstanceOf(
        DiscogsRateLimitError,
      );
      expect(scope.isDone()).toBe(true);
    });

    it('fails immediately on a 5xx with a single attempt — no retry', async () => {
      const scope = discogsScope()
        .post('/users/testuser/collection/folders/1/releases/556')
        .reply(503, { message: 'unavailable' });

      await expect(addReleaseToCollection(connection, 556)).rejects.toBeInstanceOf(
        DiscogsUnavailableError,
      );
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('shared circuit breaker across the catalog and collection clients (FR-014)', () => {
    it('opens from exhausted collection-client failures and short-circuits a subsequent catalog request', async () => {
      for (let i = 0; i < 5; i += 1) {
        discogsScope()
          .get('/users/testuser/collection/releases/9200')
          .times(MAX_ATTEMPTS)
          .reply(500, { message: 'server error' });
        await expect(
          getInstancesForRelease(connection, 9200, emptyFieldMap),
        ).rejects.toBeInstanceOf(DiscogsUnavailableError);
      }

      // No nock interceptor registered for this release — if the shared
      // breaker did not short-circuit, the outbound call would still
      // reject with the same error type via exhausted network-error
      // retries against nock's "no match" guard, which would make this
      // assertion a false positive. The circuit_open log line is the only
      // way to distinguish a real short-circuit from that coincidence.
      const warnSpy = jest.spyOn(logger, 'warn');
      await expect(getRelease({ type: 'vinylmania' }, 9299)).rejects.toBeInstanceOf(DiscogsUnavailableError);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'circuit_open' }),
      );
    }, 20_000);

    it('opens from exhausted catalog-client failures and short-circuits a subsequent collection request', async () => {
      for (let i = 0; i < 5; i += 1) {
        const id = 9300 + i;
        discogsScope().get(`/releases/${id}`).times(MAX_ATTEMPTS).reply(500, {
          message: 'server error',
        });
        await expect(getRelease({ type: 'vinylmania' }, id)).rejects.toBeInstanceOf(DiscogsUnavailableError);
      }

      // Same "circuit_open log line is the only real proof" reasoning as
      // above, from the other client.
      const warnSpy = jest.spyOn(logger, 'warn');
      await expect(
        getInstancesForRelease(connection, 9399, emptyFieldMap),
      ).rejects.toBeInstanceOf(DiscogsUnavailableError);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'circuit_open' }),
      );
    }, 20_000);
  });
});

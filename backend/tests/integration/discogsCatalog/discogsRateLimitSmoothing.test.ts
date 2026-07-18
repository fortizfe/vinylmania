import RedisMock from 'ioredis-mock';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

import { discogsScope } from '../../helpers/nock';

import {
  addReleaseToCollection,
  listAllInstances,
} from '../../../src/adapters/discogsOauth/discogsCollectionAdapter';
import type { CollectionFieldMap } from '../../../src/domain/discogsOauth/collectionTypes';
import { cacheAdapter } from '../../../src/adapters/cache/cacheAdapter';
import {
  discogsCatalogAdapter,
  getDiscogsHttpClient,
  getRelease,
} from '../../../src/adapters/discogsCatalog/discogsCatalogAdapter';
import { createSearchCatalogWithRatingsUseCase } from '../../../src/application/discogsCatalog/searchCatalogWithRatings';
import { DiscogsRateLimitError } from '../../../src/discogs/discogsErrors';
import { MAX_WAIT_MS } from '../../../src/discogs/discogsRateLimiter';
import type { CatalogCredential } from '../../../src/domain/discogsCatalog/types';
import type { DiscogsConnection } from '../../../src/domain/discogsOauth/types';

const CREDENTIAL: CatalogCredential = { type: 'vinylmania' };

const { searchCatalogWithRatings } = createSearchCatalogWithRatingsUseCase({
  discogsCatalog: discogsCatalogAdapter,
  cache: cacheAdapter,
});

/**
 * End-to-end coverage of feature 040's User Story 1 (preventive throttle) —
 * spec.md Acceptance Scenarios 1-6. Exercises the real `discogsClient.ts`/
 * `collectionClient.ts` modules against a `nock`-stubbed Discogs host, the
 * same pattern as `discogsCaching.test.ts` — no Firebase emulator or HTTP
 * route layer needed, since this feature adds no new REST endpoint.
 */

const connection: DiscogsConnection = {
  uid: 'throttle-test-user',
  discogsUsername: 'throttleuser',
  discogsUserId: 99,
  accessToken: 'access-token',
  accessTokenSecret: 'access-secret',
  linkedAt: '2026-07-01T00:00:00.000Z',
};

const emptyFieldMap: CollectionFieldMap = {
  mediaConditionFieldId: null,
  sleeveConditionFieldId: null,
  notesFieldId: null,
};

function rawReleaseFor(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Smoothing Release ${id}`,
    artists: [],
    labels: [],
    formats: [],
    genres: [],
    styles: [],
    tracklist: [],
    images: [],
    uri: `https://www.discogs.com/release/${id}`,
    ...overrides,
  };
}

function emptyCollectionPage(remaining?: string) {
  const headers = remaining
    ? { 'x-discogs-ratelimit': '60', 'x-discogs-ratelimit-remaining': remaining }
    : undefined;
  return [
    { pagination: { page: 1, pages: 1, per_page: 100, items: 0 }, releases: [] },
    headers,
  ] as const;
}

// getRedisClient() memoizes its result on first call (see redisClient.ts),
// so REDIS_URL must be set before any test in this file makes its first
// withCache() call (matches discogsRetryResilience.test.ts's precedent) —
// needed so the US2 warm-cache scenario below can observe a real cache hit.
// Every release ID / search query used across this file's tests is unique,
// so enabling caching never lets one test observe another's cached data.
const originalRedisUrl = process.env.REDIS_URL;

beforeAll(() => {
  process.env.REDIS_URL = 'redis://localhost:6379/0';
});

afterAll(() => {
  process.env.REDIS_URL = originalRedisUrl;
});

describe('Discogs rate-limit smoothing — User Story 1 (preventive throttle)', () => {
  describe('Acceptance Scenarios 1-2: a burst of requests spaces itself out, without depending on a 429', () => {
    it('stays unthrottled while the budget is ample, then spaces requests out once the known remaining budget crosses the safety threshold', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
      try {
        // A "burst": several requests in a row, each response reporting a
        // shrinking budget — never a 429 anywhere in this stub sequence.
        discogsScope()
          .get('/releases/1001')
          .reply(200, rawReleaseFor(1001), {
            'x-discogs-ratelimit': '60',
            'x-discogs-ratelimit-remaining': '30',
          });
        discogsScope()
          .get('/releases/1002')
          .reply(200, rawReleaseFor(1002), {
            'x-discogs-ratelimit': '60',
            'x-discogs-ratelimit-remaining': '9',
          });
        discogsScope()
          .get('/releases/1003')
          .reply(200, rawReleaseFor(1003), {
            'x-discogs-ratelimit': '60',
            'x-discogs-ratelimit-remaining': '8',
          });

        // Well above the threshold (ceil(60*0.15)=9) — no delay.
        const beforeFirst = Date.now();
        await getRelease({ type: 'vinylmania' }, 1001);
        expect(Date.now() - beforeFirst).toBe(0);

        // Crosses exactly to the threshold — still no delay for *this*
        // request (the correction from its own response arrives after it
        // was sent), but the next one now observes remaining=9.
        await getRelease({ type: 'vinylmania' }, 1002);

        // Now at/below the threshold: the third request must be spaced out.
        let thirdResolved = false;
        const thirdCall = getRelease({ type: 'vinylmania' }, 1003).then((release) => {
          thirdResolved = true;
          return release;
        });

        await jest.advanceTimersByTimeAsync(MAX_WAIT_MS - 1);
        expect(thirdResolved).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        await thirdCall;
        expect(thirdResolved).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('Acceptance Scenario 3: minimum-necessary delay, capped at MAX_WAIT_MS', () => {
    it('applies zero delay while the budget is ample', async () => {
      const scope = discogsScope()
        .get('/releases/1010')
        .reply(200, rawReleaseFor(1010), {
          'x-discogs-ratelimit': '60',
          'x-discogs-ratelimit-remaining': '45',
        });

      const before = Date.now();
      await getRelease({ type: 'vinylmania' }, 1010);

      // No fake timers here (real request/response round trip) — assert
      // "no throttle delay was added" as "well under MAX_WAIT_MS", not an
      // exact 0ms, since real I/O has its own small, unrelated latency.
      expect(Date.now() - before).toBeLessThan(100);
      expect(scope.isDone()).toBe(true);
    });

    it('never holds a request past MAX_WAIT_MS even far under the threshold — it is sent anyway', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
      try {
        discogsScope()
          .get('/releases/1011')
          .reply(200, rawReleaseFor(1011), {
            'x-discogs-ratelimit': '60',
            'x-discogs-ratelimit-remaining': '1',
          });
        discogsScope()
          .get('/releases/1012')
          .reply(200, rawReleaseFor(1012), {
            'x-discogs-ratelimit': '60',
            'x-discogs-ratelimit-remaining': '1',
          });

        await getRelease({ type: 'vinylmania' }, 1011);

        const before = Date.now();
        const secondCall = getRelease({ type: 'vinylmania' }, 1012);
        await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);
        await secondCall;

        expect(Date.now() - before).toBeLessThanOrEqual(MAX_WAIT_MS);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('Acceptance Scenario 4: the catalog and collection clients share one budget/counter', () => {
    it('a low-budget correction from the collection client delays the catalog client, and vice versa', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
      try {
        const [collectionBody, collectionHeaders] = emptyCollectionPage('7');
        discogsScope()
          .get('/users/throttleuser/collection/folders/0/releases')
          .query(true)
          .reply(200, collectionBody, collectionHeaders);
        discogsScope().get('/releases/1020').reply(200, rawReleaseFor(1020));

        await listAllInstances(connection, emptyFieldMap);

        let resolved = false;
        const catalogCall = getRelease({ type: 'vinylmania' }, 1020).then((release) => {
          resolved = true;
          return release;
        });

        await jest.advanceTimersByTimeAsync(MAX_WAIT_MS - 1);
        expect(resolved).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        await catalogCall;
        expect(resolved).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('Acceptance Scenario 5: the existing retry/circuit-breaker safety net still applies unchanged', () => {
    it('retries a 429 that slips through and still succeeds, exactly as feature 029 established', async () => {
      discogsScope().get('/releases/1030').reply(429, { message: 'too many requests' });
      discogsScope().get('/releases/1030').reply(200, rawReleaseFor(1030));

      const release = await getRelease({ type: 'vinylmania' }, 1030);

      expect(release.discogsId).toBe(1030);
    }, 8_000);
  });

  describe('Acceptance Scenario 6: the OAuth collection client is now covered by the same preventive throttle', () => {
    it('spaces out the collection client’s own next request once its budget drops to/below the threshold', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
      try {
        const [firstBody, firstHeaders] = emptyCollectionPage('6');
        discogsScope()
          .get('/users/throttleuser/collection/folders/0/releases')
          .query(true)
          .reply(200, firstBody, firstHeaders);
        const [secondBody] = emptyCollectionPage();
        discogsScope()
          .get('/users/throttleuser/collection/folders/0/releases')
          .query(true)
          .reply(200, secondBody);

        await listAllInstances(connection, emptyFieldMap);

        let resolved = false;
        const secondCall = listAllInstances(connection, emptyFieldMap).then((result) => {
          resolved = true;
          return result;
        });

        await jest.advanceTimersByTimeAsync(MAX_WAIT_MS - 1);
        expect(resolved).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        await secondCall;
        expect(resolved).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});

describe('Discogs rate-limit smoothing — User Story 2 (bounded search-rating concurrency)', () => {
  function rawEligibleResult(id: number) {
    return {
      id,
      type: 'release' as const,
      title: `Smoothing Search Result ${id}`,
      thumb: '',
      cover_image: '',
      year: '2000',
      format: ['Vinyl'],
    };
  }

  /** Same in-flight-counting technique as discogsClient.contract.test.ts's concurrency spy. */
  function spyOnInFlightRequests(): { getMaxInFlight: () => number; restore: () => void } {
    const client = getDiscogsHttpClient();
    let inFlight = 0;
    let maxInFlight = 0;
    const originalGet = client.get.bind(client);
    const spy = jest
      .spyOn(client, 'get')
      .mockImplementation(async (...args: Parameters<typeof originalGet>) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        try {
          await new Promise((resolve) => {
            setTimeout(resolve, 20);
          });
          return await originalGet(...args);
        } finally {
          inFlight -= 1;
        }
      });
    return { getMaxInFlight: () => maxInFlight, restore: () => spy.mockRestore() };
  }

  describe('Acceptance Scenario 1-2: a cold-cache search bounds concurrency and still completes fast', () => {
    it('never has more than 5 rating lookups in flight for a page of 9 eligible results, and completes quickly', async () => {
      const eligibleCount = 9;
      discogsScope()
        .get('/database/search')
        .query({ q: 'US2 Smoothing Bounded', page: '1', per_page: '50' })
        .reply(200, {
          pagination: { page: 1, pages: 1, items: eligibleCount, per_page: 50 },
          results: Array.from({ length: eligibleCount }, (_, i) => rawEligibleResult(5000 + i)),
        });
      for (let i = 0; i < eligibleCount; i += 1) {
        discogsScope()
          .get(`/releases/${5000 + i}/rating`)
          .reply(200, { release_id: 5000 + i, rating: { average: 4, count: 10 } });
      }

      const { getMaxInFlight, restore } = spyOnInFlightRequests();
      const before = Date.now();
      try {
        const result = await searchCatalogWithRatings(CREDENTIAL, 'US2 Smoothing Bounded', { resultType: 'release' });

        expect(result.results).toHaveLength(eligibleCount);
        expect(getMaxInFlight()).toBeLessThanOrEqual(5);
        // 9 items at 5-wide concurrency = 2 waves of ~20ms each; "feels
        // fast" is asserted generously (well under 1s) to avoid flakiness.
        expect(Date.now() - before).toBeLessThan(1_000);
      } finally {
        restore();
      }
    }, 10_000);
  });

  describe('Acceptance Scenario 3: a warm-cache search is unaffected by the concurrency limit', () => {
    it('serves an identical second search from cache, triggering zero new Discogs calls', async () => {
      const scope = discogsScope()
        .get('/database/search')
        .query({ q: 'US2 Smoothing Warm Cache', page: '1', per_page: '50' })
        .reply(200, {
          pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
          results: [rawEligibleResult(5100)],
        });
      discogsScope()
        .get('/releases/5100/rating')
        .reply(200, { release_id: 5100, rating: { average: 4.2, count: 20 } });

      const first = await searchCatalogWithRatings(CREDENTIAL, 'US2 Smoothing Warm Cache', { resultType: 'release' });
      // Only the interceptors above are registered (nock.cleanAll() runs
      // afterEach) — a second real HTTP call here would hit no matching
      // interceptor and reject, so an equal second result proves the
      // cache (not a second Discogs round trip) served it.
      const second = await searchCatalogWithRatings(CREDENTIAL, 'US2 Smoothing Warm Cache', { resultType: 'release' });

      expect(second).toEqual(first);
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('Acceptance Scenario 4: fail-soft rating omission is preserved exactly under the new concurrency limit', () => {
    it('omits communityRating only for the failed lookup among a bounded-concurrency batch', async () => {
      const eligibleCount = 6;
      discogsScope()
        .get('/database/search')
        .query({ q: 'US2 Smoothing Fail Soft', page: '1', per_page: '50' })
        .reply(200, {
          pagination: { page: 1, pages: 1, items: eligibleCount, per_page: 50 },
          results: Array.from({ length: eligibleCount }, (_, i) => rawEligibleResult(5200 + i)),
        });
      discogsScope().get('/releases/5200/rating').reply(503, { message: 'unavailable' });
      for (let i = 1; i < eligibleCount; i += 1) {
        discogsScope()
          .get(`/releases/${5200 + i}/rating`)
          .reply(200, { release_id: 5200 + i, rating: { average: 4, count: 10 } });
      }

      const result = await searchCatalogWithRatings(CREDENTIAL, 'US2 Smoothing Fail Soft', { resultType: 'release' });

      expect(result.results).toHaveLength(eligibleCount);
      const failed = result.results.find((r) => r.discogsId === 5200);
      expect(failed?.communityRating).toBeUndefined();
      expect(
        result.results.filter((r) => r.discogsId !== 5200).every((r) => r.communityRating),
      ).toBe(true);
    });
  });
});

describe('Discogs rate-limit smoothing — User Story 3 (collection client resilience parity)', () => {
  describe('Acceptance Scenario 1: a library-sync page retries transparently past one transient failure', () => {
    it('listAllInstances recovers from a single transient 429 mid-sync and returns the full page', async () => {
      discogsScope()
        .get('/users/throttleuser/collection/folders/0/releases')
        .query(true)
        .reply(429, { message: 'too many requests' });
      discogsScope()
        .get('/users/throttleuser/collection/folders/0/releases')
        .query(true)
        .reply(200, {
          pagination: { page: 1, pages: 1, per_page: 100, items: 0 },
          releases: [],
        });

      await expect(listAllInstances(connection, emptyFieldMap)).resolves.toEqual([]);
    });
  });

  describe('Acceptance Scenario 6: addReleaseToCollection surfaces a 429 immediately, with no retry attempt', () => {
    it('rejects with DiscogsRateLimitError after exactly one call — no retry sequence', async () => {
      const scope = discogsScope()
        .post('/users/throttleuser/collection/folders/1/releases/6001')
        .reply(429, { message: 'too many requests' });

      await expect(addReleaseToCollection(connection, 6001)).rejects.toBeInstanceOf(
        DiscogsRateLimitError,
      );
      // Only one nock interceptor was ever registered for this path — a
      // retry attempt would have hit nock's "no match" guard instead of
      // resolving to this same rejection, so isDone() alone confirms
      // exactly one outbound call was made.
      expect(scope.isDone()).toBe(true);
    });
  });
});

import { discogsScope } from '../../helpers/nock';

import {
  deleteWant,
  getWant,
  listWants,
  putWant,
} from '../../../src/adapters/discogsOauth/discogsWantlistAdapter';
import * as rateLimiter from '../../../src/discogs/discogsRateLimiter';
import { logger } from '../../../src/config/logger';
import {
  DiscogsAuthError,
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../../src/discogs/discogsErrors';
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
  delete process.env.REDIS_URL;
});

const OAUTH_TOKEN_HEADER = /oauth_token="access-token"/;

interface RawWantOverrides {
  rating?: number;
  notes?: string;
  dateAdded?: string;
  title?: string;
  year?: number;
  thumb?: string;
}

/** Builds a raw want as returned by Discogs' `GET /users/{username}/wants`. */
function rawWant(releaseId: number, overrides: RawWantOverrides = {}) {
  return {
    id: releaseId,
    rating: overrides.rating ?? 0,
    notes: overrides.notes ?? '',
    date_added: overrides.dateAdded ?? '2025-08-01T12:00:00-07:00',
    basic_information: {
      id: releaseId,
      title: overrides.title ?? `Release ${releaseId}`,
      year: overrides.year ?? 1979,
      artists: [{ name: 'The Artist' }],
      thumb: overrides.thumb ?? `https://img/${releaseId}.jpg`,
    },
  };
}

function stubWantsPage(
  wants: ReturnType<typeof rawWant>[],
  { page = 1, pages = 1 }: { page?: number; pages?: number } = {},
) {
  return discogsScope()
    .get('/users/testuser/wants')
    .query((query) => Number(query.page ?? 1) === page)
    .matchHeader('authorization', OAUTH_TOKEN_HEADER)
    .reply(200, {
      pagination: { page, pages, per_page: 100, items: wants.length },
      wants,
    });
}

describe('wantlistClient: listWants', () => {
  it('walks every page and returns every want, mapWant-normalized', async () => {
    stubWantsPage(
      [
        rawWant(101, {
          rating: 4,
          notes: 'Original pressing only',
          dateAdded: '2025-08-01T12:00:00-07:00',
        }),
      ],
      { page: 1, pages: 2 },
    );
    stubWantsPage([rawWant(202, { rating: 0, notes: '' })], { page: 2, pages: 2 });

    const wants = await listWants(connection);

    expect(wants).toHaveLength(2);
    expect(wants[0]).toEqual({
      releaseId: 101,
      rating: 4,
      notes: 'Original pressing only',
      dateAdded: '2025-08-01T12:00:00-07:00',
      basicInformation: {
        title: 'Release 101',
        year: 1979,
        artists: [{ name: 'The Artist' }],
        thumb: 'https://img/101.jpg',
      },
    });
    expect(wants[1]).toMatchObject({ releaseId: 202, rating: 0, notes: null });
  });

  it('returns [] for an empty wantlist (not an error)', async () => {
    stubWantsPage([], { page: 1, pages: 1 });

    await expect(listWants(connection)).resolves.toEqual([]);
  });
});

describe('wantlistClient: getWant', () => {
  // Discogs has no single-want GET; `getWant` is derived from the `/wants`
  // list (contracts/discogs-wantlist-client.md, contract test #3).
  it('returns the mapped WantItem when the release is among the caller wants', async () => {
    stubWantsPage([
      rawWant(55),
      rawWant(101, { rating: 3, notes: 'VG+ or better' }),
    ]);

    await expect(getWant(connection, 101)).resolves.toMatchObject({
      releaseId: 101,
      rating: 3,
      notes: 'VG+ or better',
    });
  });

  it('resolves null when the release is not among the caller wants', async () => {
    stubWantsPage([rawWant(55), rawWant(202)]);

    await expect(getWant(connection, 999)).resolves.toBeNull();
  });
});

describe('wantlistClient: putWant', () => {
  it('sends only the rating when only a rating is provided', async () => {
    const scope = discogsScope()
      .put('/users/testuser/wants/101', { rating: 5 })
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(200, rawWant(101, { rating: 5, notes: 'left as-is' }));

    await expect(putWant(connection, 101, { rating: 5 })).resolves.toMatchObject({
      releaseId: 101,
      rating: 5,
      notes: 'left as-is',
    });
    expect(scope.isDone()).toBe(true);
  });

  it('sends only the notes when only notes are provided', async () => {
    const scope = discogsScope()
      .put('/users/testuser/wants/101', { notes: 'Repress is fine' })
      .reply(200, rawWant(101, { rating: 2, notes: 'Repress is fine' }));

    await expect(
      putWant(connection, 101, { notes: 'Repress is fine' }),
    ).resolves.toMatchObject({ rating: 2, notes: 'Repress is fine' });
    expect(scope.isDone()).toBe(true);
  });

  it('creates the want when the release is not yet in the wantlist (upsert)', async () => {
    discogsScope()
      .put('/users/testuser/wants/303', {})
      .reply(201, rawWant(303, { rating: 0, notes: '' }));

    await expect(putWant(connection, 303, {})).resolves.toMatchObject({
      releaseId: 303,
      rating: 0,
      notes: null,
    });
  });
});

describe('wantlistClient: deleteWant', () => {
  it('resolves on 204', async () => {
    discogsScope()
      .delete('/users/testuser/wants/101')
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(204);

    await expect(deleteWant(connection, 101)).resolves.toBeUndefined();
  });

  it('throws DiscogsNotFoundError when the release is not a want (404)', async () => {
    discogsScope()
      .delete('/users/testuser/wants/999')
      .reply(404, { message: 'Release not found in wantlist.' });

    await expect(deleteWant(connection, 999)).rejects.toBeInstanceOf(
      DiscogsNotFoundError,
    );
  });
});

describe('wantlistClient: revoked link (401)', () => {
  it('maps a 401 to DiscogsAuthError on every method', async () => {
    discogsScope()
      .get('/users/testuser/wants')
      .query(true)
      .reply(401, { message: 'auth' });
    await expect(listWants(connection)).rejects.toBeInstanceOf(DiscogsAuthError);

    discogsScope()
      .get('/users/testuser/wants')
      .query(true)
      .reply(401, { message: 'auth' });
    await expect(getWant(connection, 101)).rejects.toBeInstanceOf(DiscogsAuthError);

    discogsScope().put('/users/testuser/wants/101').reply(403, { message: 'auth' });
    await expect(putWant(connection, 101, { rating: 1 })).rejects.toBeInstanceOf(
      DiscogsAuthError,
    );

    discogsScope().delete('/users/testuser/wants/101').reply(401, { message: 'auth' });
    await expect(deleteWant(connection, 101)).rejects.toBeInstanceOf(DiscogsAuthError);
  });
});

describe('wantlistClient: rate limiting & retry', () => {
  it('exhausts retries on a sustained 429 and maps to DiscogsRateLimitError', async () => {
    discogsScope()
      .get('/users/testuser/wants')
      .query(true)
      .times(MAX_ATTEMPTS)
      .reply(429, { message: 'Too many requests' });

    await expect(listWants(connection)).rejects.toBeInstanceOf(DiscogsRateLimitError);
  }, 8_000);

  it('does not auto-retry writes (__skipRetry) but a 5xx still trips the shared breaker', async () => {
    // Each write is a single attempt — five exhausted failures open the breaker.
    for (let i = 0; i < 5; i += 1) {
      const scope = discogsScope()
        .put(`/users/testuser/wants/${500 + i}`)
        .reply(503, { message: 'unavailable' });
      await expect(putWant(connection, 500 + i, { rating: 1 })).rejects.toBeInstanceOf(
        DiscogsUnavailableError,
      );
      expect(scope.isDone()).toBe(true);
    }

    // No interceptor for this release — a real short-circuit is the only way
    // this rejects, proven by the circuit_open log line.
    const warnSpy = jest.spyOn(logger, 'warn');
    await expect(deleteWant(connection, 4242)).rejects.toBeInstanceOf(
      DiscogsUnavailableError,
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'circuit_open' }),
    );
  }, 20_000);

  it('calls recordRateLimitHeaders on both success and error responses', async () => {
    const spy = jest.spyOn(rateLimiter, 'recordRateLimitHeaders');

    stubWantsPage([], { page: 1, pages: 1 });
    await listWants(connection);
    expect(spy).toHaveBeenCalled();

    spy.mockClear();
    discogsScope()
      .get('/users/testuser/wants')
      .query(true)
      .times(MAX_ATTEMPTS)
      .reply(500, { message: 'boom' });
    await expect(listWants(connection)).rejects.toBeInstanceOf(DiscogsUnavailableError);
    expect(spy).toHaveBeenCalled();
  }, 8_000);
});

import { discogsScope } from '../../helpers/nock';

import { discogsMarketplaceAdapter } from '../../../src/adapters/discogsOauth/discogsMarketplaceAdapter';
import * as rateLimiter from '../../../src/discogs/discogsRateLimiter';
import * as circuitBreaker from '../../../src/discogs/discogsCircuitBreaker';
import { logger } from '../../../src/config/logger';
import {
  DiscogsAuthError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../../src/discogs/discogsErrors';
import { MAX_ATTEMPTS } from '../../../src/discogs/discogsRetry';
import { SellerSettingsRequiredError } from '../../../src/domain/collectionStats/statsErrors';
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

afterEach(() => {
  jest.restoreAllMocks();
});

const OAUTH_TOKEN_HEADER = /oauth_token="access-token"/;

const PRICE_MAP = {
  'Very Good (VG)': { currency: 'EUR', value: 4.95 },
  'Near Mint (NM or M-)': { currency: 'EUR', value: 12.4 },
  'Mint (M)': { currency: 'EUR', value: 15 },
};

function path(releaseId: number): string {
  return `/marketplace/price_suggestions/${releaseId}`;
}

describe('marketplaceClient: getPriceSuggestions', () => {
  it('returns the per-grade map as-is on 200, with a signed request', async () => {
    discogsScope()
      .get(path(100))
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(200, PRICE_MAP);

    await expect(
      discogsMarketplaceAdapter.getPriceSuggestions(connection, 100),
    ).resolves.toEqual(PRICE_MAP);
  });

  it('maps an empty 200 body to null (no market data)', async () => {
    discogsScope().get(path(101)).reply(200, {});
    await expect(
      discogsMarketplaceAdapter.getPriceSuggestions(connection, 101),
    ).resolves.toBeNull();
  });

  it('maps a 404 to null (no market data)', async () => {
    discogsScope().get(path(102)).reply(404, { message: 'not found' });
    await expect(
      discogsMarketplaceAdapter.getPriceSuggestions(connection, 102),
    ).resolves.toBeNull();
  });

  it('maps a 403 to SellerSettingsRequiredError', async () => {
    discogsScope()
      .get(path(103))
      .reply(403, { message: 'You must have seller settings enabled.' });
    await expect(
      discogsMarketplaceAdapter.getPriceSuggestions(connection, 103),
    ).rejects.toBeInstanceOf(SellerSettingsRequiredError);
  });

  it('maps a 401 to DiscogsAuthError', async () => {
    discogsScope().get(path(104)).reply(401, { message: 'You must authenticate.' });
    await expect(
      discogsMarketplaceAdapter.getPriceSuggestions(connection, 104),
    ).rejects.toBeInstanceOf(DiscogsAuthError);
  });

  it('is retry-eligible: retries once on a 429 then succeeds', async () => {
    discogsScope().get(path(105)).reply(429, { message: 'too many requests' });
    discogsScope().get(path(105)).reply(200, PRICE_MAP);

    await expect(
      discogsMarketplaceAdapter.getPriceSuggestions(connection, 105),
    ).resolves.toEqual(PRICE_MAP);
  });

  it('exhausts retries on a sustained 429 and maps to DiscogsRateLimitError', async () => {
    discogsScope()
      .get(path(106))
      .times(MAX_ATTEMPTS)
      .reply(429, { message: 'too many requests' });

    await expect(
      discogsMarketplaceAdapter.getPriceSuggestions(connection, 106),
    ).rejects.toBeInstanceOf(DiscogsRateLimitError);
  }, 8_000);

  it('exhausts retries on a sustained 5xx and maps to DiscogsUnavailableError', async () => {
    discogsScope()
      .get(path(107))
      .times(MAX_ATTEMPTS)
      .reply(503, { message: 'unavailable' });

    await expect(
      discogsMarketplaceAdapter.getPriceSuggestions(connection, 107),
    ).rejects.toBeInstanceOf(DiscogsUnavailableError);
  }, 8_000);

  it('maps a sustained network failure to DiscogsUnavailableError', async () => {
    discogsScope().get(path(108)).times(MAX_ATTEMPTS).replyWithError('socket hang up');

    await expect(
      discogsMarketplaceAdapter.getPriceSuggestions(connection, 108),
    ).rejects.toBeInstanceOf(DiscogsUnavailableError);
  }, 8_000);

  it('short-circuits via the shared breaker when it is open', async () => {
    jest.spyOn(circuitBreaker, 'shouldShortCircuit').mockReturnValue(true);
    const warnSpy = jest.spyOn(logger, 'warn');

    await expect(
      discogsMarketplaceAdapter.getPriceSuggestions(connection, 109),
    ).rejects.toBeInstanceOf(DiscogsUnavailableError);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'circuit_open' }),
    );
  });

  it('FR-021: an open shared breaker fails fast — no HTTP, no throttle slot taken', async () => {
    // Spying the SAME module-level singletons the catalog/collection clients
    // consult proves the marketplace client shares the one per-IP Discogs
    // budget + breaker (FR-021, SC-006) — there is no parallel request path.
    const shortCircuitSpy = jest
      .spyOn(circuitBreaker, 'shouldShortCircuit')
      .mockReturnValue(true);
    const slotSpy = jest.spyOn(rateLimiter, 'acquireSlot');

    const scope = discogsScope().get(path(112)).reply(200, PRICE_MAP);

    await expect(
      discogsMarketplaceAdapter.getPriceSuggestions(connection, 112),
    ).rejects.toBeInstanceOf(DiscogsUnavailableError);

    expect(shortCircuitSpy).toHaveBeenCalled();
    // Breaker checked before the throttle and before any socket is opened.
    expect(slotSpy).not.toHaveBeenCalled();
    expect(scope.isDone()).toBe(false);
    expect(scope.pendingMocks()).toHaveLength(1);
    // helpers/nock.ts `afterEach` clears the unconsumed interceptor.
  });

  it('FR-021: a success feeds the shared breaker + rate-limit recorders', async () => {
    // `recordSuccess` / `recordRateLimitHeaders` are the shared singletons'
    // write side — a marketplace success updates the same state a catalog or
    // collection success would.
    const recordSuccessSpy = jest.spyOn(circuitBreaker, 'recordSuccess');
    const recordHeadersSpy = jest.spyOn(rateLimiter, 'recordRateLimitHeaders');
    const slotSpy = jest.spyOn(rateLimiter, 'acquireSlot');

    discogsScope().get(path(113)).reply(200, PRICE_MAP);
    await discogsMarketplaceAdapter.getPriceSuggestions(connection, 113);

    expect(slotSpy).toHaveBeenCalled();
    expect(recordSuccessSpy).toHaveBeenCalled();
    expect(recordHeadersSpy).toHaveBeenCalled();
  });

  it('records rate-limit headers and a success on 200', async () => {
    const headerSpy = jest.spyOn(rateLimiter, 'recordRateLimitHeaders');
    const successSpy = jest.spyOn(circuitBreaker, 'recordSuccess');

    discogsScope()
      .get(path(110))
      .reply(200, PRICE_MAP, {
        'x-discogs-ratelimit': '60',
        'x-discogs-ratelimit-remaining': '59',
      });

    await discogsMarketplaceAdapter.getPriceSuggestions(connection, 110);

    expect(headerSpy).toHaveBeenCalled();
    expect(successSpy).toHaveBeenCalled();
  });

  it('acquires a throttle slot on every attempt', async () => {
    const slotSpy = jest.spyOn(rateLimiter, 'acquireSlot');

    discogsScope().get(path(111)).reply(429, { message: 'slow down' });
    discogsScope().get(path(111)).reply(200, PRICE_MAP);

    await discogsMarketplaceAdapter.getPriceSuggestions(connection, 111);

    // one per attempt (original + one retry)
    expect(slotSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

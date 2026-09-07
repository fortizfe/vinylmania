import nock from 'nock';

import {
  __resetItunesThrottleForTests,
  itunesSearchAdapter,
} from '../../../src/adapters/streaming/itunesSearchAdapter';
import { logger } from '../../../src/config/logger';
import {
  StreamingRateLimitedError,
  StreamingUnavailableError,
} from '../../../src/domain/streaming/streamingErrors';
import type { StreamingLinkQuery } from '../../../src/domain/streaming/types';

const ITUNES_BASE_URL = 'https://itunes.test';
const COLLECTION_VIEW_URL =
  'https://music.apple.com/es/album/master-of-puppets/1440899482';

function query(overrides: Partial<StreamingLinkQuery> = {}): StreamingLinkQuery {
  return {
    barcodes: [],
    artist: 'Metallica',
    title: 'Master of Puppets',
    storefront: 'ES',
    ...overrides,
  };
}

function albumResult(overrides: Record<string, unknown> = {}) {
  return {
    wrapperType: 'collection',
    collectionType: 'Album',
    artistName: 'Metallica',
    collectionName: 'Master of Puppets',
    collectionViewUrl: COLLECTION_VIEW_URL,
    ...overrides,
  };
}

describe('itunesSearchAdapter (integration, nock)', () => {
  const originalBaseUrl = process.env.ITUNES_SEARCH_BASE_URL;

  beforeAll(() => {
    process.env.ITUNES_SEARCH_BASE_URL = ITUNES_BASE_URL;
    nock.disableNetConnect();
  });

  afterAll(() => {
    process.env.ITUNES_SEARCH_BASE_URL = originalBaseUrl;
    nock.enableNetConnect();
  });

  beforeEach(() => {
    // Each test starts from a cold throttle so the module-level minimum-interval
    // state from a prior test never injects an unexpected wait or rejection.
    __resetItunesThrottleForTests();
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    // Clears any still-pending delayed response (the timeout test) so its
    // timer does not outlive the test and leak as an open handle.
    nock.abortPendingRequests();
    nock.cleanAll();
    jest.restoreAllMocks();
  });

  it('returns an Apple Music link from a UPC lookup hit', async () => {
    nock(ITUNES_BASE_URL)
      .get('/lookup')
      .query(true)
      .reply(200, { resultCount: 1, results: [albumResult()] });

    await expect(
      itunesSearchAdapter.resolve(query({ barcodes: ['0075596060721'] })),
    ).resolves.toEqual({
      platform: 'apple_music',
      url: COLLECTION_VIEW_URL,
    });
  });

  it('falls back to a text search when the UPC lookup returns resultCount 0', async () => {
    nock(ITUNES_BASE_URL)
      .get('/lookup')
      .query(true)
      .reply(200, { resultCount: 0, results: [] });
    nock(ITUNES_BASE_URL)
      .get('/search')
      .query(true)
      .reply(200, { resultCount: 1, results: [albumResult()] });

    await expect(
      itunesSearchAdapter.resolve(query({ barcodes: ['0075596060721'] })),
    ).resolves.toEqual({ platform: 'apple_music', url: COLLECTION_VIEW_URL });
  });

  it('returns a link for a reliable text-search match', async () => {
    nock(ITUNES_BASE_URL)
      .get('/search')
      .query(true)
      .reply(200, { resultCount: 1, results: [albumResult()] });

    await expect(itunesSearchAdapter.resolve(query())).resolves.toEqual({
      platform: 'apple_music',
      url: COLLECTION_VIEW_URL,
    });
  });

  it('returns null when the text search has no reliable match', async () => {
    nock(ITUNES_BASE_URL)
      .get('/search')
      .query(true)
      .reply(200, {
        resultCount: 1,
        results: [
          albumResult({ artistName: 'Someone Else', collectionName: 'Other Record' }),
        ],
      });

    await expect(itunesSearchAdapter.resolve(query())).resolves.toBeNull();
  });

  it('rejects a reused/rebadged barcode whose album artist is wholly unrelated (→ null)', async () => {
    // The UPC lookup resolves to a genuine album, but by a completely
    // different artist than the record being resolved — a reused barcode.
    nock(ITUNES_BASE_URL)
      .get('/lookup')
      .query(true)
      .reply(200, {
        resultCount: 1,
        results: [albumResult({ artistName: 'Kenny G', collectionName: 'Breathless' })],
      });
    // Resolution then falls through to the text search, which finds nothing.
    nock(ITUNES_BASE_URL)
      .get('/search')
      .query(true)
      .reply(200, { resultCount: 0, results: [] });

    await expect(
      itunesSearchAdapter.resolve(query({ barcodes: ['0075596060721'] })),
    ).resolves.toBeNull();
  });

  it('returns null when the text search yields only partial candidates (artist-only or title-only, never both)', async () => {
    nock(ITUNES_BASE_URL)
      .get('/search')
      .query(true)
      .reply(200, {
        resultCount: 2,
        results: [
          // Title corresponds, artist does not.
          albumResult({ artistName: 'Vitamin String Quartet' }),
          // Artist corresponds, title does not.
          albumResult({ collectionName: 'Garage Inc.' }),
        ],
      });

    await expect(itunesSearchAdapter.resolve(query())).resolves.toBeNull();
  });

  it('maps HTTP 403 to StreamingRateLimitedError', async () => {
    nock(ITUNES_BASE_URL).get('/search').query(true).reply(403, 'Forbidden');

    await expect(itunesSearchAdapter.resolve(query())).rejects.toBeInstanceOf(
      StreamingRateLimitedError,
    );
  });

  it('maps a request timeout to StreamingUnavailableError', async () => {
    nock(ITUNES_BASE_URL)
      .get('/search')
      .query(true)
      .delayConnection(4500)
      .reply(200, { resultCount: 0, results: [] });

    await expect(itunesSearchAdapter.resolve(query())).rejects.toBeInstanceOf(
      StreamingUnavailableError,
    );
  });

  it('maps a 5xx (after one retry) to StreamingUnavailableError and logs the retry', async () => {
    nock(ITUNES_BASE_URL).get('/search').query(true).times(2).reply(503, 'nope');

    await expect(itunesSearchAdapter.resolve(query())).rejects.toBeInstanceOf(
      StreamingUnavailableError,
    );

    // The retry attempt must be observable — otherwise a flaky-iTunes incident
    // is invisible until it degrades all the way to a transient_failure.
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'streaming:itunes',
        outcome: 'retry',
        meta: expect.objectContaining({ path: '/search', attempt: 1, status: 503 }),
      }),
    );
  });

  it('parses a text/javascript body as JSON', async () => {
    nock(ITUNES_BASE_URL)
      .get('/search')
      .query(true)
      .reply(200, JSON.stringify({ resultCount: 1, results: [albumResult()] }), {
        'Content-Type': 'text/javascript; charset=utf-8',
      });

    await expect(itunesSearchAdapter.resolve(query())).resolves.toEqual({
      platform: 'apple_music',
      url: COLLECTION_VIEW_URL,
    });
  });

  it('throws (never returns a bad link) for an unparseable body', async () => {
    nock(ITUNES_BASE_URL).get('/search').query(true).reply(200, 'not-json-at-all <<<');

    await expect(itunesSearchAdapter.resolve(query())).rejects.toBeInstanceOf(
      StreamingUnavailableError,
    );
  });

  it('sends the requested storefront as the outbound country param', async () => {
    let sentCountry: string | undefined;
    nock(ITUNES_BASE_URL)
      .get('/search')
      .query((actual) => {
        sentCountry = actual.country as string;
        return true;
      })
      .reply(200, { resultCount: 0, results: [] });

    await itunesSearchAdapter.resolve(query({ storefront: 'BR' }));

    expect(sentCountry).toBe('BR');
  });
});

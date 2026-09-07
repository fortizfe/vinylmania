import { createHash } from 'crypto';

import { logger } from '../../../src/config/logger';
import {
  buildRecordKey,
  createResolveStreamingLinksUseCase,
  STREAMING_CACHE_TTL_SECONDS,
} from '../../../src/application/streaming/resolveStreamingLinks';
import {
  StreamingRateLimitedError,
  StreamingUnavailableError,
} from '../../../src/domain/streaming/streamingErrors';
import type {
  ResolvedStreamingLink,
  StreamingLinkQuery,
  StreamingPlatform,
} from '../../../src/domain/streaming/types';
import type { CachePort } from '../../../src/ports/cache/cachePort';
import type { StreamingResolverPort } from '../../../src/ports/streaming/streamingResolverPort';

function query(overrides: Partial<StreamingLinkQuery> = {}): StreamingLinkQuery {
  return {
    barcodes: ['0075596060721'],
    artist: 'Metallica',
    title: 'Master of Puppets',
    storefront: 'ES',
    ...overrides,
  };
}

/** An in-memory CachePort that actually persists resolved values (incl. null). */
function inMemoryCache(): CachePort & { keys: string[]; ttls: number[] } {
  const store = new Map<string, string>();
  const keys: string[] = [];
  const ttls: number[] = [];
  return {
    keys,
    ttls,
    has: async (key) => store.has(key),
    set: async (key, value) => {
      store.set(key, value);
    },
    invalidate: async (key) => {
      store.delete(key);
    },
    withCache: async (key, ttlSeconds, fetcher) => {
      keys.push(key);
      ttls.push(ttlSeconds);
      if (store.has(key)) {
        return JSON.parse(store.get(key) as string);
      }
      const result = await fetcher();
      store.set(key, JSON.stringify(result));
      return result;
    },
  };
}

function fakeResolver(
  platform: StreamingPlatform,
  resolve: jest.Mock<Promise<ResolvedStreamingLink | null>, [StreamingLinkQuery]>,
): StreamingResolverPort {
  return { platform, resolve };
}

const appleLink: ResolvedStreamingLink = {
  platform: 'apple_music',
  url: 'https://music.apple.com/es/album/master-of-puppets/1440899482',
};

describe('resolveStreamingLinks use case', () => {
  beforeEach(() => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  it('includes a link a resolver returns', async () => {
    const cache = inMemoryCache();
    const resolve = jest.fn().mockResolvedValue(appleLink);
    const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
      resolvers: [fakeResolver('apple_music', resolve)],
      cache,
    });

    const result = await resolveStreamingLinks(query());

    expect(result.links).toEqual([appleLink]);
  });

  it('omits a resolver that returns null, and caches the no-match', async () => {
    const cache = inMemoryCache();
    const resolve = jest.fn().mockResolvedValue(null);
    const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
      resolvers: [fakeResolver('apple_music', resolve)],
      cache,
    });

    const first = await resolveStreamingLinks(query());
    const second = await resolveStreamingLinks(query());

    expect(first.links).toEqual([]);
    expect(second.links).toEqual([]);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('omits a resolver that throws a StreamingResolutionError and does NOT cache it', async () => {
    const cache = inMemoryCache();
    const resolve = jest.fn().mockRejectedValue(new StreamingUnavailableError());
    const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
      resolvers: [fakeResolver('apple_music', resolve)],
      cache,
    });

    const first = await resolveStreamingLinks(query());
    const second = await resolveStreamingLinks(query());

    expect(first.links).toEqual([]);
    expect(second.links).toEqual([]);
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('logs a transient_failure when a resolver throws', async () => {
    const cache = inMemoryCache();
    const resolve = jest.fn().mockRejectedValue(new StreamingUnavailableError());
    const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
      resolvers: [fakeResolver('apple_music', resolve)],
      cache,
    });

    await resolveStreamingLinks(query());

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/streaming/links',
        outcome: 'transient_failure',
        meta: expect.objectContaining({ platform: 'apple_music', storefront: 'ES' }),
      }),
    );
  });

  it("does not let one resolver throwing suppress another resolver's link", async () => {
    const cache = inMemoryCache();
    const throwing = jest.fn().mockRejectedValue(new StreamingUnavailableError());
    const working = jest.fn().mockResolvedValue({
      platform: 'spotify',
      url: 'https://open.spotify.com/album/x',
    });
    const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
      resolvers: [
        fakeResolver('apple_music', throwing),
        fakeResolver('spotify' as StreamingPlatform, working),
      ],
      cache,
    });

    const result = await resolveStreamingLinks(query());

    expect(result.links).toEqual([
      { platform: 'spotify', url: 'https://open.spotify.com/album/x' },
    ]);
  });

  it('returns links in resolver-list order', async () => {
    const cache = inMemoryCache();
    const first = jest
      .fn()
      .mockResolvedValue({ platform: 'apple_music', url: 'https://a' });
    const second = jest.fn().mockResolvedValue({ platform: 'spotify', url: 'https://b' });
    const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
      resolvers: [
        fakeResolver('apple_music', first),
        fakeResolver('spotify' as StreamingPlatform, second),
      ],
      cache,
    });

    const result = await resolveStreamingLinks(query());

    expect(result.links.map((link) => link.platform)).toEqual(['apple_music', 'spotify']);
  });

  it('keys the cache as streaming:<platform>:<recordKey>:<storefront> with a content-derived recordKey', async () => {
    const cache = inMemoryCache();
    const resolve = jest.fn().mockResolvedValue(appleLink);
    const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
      resolvers: [fakeResolver('apple_music', resolve)],
      cache,
    });

    await resolveStreamingLinks(query());

    const expectedRecordKey = createHash('sha1')
      .update('0075596060721|metallica|master of puppets')
      .digest('hex');
    expect(cache.keys).toEqual([`streaming:apple_music:${expectedRecordKey}:ES`]);
    expect(cache.ttls).toEqual([STREAMING_CACHE_TTL_SECONDS]);
    expect(STREAMING_CACHE_TTL_SECONDS).toBe(7_776_000);
  });

  it('with two resolvers, re-invokes only the transiently-failed one next call while the sibling link is served from cache (FR-005 + FR-013)', async () => {
    const cache = inMemoryCache();
    const throwing = jest.fn().mockRejectedValue(new StreamingRateLimitedError());
    const working = jest.fn().mockResolvedValue({
      platform: 'spotify',
      url: 'https://open.spotify.com/album/x',
    });
    const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
      resolvers: [
        fakeResolver('apple_music', throwing),
        fakeResolver('spotify' as StreamingPlatform, working),
      ],
      cache,
    });

    const first = await resolveStreamingLinks(query());
    const second = await resolveStreamingLinks(query());

    expect(first.links).toEqual([
      { platform: 'spotify', url: 'https://open.spotify.com/album/x' },
    ]);
    expect(second.links).toEqual([
      { platform: 'spotify', url: 'https://open.spotify.com/album/x' },
    ]);
    // Transient failure is never persisted — re-attempted on every view.
    expect(throwing).toHaveBeenCalledTimes(2);
    // Confirmed match is cached — not re-resolved.
    expect(working).toHaveBeenCalledTimes(1);
  });

  it('a thrown error leaves no cache entry that could poison a later confirmed no-match', async () => {
    const cache = inMemoryCache();
    const resolve = jest
      .fn()
      .mockRejectedValueOnce(new StreamingUnavailableError())
      .mockResolvedValueOnce(null)
      .mockResolvedValue(appleLink);
    const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
      resolvers: [fakeResolver('apple_music', resolve)],
      cache,
    });

    await resolveStreamingLinks(query()); // throws  → nothing cached
    await resolveStreamingLinks(query()); // null    → cached for 90 days
    const third = await resolveStreamingLinks(query()); // served from the cached null

    expect(third.links).toEqual([]);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(await cache.has(`streaming:apple_music:${buildRecordKey(query())}:ES`)).toBe(
      true,
    );
  });

  it('derives the same recordKey regardless of barcode order, and a different one for a different title', () => {
    const a = buildRecordKey(query({ barcodes: ['111', '222'] }));
    const b = buildRecordKey(query({ barcodes: ['222', '111'] }));
    const c = buildRecordKey(
      query({ barcodes: ['111', '222'], title: 'Ride the Lightning' }),
    );

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{40}$/);
  });
});

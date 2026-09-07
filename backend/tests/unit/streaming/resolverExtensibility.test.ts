import { logger } from '../../../src/config/logger';
import {
  buildRecordKey,
  createResolveStreamingLinksUseCase,
} from '../../../src/application/streaming/resolveStreamingLinks';
import { StreamingUnavailableError } from '../../../src/domain/streaming/streamingErrors';
import type {
  ResolvedStreamingLink,
  StreamingLinkQuery,
  StreamingPlatform,
} from '../../../src/domain/streaming/types';
import type { CachePort } from '../../../src/ports/cache/cachePort';
import type { StreamingResolverPort } from '../../../src/ports/streaming/streamingResolverPort';

/**
 * T036 (US4, SC-008) — adding a streaming platform is "one adapter + one
 * resolver-list entry + one frontend metadata row". This suite proves the
 * `resolveStreamingLinks` use case is ALREADY generic over N resolvers: every
 * assertion here passes with NO change to `itunesSearchAdapter.ts`,
 * `resolveStreamingLinks.ts`, or `matching.ts`. It never imports the Apple
 * Music adapter — it drives the use case with throwaway fake resolvers only.
 */

function query(overrides: Partial<StreamingLinkQuery> = {}): StreamingLinkQuery {
  return {
    barcodes: ['0075596060721'],
    artist: 'Metallica',
    title: 'Master of Puppets',
    storefront: 'ES',
    ...overrides,
  };
}

function inMemoryCache(): CachePort & { keys: string[] } {
  const store = new Map<string, string>();
  const keys: string[] = [];
  return {
    keys,
    has: async (key) => store.has(key),
    set: async (key, value) => {
      store.set(key, value);
    },
    invalidate: async (key) => {
      store.delete(key);
    },
    withCache: async (key, _ttlSeconds, fetcher) => {
      keys.push(key);
      if (store.has(key)) {
        return JSON.parse(store.get(key) as string);
      }
      const result = await fetcher();
      store.set(key, JSON.stringify(result));
      return result;
    },
  };
}

/**
 * Stand-in for "the next platform we add" — a plain `StreamingResolverPort`
 * with no real adapter behind it. `platform` is a `string` cast to the union;
 * a real platform would widen `StreamingPlatform` in `domain/streaming/types.ts`.
 */
function fakeResolver(
  platform: string,
  impl: () => Promise<ResolvedStreamingLink | null>,
): StreamingResolverPort {
  return { platform: platform as StreamingPlatform, resolve: impl };
}

const APPLE: ResolvedStreamingLink = {
  platform: 'apple_music',
  url: 'https://music.apple.com/es/album/master-of-puppets/1440899482',
};
const SPOTIFY = {
  platform: 'spotify' as StreamingPlatform,
  url: 'https://open.spotify.com/album/2Lq2qX3hYhiuPckC8Flj21',
};

describe('resolveStreamingLinks is generic over N streaming resolvers (US4)', () => {
  beforeEach(() => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  it('returns every resolver’s link, in resolver-list order', async () => {
    const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
      resolvers: [
        fakeResolver('apple_music', () => Promise.resolve(APPLE)),
        fakeResolver('spotify', () => Promise.resolve(SPOTIFY)),
      ],
      cache: inMemoryCache(),
    });

    const result = await resolveStreamingLinks(query());

    expect(result.links).toEqual([APPLE, SPOTIFY]);
  });

  it('still returns the Apple Music link when a sibling resolver throws', async () => {
    const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
      resolvers: [
        fakeResolver('apple_music', () => Promise.resolve(APPLE)),
        fakeResolver('spotify', () => Promise.reject(new StreamingUnavailableError())),
      ],
      cache: inMemoryCache(),
    });

    const result = await resolveStreamingLinks(query());

    expect(result.links).toEqual([APPLE]);
  });

  it('caches each platform under its own distinct key', async () => {
    const cache = inMemoryCache();
    const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
      resolvers: [
        fakeResolver('apple_music', () => Promise.resolve(APPLE)),
        fakeResolver('spotify', () => Promise.resolve(SPOTIFY)),
      ],
      cache,
    });

    await resolveStreamingLinks(query());

    const recordKey = buildRecordKey(query());
    expect(cache.keys).toEqual([
      `streaming:apple_music:${recordKey}:ES`,
      `streaming:spotify:${recordKey}:ES`,
    ]);
    expect(new Set(cache.keys).size).toBe(2);
  });

  it('does not special-case Apple Music: a resolver list without it still resolves the rest', async () => {
    const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
      resolvers: [fakeResolver('spotify', () => Promise.resolve(SPOTIFY))],
      cache: inMemoryCache(),
    });

    const result = await resolveStreamingLinks(query());

    expect(result.links).toEqual([SPOTIFY]);
  });
});

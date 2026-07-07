import axios, { type AxiosInstance, type AxiosResponse, isAxiosError } from 'axios';

import { withCache } from '../cache/cacheAside';
import { logger } from '../config/logger';
import {
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from './discogsErrors';
import { mapArtist, mapRelease, mapReleaseRating, mapSearchResult } from './discogsMapper';
import type { Artist, CatalogSearchResponse, CatalogSearchResult, CommunityRating, Release } from './types';

export { DiscogsError } from './discogsErrors';

const DEFAULT_DISCOGS_BASE_URL = 'https://api.discogs.com';

export function getDiscogsBaseUrl(): string {
  return process.env.DISCOGS_BASE_URL ?? DEFAULT_DISCOGS_BASE_URL;
}

function buildAuthorizationHeader(): string | undefined {
  const token = process.env.DISCOGS_TOKEN;
  return token ? `Discogs token=${token}` : undefined;
}

export function createDiscogsHttpClient(): AxiosInstance {
  const authorization = buildAuthorizationHeader();

  const instance = axios.create({
    baseURL: getDiscogsBaseUrl(),
    timeout: 10_000,
    headers: {
      'User-Agent': process.env.DISCOGS_USER_AGENT || 'Vinylmania/0.1',
      ...(authorization ? { Authorization: authorization } : {}),
    },
  });

  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      logRateLimit(response.config.url ?? 'unknown', 'success', response);
      return response;
    },
    (error: unknown) => {
      const endpoint = isAxiosError(error) ? (error.config?.url ?? 'unknown') : 'unknown';

      if (isAxiosError(error) && error.response) {
        const { status } = error.response;

        if (status === 404) {
          logRateLimit(endpoint, 'not_found', error.response);
          return Promise.reject(new DiscogsNotFoundError(error));
        }

        if (status === 429) {
          logRateLimit(endpoint, 'rate_limited', error.response);
          return Promise.reject(new DiscogsRateLimitError(error));
        }

        logger.error({
          route: endpoint,
          outcome: 'unavailable',
          message: `Discogs responded with status ${status}`,
        });
        return Promise.reject(new DiscogsUnavailableError(error));
      }

      logger.error({
        route: endpoint,
        outcome: 'unavailable',
        message: isAxiosError(error) ? error.message : 'Unknown network error',
      });
      return Promise.reject(new DiscogsUnavailableError(error));
    },
  );

  return instance;
}

function logRateLimit(
  endpoint: string,
  outcome: 'success' | 'not_found' | 'rate_limited',
  response: AxiosResponse,
): void {
  logger.info({
    route: endpoint,
    outcome,
    meta: {
      rateLimitRemaining: response.headers['x-discogs-ratelimit-remaining'],
      rateLimit: response.headers['x-discogs-ratelimit'],
    },
  });
}

let sharedClient: AxiosInstance | undefined;

export function getDiscogsHttpClient(): AxiosInstance {
  sharedClient ??= createDiscogsHttpClient();
  return sharedClient;
}

export interface SearchCatalogOptions {
  resultType?: 'release' | 'artist';
  page?: number;
  perPage?: number;
  /** Free-text filter on artist name (spec FR-002, feature 021). */
  artist?: string;
  /** Free-text filter on genre (spec FR-002, feature 021). */
  genre?: string;
  /** Free-text filter on style (spec FR-002, feature 021). */
  style?: string;
  /** Free-text filter on format (spec FR-002, feature 021). */
  format?: string;
}

/** Trims a filter value; blank/whitespace-only values are treated as unset (spec FR-010). */
function normalizeFilterValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

// Discogs catalog data changes rarely, so search results (which can shift
// as the catalog grows) get a shorter TTL than individual release/artist
// lookups (which are effectively immutable once published).
const SEARCH_CACHE_TTL_SECONDS = 30 * 60;
const RELEASE_CACHE_TTL_SECONDS = 6 * 60 * 60;
const ARTIST_CACHE_TTL_SECONDS = 6 * 60 * 60;
const RATING_CACHE_TTL_SECONDS = 30 * 60;

// Spec SC-006: a per-release rating lookup that hasn't resolved within 2
// seconds is treated identically to a failed lookup, so search results are
// never blocked or perceptibly delayed by rating enrichment.
const RATING_LOOKUP_TIMEOUT_MS = 2_000;

/** Fetches (and caches) one release's community rating; rejects if the lookup fails or times out. */
export async function getReleaseRating(discogsReleaseId: number): Promise<CommunityRating> {
  return withCache(`discogs:rating:${discogsReleaseId}`, RATING_CACHE_TTL_SECONDS, async () => {
    const response = await getDiscogsHttpClient().get(`/releases/${discogsReleaseId}/rating`, {
      timeout: RATING_LOOKUP_TIMEOUT_MS,
    });
    return mapReleaseRating(response.data);
  });
}

/**
 * Enriches one release-type search result with its community rating.
 * Any failure (not found, rate-limited, unavailable, or a lookup exceeding
 * the 2-second timeout) degrades to omitting `communityRating` rather than
 * failing the search response (spec FR-008/SC-006).
 */
async function enrichWithRating(result: CatalogSearchResult): Promise<CatalogSearchResult> {
  if (result.resultType !== 'release') {
    return result;
  }

  try {
    const rating = await getReleaseRating(result.discogsId);
    if (rating.count <= 0) {
      return result;
    }
    return { ...result, communityRating: rating };
  } catch (err) {
    logger.warn({
      route: 'discogs:rating',
      outcome: 'omitted',
      meta: { discogsReleaseId: result.discogsId },
      message: err instanceof Error ? err.message : 'unknown error',
    });
    return result;
  }
}

export async function searchCatalog(
  query: string,
  options: SearchCatalogOptions = {},
): Promise<CatalogSearchResponse> {
  if (!query.trim()) {
    return { results: [], pagination: { page: 1, pages: 0, items: 0, perPage: 0 } };
  }

  const resultType = options.resultType ?? '';
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 50;
  const artist = normalizeFilterValue(options.artist);
  const genre = normalizeFilterValue(options.genre);
  const style = normalizeFilterValue(options.style);
  const format = normalizeFilterValue(options.format);
  // Cache-aside key includes every filter segment (empty when unset) so
  // filtered and unfiltered searches for the same query/page never collide.
  const cacheKey = `discogs:search:${resultType}:${query}:${page}:${perPage}:${artist ?? ''}:${genre ?? ''}:${style ?? ''}:${format ?? ''}`;

  return withCache(cacheKey, SEARCH_CACHE_TTL_SECONDS, async () => {
    const response = await getDiscogsHttpClient().get('/database/search', {
      params: {
        q: query,
        type: options.resultType,
        page,
        per_page: perPage,
        ...(artist ? { artist } : {}),
        ...(genre ? { genre } : {}),
        ...(style ? { style } : {}),
        ...(format ? { format } : {}),
      },
    });

    const { pagination, results } = response.data as {
      pagination: { page: number; pages: number; items: number; per_page: number };
      results: unknown[];
    };

    const mappedResults = results.map(mapSearchResult);
    const enrichedResults = await Promise.all(mappedResults.map(enrichWithRating));

    return {
      results: enrichedResults,
      pagination: {
        page: pagination.page,
        pages: pagination.pages,
        items: pagination.items,
        perPage: pagination.per_page,
      },
    };
  });
}

export async function getRelease(discogsReleaseId: number): Promise<Release> {
  return withCache(`discogs:release:${discogsReleaseId}`, RELEASE_CACHE_TTL_SECONDS, async () => {
    const response = await getDiscogsHttpClient().get(`/releases/${discogsReleaseId}`);
    return mapRelease(response.data);
  });
}

export async function getArtist(discogsArtistId: number): Promise<Artist> {
  return withCache(`discogs:artist:${discogsArtistId}`, ARTIST_CACHE_TTL_SECONDS, async () => {
    const response = await getDiscogsHttpClient().get(`/artists/${discogsArtistId}`);
    return mapArtist(response.data);
  });
}

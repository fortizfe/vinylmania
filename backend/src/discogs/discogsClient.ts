import axios, { type AxiosInstance, type AxiosResponse, isAxiosError } from 'axios';

import { withCache } from '../cache/cacheAside';
import { logger } from '../config/logger';
import {
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from './discogsErrors';
import { mapArtist, mapRelease, mapSearchResult } from './discogsMapper';
import type { Artist, CatalogSearchResponse, Release } from './types';

export { DiscogsError } from './discogsErrors';

const DISCOGS_BASE_URL = 'https://api.discogs.com';

function buildAuthorizationHeader(): string | undefined {
  const token = process.env.DISCOGS_TOKEN;
  return token ? `Discogs token=${token}` : undefined;
}

export function createDiscogsHttpClient(): AxiosInstance {
  const authorization = buildAuthorizationHeader();

  const instance = axios.create({
    baseURL: DISCOGS_BASE_URL,
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
}

// Discogs catalog data changes rarely, so search results (which can shift
// as the catalog grows) get a shorter TTL than individual release/artist
// lookups (which are effectively immutable once published).
const SEARCH_CACHE_TTL_SECONDS = 30 * 60;
const RELEASE_CACHE_TTL_SECONDS = 6 * 60 * 60;
const ARTIST_CACHE_TTL_SECONDS = 6 * 60 * 60;

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
  const cacheKey = `discogs:search:${resultType}:${query}:${page}:${perPage}`;

  return withCache(cacheKey, SEARCH_CACHE_TTL_SECONDS, async () => {
    const response = await getDiscogsHttpClient().get('/database/search', {
      params: { q: query, type: options.resultType, page, per_page: perPage },
    });

    const { pagination, results } = response.data as {
      pagination: { page: number; pages: number; items: number; per_page: number };
      results: unknown[];
    };

    return {
      results: results.map(mapSearchResult),
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

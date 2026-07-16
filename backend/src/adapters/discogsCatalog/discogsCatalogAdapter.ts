import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  isAxiosError,
} from 'axios';

import { logger } from '../../config/logger';
import {
  recordExhaustedFailure,
  recordSuccess,
  shouldShortCircuit,
} from '../../discogs/discogsCircuitBreaker';
import {
  DiscogsAuthError,
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../discogs/discogsErrors';
import { acquireSlot, recordRateLimitHeaders } from '../../discogs/discogsRateLimiter';
import {
  backoffDelayMs,
  classifyForRetry,
  MAX_ATTEMPTS,
  PER_ATTEMPT_TIMEOUT_MS,
} from '../../discogs/discogsRetry';
import type {
  Artist,
  CatalogSearchResponse,
  MasterRelease,
  MasterReleaseVersionsPage,
  Release,
  CommunityRating,
} from '../../domain/discogsCatalog/types';
import type {
  DiscogsCatalogPort,
  SearchCatalogOptions,
} from '../../ports/discogsCatalog/discogsCatalogPort';
import { cacheAdapter } from '../cache/cacheAdapter';
import {
  mapArtist,
  mapMasterRelease,
  mapMasterReleaseVersion,
  mapRelease,
  mapReleaseRating,
  mapSearchResult,
} from './discogsMapper';

export { DiscogsError } from '../../discogs/discogsErrors';

const DEFAULT_DISCOGS_BASE_URL = 'https://api.discogs.com';

export function getDiscogsBaseUrl(): string {
  return process.env.DISCOGS_BASE_URL ?? DEFAULT_DISCOGS_BASE_URL;
}

function buildAuthorizationHeader(): string | undefined {
  const token = process.env.DISCOGS_TOKEN;
  return token ? `Discogs token=${token}` : undefined;
}

/**
 * Extra, non-axios properties carried on a request config across a retry
 * sequence (feature 029). `__attempt` tracks which attempt this is (1 = the
 * original request); `__skipResilience` opts a specific call (the rating
 * lookup) out of retry and circuit-breaker handling entirely, preserving
 * its pre-existing fail-soft/short-timeout behavior unchanged.
 */
interface ResilienceRequestState {
  __attempt?: number;
  __skipResilience?: boolean;
}

type ResilienceConfig = InternalAxiosRequestConfig & ResilienceRequestState;

/** Signals a request that never left this process — the breaker was open. */
class CircuitOpenError extends Error {
  constructor(public readonly endpoint: string) {
    super('Discogs circuit breaker is open');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createDiscogsHttpClient(): AxiosInstance {
  const authorization = buildAuthorizationHeader();

  const instance = axios.create({
    baseURL: getDiscogsBaseUrl(),
    timeout: PER_ATTEMPT_TIMEOUT_MS,
    headers: {
      'User-Agent': process.env.DISCOGS_USER_AGENT || 'Vinylmania/0.1',
      ...(authorization ? { Authorization: authorization } : {}),
    },
  });

  instance.interceptors.request.use(async (config: ResilienceConfig) => {
    if (!config.__skipResilience && shouldShortCircuit()) {
      return Promise.reject(new CircuitOpenError(config.url ?? 'unknown'));
    }
    await acquireSlot();
    return config;
  });

  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      const config = response.config as ResilienceConfig;
      const attempts = config.__attempt ?? 1;
      recordRateLimitHeaders(response.headers);
      if (!config.__skipResilience) {
        recordSuccess();
      }
      logRateLimit(config.url ?? 'unknown', 'success', response, attempts);
      return response;
    },
    async (error: unknown) => {
      if (error instanceof CircuitOpenError) {
        logger.warn({ route: error.endpoint, outcome: 'circuit_open' });
        return Promise.reject(new DiscogsUnavailableError(error));
      }

      if (!isAxiosError(error)) {
        logger.error({
          route: 'unknown',
          outcome: 'unavailable',
          message: 'Unknown network error',
          meta: { attempts: 1 },
        });
        return Promise.reject(new DiscogsUnavailableError(error));
      }

      const config = error.config as ResilienceConfig | undefined;
      const endpoint = config?.url ?? 'unknown';
      const skipResilience = Boolean(config?.__skipResilience);
      const attempt = config?.__attempt ?? 1;

      if (error.response) {
        recordRateLimitHeaders(error.response.headers);
        const { status } = error.response;

        if (status === 404) {
          logRateLimit(endpoint, 'not_found', error.response, attempt);
          return Promise.reject(new DiscogsNotFoundError(error));
        }

        if (status === 401 || status === 403) {
          logger.warn({
            route: endpoint,
            outcome: 'auth_failed',
            message: `Discogs responded with status ${status}`,
            meta: { attempts: attempt },
          });
          return Promise.reject(new DiscogsAuthError(error));
        }
      }

      const classification = classifyForRetry(error);
      const eligibleForRetry =
        classification !== null && !skipResilience && config !== undefined && attempt < MAX_ATTEMPTS;

      if (eligibleForRetry && config) {
        config.__attempt = attempt + 1;
        await delay(backoffDelayMs(attempt + 1));
        return instance.request(config);
      }

      if (classification && !skipResilience) {
        recordExhaustedFailure();
      }

      if (classification === 'rate_limited' && error.response) {
        logRateLimit(endpoint, 'rate_limited', error.response, attempt);
        return Promise.reject(new DiscogsRateLimitError(error));
      }

      logger.error({
        route: endpoint,
        outcome: 'unavailable',
        message: error.response
          ? `Discogs responded with status ${error.response.status}`
          : error.message,
        meta: { attempts: attempt },
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
  attempts: number,
): void {
  logger.info({
    route: endpoint,
    outcome,
    meta: {
      rateLimitRemaining: response.headers['x-discogs-ratelimit-remaining'],
      rateLimit: response.headers['x-discogs-ratelimit'],
      attempts,
    },
  });
}

let sharedClient: AxiosInstance | undefined;

export function getDiscogsHttpClient(): AxiosInstance {
  sharedClient ??= createDiscogsHttpClient();
  return sharedClient;
}

/** Trims a filter value; blank/whitespace-only values are treated as unset (spec FR-010). */
function normalizeFilterValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

const RELEASE_CACHE_TTL_SECONDS = 6 * 60 * 60;
const ARTIST_CACHE_TTL_SECONDS = 6 * 60 * 60;
const RATING_CACHE_TTL_SECONDS = 30 * 60;

// Spec SC-006: a per-release rating lookup that hasn't resolved within 2
// seconds is treated identically to a failed lookup, so search results are
// never blocked or perceptibly delayed by rating enrichment.
const RATING_LOOKUP_TIMEOUT_MS = 2_000;

/** Fetches (and caches) one release's community rating; rejects if the lookup fails or times out. */
export async function getReleaseRating(
  discogsReleaseId: number,
): Promise<CommunityRating> {
  return cacheAdapter.withCache(
    `discogs:rating:${discogsReleaseId}`,
    RATING_CACHE_TTL_SECONDS,
    async () => {
      const response = await getDiscogsHttpClient().get(
        `/releases/${discogsReleaseId}/rating`,
        {
          timeout: RATING_LOOKUP_TIMEOUT_MS,
          // Rating enrichment keeps its own fail-soft/short-timeout
          // behavior untouched by the retry/circuit-breaker policy
          // (research.md §8) — a failed or slow lookup must degrade
          // immediately, not spend the retry budget.
          __skipResilience: true,
        } as Parameters<AxiosInstance['get']>[1],
      );
      return mapReleaseRating(response.data);
    },
  );
}

const MASTER_CACHE_TTL_SECONDS = 6 * 60 * 60;
const MASTER_VERSIONS_CACHE_TTL_SECONDS = 6 * 60 * 60;
const DEFAULT_MASTER_VERSIONS_PER_PAGE = 10;

/** Fetches (and caches) one master release's detail (feature 026, US3). */
export async function getMasterRelease(masterId: number): Promise<MasterRelease> {
  return cacheAdapter.withCache(
    `discogs:master:${masterId}`,
    MASTER_CACHE_TTL_SECONDS,
    async () => {
      const response = await getDiscogsHttpClient().get(`/masters/${masterId}`);
      return mapMasterRelease(response.data);
    },
  );
}

/**
 * Fetches (and caches) one page of a master's version list, 10 per page by
 * default (spec FR-009, feature 026 US3).
 */
export async function getMasterReleaseVersions(
  masterId: number,
  page = 1,
  perPage = DEFAULT_MASTER_VERSIONS_PER_PAGE,
): Promise<MasterReleaseVersionsPage> {
  const cacheKey = `discogs:master-versions:${masterId}:${page}:${perPage}`;
  return cacheAdapter.withCache(cacheKey, MASTER_VERSIONS_CACHE_TTL_SECONDS, async () => {
    const response = await getDiscogsHttpClient().get(`/masters/${masterId}/versions`, {
      params: { page, per_page: perPage },
    });
    const { pagination, versions } = response.data as {
      pagination: { page: number; pages: number; items: number; per_page: number };
      versions: unknown[];
    };

    return {
      results: versions.map(mapMasterReleaseVersion),
      pagination: {
        page: pagination.page,
        pages: pagination.pages,
        items: pagination.items,
        perPage: pagination.per_page,
      },
    };
  });
}

/**
 * Raw catalog search — no rating enrichment, no caching (research.md
 * Decision 2). The enriched, cached search lives in
 * application/discogsCatalog/searchCatalogWithRatings.ts.
 */
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
  const genre = normalizeFilterValue(options.genre);
  const style = normalizeFilterValue(options.style);
  const format = normalizeFilterValue(options.format);

  // A "release" search also wants Discogs' "master" hits (feature 026, US1):
  // Discogs indexes each catalog work once, as a master hit when it has
  // sibling versions or a release hit otherwise. Discogs' `type` filter only
  // documents a single value (not a comma-list — confirmed against the live
  // API, which otherwise returns unfiltered `label`/`artist` hits alongside
  // release/master ones and fails mapping), so the `type` param is left
  // unset for a release-scoped search and the two wanted types are kept by
  // filtering the raw response ourselves instead (research.md Decision 1).
  const discogsType = resultType === 'release' ? undefined : options.resultType;
  const KEPT_RAW_TYPES_FOR_RELEASE_SEARCH = new Set(['release', 'master']);

  const response = await getDiscogsHttpClient().get('/database/search', {
    params: {
      q: query,
      type: discogsType,
      page,
      per_page: perPage,
      ...(genre ? { genre } : {}),
      ...(style ? { style } : {}),
      ...(format ? { format } : {}),
    },
  });

  const { pagination, results } = response.data as {
    pagination: { page: number; pages: number; items: number; per_page: number };
    results: unknown[];
  };

  // Defensive filter: only map the raw hit types this search actually
  // wants, so an unexpected/unfiltered type from Discogs (e.g. `label`)
  // degrades to "not included" rather than crashing the whole response.
  const wantedResults =
    resultType === 'release'
      ? results.filter(
          (r) =>
            typeof r === 'object' &&
            r !== null &&
            KEPT_RAW_TYPES_FOR_RELEASE_SEARCH.has(
              (r as { type?: unknown }).type as string,
            ),
        )
      : results;

  const mappedResults = wantedResults.map(mapSearchResult);

  return {
    results: mappedResults,
    pagination: {
      page: pagination.page,
      pages: pagination.pages,
      items: pagination.items,
      perPage: pagination.per_page,
    },
  };
}

export async function getRelease(discogsReleaseId: number): Promise<Release> {
  return cacheAdapter.withCache(
    `discogs:release:${discogsReleaseId}`,
    RELEASE_CACHE_TTL_SECONDS,
    async () => {
      const response = await getDiscogsHttpClient().get(`/releases/${discogsReleaseId}`);
      return mapRelease(response.data);
    },
  );
}

export async function getArtist(discogsArtistId: number): Promise<Artist> {
  return cacheAdapter.withCache(
    `discogs:artist:${discogsArtistId}`,
    ARTIST_CACHE_TTL_SECONDS,
    async () => {
      const response = await getDiscogsHttpClient().get(`/artists/${discogsArtistId}`);
      return mapArtist(response.data);
    },
  );
}

export const discogsCatalogAdapter: DiscogsCatalogPort = {
  getRelease,
  getArtist,
  getMasterRelease,
  getMasterReleaseVersions,
  getReleaseRating,
  searchCatalog,
};

import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  isAxiosError,
} from 'axios';

import { cacheAdapter } from '../cache/cacheAdapter';
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
import { backoffDelayMs, classifyForRetry, MAX_ATTEMPTS } from '../../discogs/discogsRetry';
import { SellerSettingsRequiredError } from '../../domain/collectionStats/statsErrors';
import type { DiscogsConnection } from '../../domain/discogsOauth/types';
import {
  priceSuggestionsCacheKey,
  type DiscogsMarketplacePort,
  type PriceSuggestions,
} from '../../ports/discogsOauth/discogsMarketplacePort';
import { getOauthApiBaseUrl } from './oauthHttpClient';
import { buildProtectedResourceHeader, type ConsumerCredentials } from './oauthSignature';

/**
 * OAuth-signed client for `GET /marketplace/price_suggestions/{release_id}`
 * (feature 061, contracts/discogs-marketplace-client.md). Prices are returned
 * per condition grade in the linked user's Discogs seller currency.
 *
 * Reuses the shared resilience machinery verbatim (circuit breaker, preventive
 * throttle, retry/backoff) — the marketplace, catalog, collection and wantlist
 * clients consume the same per-IP Discogs budget (research.md Decision 4).
 * Unlike the collection write (`addReleaseToCollection`) this GET is
 * idempotent, so it IS retry-eligible.
 *
 * Status mapping specific to this endpoint:
 *  - `403` → `SellerSettingsRequiredError` (linked account has no seller
 *    settings — Block 2 only; Block 1 is unaffected).
 *  - `401` → `DiscogsAuthError` (revoked token).
 *  - `404` / empty `200 {}` → `null` (no market data — negative-cached).
 *
 * Responses are cached in Redis for 7 days (market value moves slowly,
 * FR-022); the `null` no-data result is negative-cached at the same TTL.
 */

const PRICE_SUGGESTIONS_TTL_SECONDS = 7 * 24 * 60 * 60;

function getCredentials(): ConsumerCredentials {
  const consumerKey = process.env.DISCOGS_CONSUMER_KEY;
  const consumerSecret = process.env.DISCOGS_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    throw new Error('DISCOGS_CONSUMER_KEY / DISCOGS_CONSUMER_SECRET are not configured');
  }
  return { consumerKey, consumerSecret };
}

interface ResilienceRequestState {
  __attempt?: number;
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

function createClient(connection: DiscogsConnection): AxiosInstance {
  const instance = axios.create({
    baseURL: getOauthApiBaseUrl(),
    timeout: 10_000,
    headers: {
      'User-Agent': process.env.DISCOGS_USER_AGENT || 'Vinylmania/0.1',
    },
  });

  instance.interceptors.request.use(async (config: ResilienceConfig) => {
    // `shouldShortCircuit` / `acquireSlot` are the SAME module-level singletons
    // the catalog + collection clients import — the marketplace client shares
    // the one per-IP Discogs breaker and rate-limit budget, no parallel path
    // (feature 061 FR-021, SC-006; covered by marketplaceClient.contract.test).
    // Order matters: an open breaker fails fast here, before any throttle slot
    // is taken and before a socket is opened.
    if (shouldShortCircuit()) {
      return Promise.reject(new CircuitOpenError(config.url ?? 'unknown'));
    }
    config.headers.Authorization = buildProtectedResourceHeader(getCredentials(), {
      token: connection.accessToken,
      tokenSecret: connection.accessTokenSecret,
    });
    await acquireSlot();
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      recordRateLimitHeaders(response.headers);
      recordSuccess();
      logger.info({
        route: response.config.url ?? 'unknown',
        outcome: 'success',
        meta: {
          rateLimitRemaining: response.headers['x-discogs-ratelimit-remaining'],
          rateLimit: response.headers['x-discogs-ratelimit'],
        },
      });
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
        });
        return Promise.reject(new DiscogsUnavailableError(error));
      }

      const config = error.config as ResilienceConfig | undefined;
      const endpoint = config?.url ?? 'unknown';
      const attempt = config?.__attempt ?? 1;

      if (error.response) {
        recordRateLimitHeaders(error.response.headers);
        const { status } = error.response;

        if (status === 403) {
          logger.warn({
            route: endpoint,
            outcome: 'seller_settings_required',
            message: 'Discogs price_suggestions 403',
          });
          return Promise.reject(new SellerSettingsRequiredError(error));
        }
        if (status === 401) {
          logger.warn({
            route: endpoint,
            outcome: 'auth_failed',
            message: 'Discogs price_suggestions 401',
          });
          return Promise.reject(new DiscogsAuthError(error));
        }
        if (status === 404) {
          return Promise.reject(new DiscogsNotFoundError(error));
        }
      }

      const classification = classifyForRetry(error);
      const eligibleForRetry =
        classification !== null && config !== undefined && attempt < MAX_ATTEMPTS;

      if (eligibleForRetry && config) {
        config.__attempt = attempt + 1;
        await delay(backoffDelayMs(attempt + 1));
        return instance.request(config);
      }

      if (classification) {
        recordExhaustedFailure();
      }

      if (classification === 'rate_limited' && error.response) {
        logger.warn({
          route: endpoint,
          outcome: 'rate_limited',
          message: 'Discogs price_suggestions 429',
        });
        return Promise.reject(new DiscogsRateLimitError(error));
      }

      logger.error({
        route: endpoint,
        outcome: 'unavailable',
        message: error.response
          ? `Discogs price_suggestions responded with status ${error.response.status}`
          : error.message,
      });
      return Promise.reject(new DiscogsUnavailableError(error));
    },
  );

  return instance;
}

interface RawConditionPrice {
  currency?: string;
  value?: number;
}

/** A raw `{ grade: { currency, value } }` map is usable only when it has ≥ 1 numeric entry. */
function normalizeSuggestions(raw: unknown): PriceSuggestions {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const entries = Object.entries(raw as Record<string, RawConditionPrice>).filter(
    ([, price]) =>
      price &&
      typeof price.value === 'number' &&
      Number.isFinite(price.value) &&
      typeof price.currency === 'string',
  );
  if (entries.length === 0) {
    return null;
  }
  return Object.fromEntries(
    entries.map(([grade, price]) => [
      grade,
      { currency: price.currency as string, value: price.value as number },
    ]),
  ) as PriceSuggestions;
}

export async function getPriceSuggestions(
  connection: DiscogsConnection,
  releaseId: number,
): Promise<PriceSuggestions> {
  return cacheAdapter.withCache(
    priceSuggestionsCacheKey(connection.uid, releaseId),
    PRICE_SUGGESTIONS_TTL_SECONDS,
    async () => {
      try {
        const response = await createClient(connection).get(
          `/marketplace/price_suggestions/${releaseId}`,
        );
        return normalizeSuggestions(response.data);
      } catch (err) {
        if (err instanceof DiscogsNotFoundError) {
          // No market data for this release — negative-cached (FR-016).
          return null;
        }
        throw err;
      }
    },
  );
}

export const discogsMarketplaceAdapter: DiscogsMarketplacePort = {
  getPriceSuggestions,
};

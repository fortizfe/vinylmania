import axios, {
  type AxiosInstance,
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
} from '../../discogs/discogsRetry';
import type { DiscogsConnection } from '../../domain/discogsOauth/types';
import type { WantItem } from '../../domain/discogsOauth/wantlistTypes';
import type { DiscogsWantlistPort } from '../../ports/discogsOauth/discogsWantlistPort';
import { getOauthApiBaseUrl } from './oauthHttpClient';
import { buildProtectedResourceHeader, type ConsumerCredentials } from './oauthSignature';

/**
 * OAuth-signed client for the authenticated Discogs wantlist endpoints
 * (`/users/{username}/wants`). Like `discogsCollectionAdapter`, these calls
 * act as the linked user and can fail with revoked credentials, so 401/403
 * map to `DiscogsAuthError`. It reuses the shared resilience machinery
 * (circuit breaker, preventive throttle, retry/backoff) verbatim — the
 * wantlist and collection clients consume the same per-IP Discogs budget
 * (research.md Decision 4). The base URL is env-overridable so tests and
 * e2e target stubs.
 */

const WANTS_PAGE_SIZE = 100;

function getCredentials(): ConsumerCredentials {
  const consumerKey = process.env.DISCOGS_CONSUMER_KEY;
  const consumerSecret = process.env.DISCOGS_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    throw new Error('DISCOGS_CONSUMER_KEY / DISCOGS_CONSUMER_SECRET are not configured');
  }
  return { consumerKey, consumerSecret };
}

/**
 * Extra, non-axios properties carried on a request config across a retry
 * sequence (mirrors `discogsCollectionAdapter.ts`). `__attempt` tracks which
 * attempt this is (1 = the original request); `__skipRetry` opts the
 * non-idempotent `putWant`/`deleteWant` writes out of retry only — the
 * circuit breaker still applies to them.
 */
interface ResilienceRequestState {
  __attempt?: number;
  __skipRetry?: boolean;
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
    // Shared breaker (also used by the catalog and collection clients) —
    // checked first so a breaker-rejected request never pays a throttle delay.
    if (shouldShortCircuit()) {
      return Promise.reject(new CircuitOpenError(config.url ?? 'unknown'));
    }
    // A fresh nonce/timestamp per request, so the header is built here.
    config.headers.Authorization = buildProtectedResourceHeader(getCredentials(), {
      token: connection.accessToken,
      tokenSecret: connection.accessTokenSecret,
    });
    // Shared preventive throttle — the catalog, collection and wantlist
    // clients consume the same per-IP Discogs budget.
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

        if (status === 401 || status === 403) {
          logger.warn({
            route: endpoint,
            outcome: 'auth_failed',
            message: `Discogs wantlist ${status}`,
          });
          return Promise.reject(new DiscogsAuthError(error));
        }
        if (status === 404) {
          return Promise.reject(new DiscogsNotFoundError(error));
        }
      }

      const classification = classifyForRetry(error);
      const eligibleForRetry =
        classification !== null &&
        !config?.__skipRetry &&
        config !== undefined &&
        attempt < MAX_ATTEMPTS;

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
          message: 'Discogs wantlist 429',
        });
        return Promise.reject(new DiscogsRateLimitError(error));
      }

      logger.error({
        route: endpoint,
        outcome: 'unavailable',
        message: error.response
          ? `Discogs wantlist responded with status ${error.response.status}`
          : error.message,
      });
      return Promise.reject(new DiscogsUnavailableError(error));
    },
  );

  return instance;
}

interface RawWant {
  id?: number;
  rating?: number;
  notes?: string;
  date_added: string;
  basic_information?: {
    id: number;
    title?: string;
    year?: number;
    artists?: Array<{ name: string }>;
    thumb?: string;
  };
}

interface RawWantsPage {
  pagination: { page: number; pages: number };
  wants: RawWant[];
}

/** Normalizes one raw want (contracts/discogs-wantlist-client.md). */
function mapWant(raw: RawWant): WantItem {
  return {
    releaseId: raw.id ?? raw.basic_information?.id ?? 0,
    rating:
      typeof raw.rating === 'number'
        ? Math.min(5, Math.max(0, Math.trunc(raw.rating)))
        : 0,
    notes: raw.notes && raw.notes !== '' ? raw.notes : null,
    dateAdded: raw.date_added,
    basicInformation: {
      title: raw.basic_information?.title ?? '',
      year: raw.basic_information?.year ?? null,
      artists: (raw.basic_information?.artists ?? []).map((a) => ({ name: a.name })),
      thumb: raw.basic_information?.thumb || null,
    },
  };
}

function wantsPath(connection: DiscogsConnection, releaseId?: number): string {
  const username = encodeURIComponent(connection.discogsUsername);
  return releaseId === undefined
    ? `/users/${username}/wants`
    : `/users/${username}/wants/${releaseId}`;
}

/** Walks every page of `GET /users/{username}/wants`. */
export async function listWants(connection: DiscogsConnection): Promise<WantItem[]> {
  const client = createClient(connection);
  const path = wantsPath(connection);

  const wants: WantItem[] = [];
  let page = 1;
  let pages: number;
  do {
    const response = await client.get(path, {
      params: { page, per_page: WANTS_PAGE_SIZE },
    });
    const body = response.data as RawWantsPage;
    wants.push(...body.wants.map(mapWant));
    pages = body.pagination.pages;
    page += 1;
  } while (page <= pages);

  return wants;
}

/**
 * Single want lookup. Discogs exposes no `GET /users/{username}/wants/{id}`
 * endpoint — the Wantlist resource is list + PUT + DELETE only — so this is
 * derived from `listWants` + `.find`. Resolves `null` when the release is not
 * among the caller's wants. Inherits `listWants`' error mapping.
 */
export async function getWant(
  connection: DiscogsConnection,
  releaseId: number,
): Promise<WantItem | null> {
  const all = await listWants(connection);
  return all.find((want) => want.releaseId === releaseId) ?? null;
}

/** `PUT /users/{username}/wants/{releaseId}` — upsert notes/rating. */
export async function putWant(
  connection: DiscogsConnection,
  releaseId: number,
  fields: { notes?: string; rating?: number },
): Promise<WantItem> {
  const response = await createClient(connection).put(
    wantsPath(connection, releaseId),
    fields,
    // Non-idempotent write: never auto-retried, still circuit-breaker-eligible.
    { __skipRetry: true } as Parameters<AxiosInstance['put']>[2],
  );
  return mapWant(response.data as RawWant);
}

/** `DELETE /users/{username}/wants/{releaseId}`. Throws `DiscogsNotFoundError` on 404. */
export async function deleteWant(
  connection: DiscogsConnection,
  releaseId: number,
): Promise<void> {
  await createClient(connection).delete(wantsPath(connection, releaseId), {
    __skipRetry: true,
  } as Parameters<AxiosInstance['delete']>[1]);
}

export const discogsWantlistAdapter: DiscogsWantlistPort = {
  listWants,
  getWant,
  putWant,
  deleteWant,
};

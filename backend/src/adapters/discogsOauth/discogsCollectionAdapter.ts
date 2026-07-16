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
import {
  fieldsCacheKey,
  type CollectionFieldMap,
  type CollectionInstance,
  type InstanceRef,
} from '../../domain/discogsOauth/collectionTypes';
import type { DiscogsConnection } from '../../domain/discogsOauth/types';
import type { DiscogsCollectionPort } from '../../ports/discogsOauth/discogsCollectionPort';
import { getOauthApiBaseUrl } from './oauthHttpClient';
import { buildProtectedResourceHeader, type ConsumerCredentials } from './oauthSignature';

/**
 * OAuth-signed client for the authenticated Discogs User Collection
 * endpoints. Unlike the app-token catalog client (discogsCatalogAdapter.ts)
 * these calls act as the linked user and can fail with revoked credentials,
 * so 401/403 map to DiscogsAuthError. The base URL is env-overridable (same
 * DISCOGS_OAUTH_BASE_URL the OAuth flow uses) so tests and e2e target stubs.
 */

const COLLECTION_PAGE_SIZE = 100;
const FIELDS_CACHE_TTL_SECONDS = 24 * 60 * 60;

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
 * sequence (feature 040, US3 — mirrors discogsCatalogAdapter.ts's feature 029
 * pattern). `__attempt` tracks which attempt this is (1 = the original
 * request); `__skipRetry` opts a specific call (the non-idempotent
 * `addReleaseToCollection`) out of retry only — the circuit breaker still
 * applies to it.
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
    // Reusing feature 029's shared breaker (also used by discogsCatalogAdapter.ts)
    // — checked first so a breaker-rejected request never pays a throttle
    // delay (contracts/collection-client-resilience.md).
    if (shouldShortCircuit()) {
      return Promise.reject(new CircuitOpenError(config.url ?? 'unknown'));
    }
    // A fresh nonce/timestamp per request, so the header is built here
    // rather than once at client creation.
    config.headers.Authorization = buildProtectedResourceHeader(getCredentials(), {
      token: connection.accessToken,
      tokenSecret: connection.accessTokenSecret,
    });
    // Shared preventive throttle (feature 040) — the catalog and
    // collection clients consume the same per-IP Discogs budget.
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
            message: `Discogs collection ${status}`,
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
          message: 'Discogs collection 429',
        });
        return Promise.reject(new DiscogsRateLimitError(error));
      }

      logger.error({
        route: endpoint,
        outcome: 'unavailable',
        message: error.response
          ? `Discogs collection responded with status ${error.response.status}`
          : error.message,
      });
      return Promise.reject(new DiscogsUnavailableError(error));
    },
  );

  return instance;
}

interface RawNoteValue {
  field_id: number;
  value: string;
}

interface RawInstance {
  instance_id: number;
  folder_id: number;
  rating: number;
  date_added: string;
  basic_information: { id: number };
  notes?: RawNoteValue[];
}

interface RawCollectionPage {
  pagination: { page: number; pages: number };
  releases: RawInstance[];
}

function fieldValue(raw: RawInstance, fieldId: number | null): string | null {
  if (fieldId === null) {
    return null;
  }
  const note = (raw.notes ?? []).find((candidate) => candidate.field_id === fieldId);
  return note && note.value !== '' ? note.value : null;
}

function mapInstance(raw: RawInstance, fieldMap: CollectionFieldMap): CollectionInstance {
  return {
    releaseId: raw.basic_information.id,
    instanceId: raw.instance_id,
    folderId: raw.folder_id,
    rating: raw.rating ?? 0,
    mediaCondition: fieldValue(raw, fieldMap.mediaConditionFieldId),
    sleeveCondition: fieldValue(raw, fieldMap.sleeveConditionFieldId),
    notes: fieldValue(raw, fieldMap.notesFieldId),
    dateAdded: raw.date_added,
  };
}

export async function getFieldMap(
  connection: DiscogsConnection,
): Promise<CollectionFieldMap> {
  return cacheAdapter.withCache(
    fieldsCacheKey(connection.uid),
    FIELDS_CACHE_TTL_SECONDS,
    async () => {
      const response = await createClient(connection).get(
        `/users/${encodeURIComponent(connection.discogsUsername)}/collection/fields`,
      );
      const fields =
        (response.data as { fields?: Array<{ id: number; name: string }> }).fields ?? [];

      const byName = (name: string): number | null =>
        fields.find((field) => field.name === name)?.id ?? null;

      return {
        mediaConditionFieldId: byName('Media Condition'),
        sleeveConditionFieldId: byName('Sleeve Condition'),
        notesFieldId: byName('Notes'),
      };
    },
  );
}

/** Walks every page of folder 0 (the "All" folder) of the user's collection. */
export async function listAllInstances(
  connection: DiscogsConnection,
  prefetchedFieldMap?: CollectionFieldMap,
): Promise<CollectionInstance[]> {
  const fieldMap = prefetchedFieldMap ?? (await getFieldMap(connection));
  const client = createClient(connection);
  const username = encodeURIComponent(connection.discogsUsername);

  const instances: CollectionInstance[] = [];
  let page = 1;
  let pages = 1;
  do {
    const response = await client.get(
      `/users/${username}/collection/folders/0/releases`,
      {
        params: { page, per_page: COLLECTION_PAGE_SIZE },
      },
    );
    const body = response.data as RawCollectionPage;
    instances.push(...body.releases.map((raw) => mapInstance(raw, fieldMap)));
    pages = body.pagination.pages;
    page += 1;
  } while (page <= pages);

  return instances;
}

/** Lists the user's instances of a single release (detail-view fetch). */
export async function getInstancesForRelease(
  connection: DiscogsConnection,
  releaseId: number,
  prefetchedFieldMap?: CollectionFieldMap,
): Promise<CollectionInstance[]> {
  const fieldMap = prefetchedFieldMap ?? (await getFieldMap(connection));
  const response = await createClient(connection).get(
    `/users/${encodeURIComponent(connection.discogsUsername)}/collection/releases/${releaseId}`,
  );
  const body = response.data as { releases: RawInstance[] };
  return body.releases.map((raw) => mapInstance(raw, fieldMap));
}

const UNCATEGORIZED_FOLDER_ID = 1;

export async function addReleaseToCollection(
  connection: DiscogsConnection,
  releaseId: number,
): Promise<{ instanceId: number; folderId: number }> {
  const response = await createClient(connection).post(
    `/users/${encodeURIComponent(connection.discogsUsername)}/collection/folders/${UNCATEGORIZED_FOLDER_ID}/releases/${releaseId}`,
    undefined,
    // Non-idempotent write (spec FR-016): never auto-retried, even though
    // it remains circuit-breaker-eligible — the collector retries manually.
    { __skipRetry: true } as Parameters<AxiosInstance['post']>[2],
  );
  const body = response.data as { instance_id: number };
  return { instanceId: body.instance_id, folderId: UNCATEGORIZED_FOLDER_ID };
}

function instancePath(connection: DiscogsConnection, ref: InstanceRef): string {
  const username = encodeURIComponent(connection.discogsUsername);
  return `/users/${username}/collection/folders/${ref.folderId}/releases/${ref.releaseId}/instances/${ref.instanceId}`;
}

export async function deleteInstance(
  connection: DiscogsConnection,
  ref: InstanceRef,
): Promise<void> {
  await createClient(connection).delete(instancePath(connection, ref));
}

export async function setRating(
  connection: DiscogsConnection,
  ref: InstanceRef,
  rating: number,
): Promise<void> {
  await createClient(connection).post(instancePath(connection, ref), { rating });
}

export async function setFieldValue(
  connection: DiscogsConnection,
  ref: InstanceRef,
  fieldId: number,
  value: string,
): Promise<void> {
  await createClient(connection).post(
    `${instancePath(connection, ref)}/fields/${fieldId}`,
    { value },
  );
}

export const discogsCollectionAdapter: DiscogsCollectionPort = {
  getFieldMap,
  listAllInstances,
  getInstancesForRelease,
  addReleaseToCollection,
  deleteInstance,
  setRating,
  setFieldValue,
};

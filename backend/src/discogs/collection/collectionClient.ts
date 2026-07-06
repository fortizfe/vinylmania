import axios, { type AxiosInstance, isAxiosError } from 'axios';

import { withCache } from '../../cache/cacheAside';
import { logger } from '../../config/logger';
import {
  DiscogsAuthError,
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../discogsErrors';
import { getOauthApiBaseUrl } from '../oauth/oauthHttpClient';
import {
  buildProtectedResourceHeader,
  type ConsumerCredentials,
} from '../oauth/oauthSignature';
import type { DiscogsConnection } from '../oauth/types';
import type { CollectionFieldMap, CollectionInstance, InstanceRef } from './collectionTypes';

/**
 * OAuth-signed client for the authenticated Discogs User Collection
 * endpoints. Unlike the app-token catalog client (discogsClient.ts) these
 * calls act as the linked user and can fail with revoked credentials, so
 * 401/403 map to DiscogsAuthError. The base URL is env-overridable (same
 * DISCOGS_OAUTH_BASE_URL the OAuth flow uses) so tests and e2e target stubs.
 */

const COLLECTION_PAGE_SIZE = 100;
const FIELDS_CACHE_TTL_SECONDS = 24 * 60 * 60;

export function fieldsCacheKey(uid: string): string {
  return `discogs:fields:${uid}`;
}

function getCredentials(): ConsumerCredentials {
  const consumerKey = process.env.DISCOGS_CONSUMER_KEY;
  const consumerSecret = process.env.DISCOGS_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    throw new Error('DISCOGS_CONSUMER_KEY / DISCOGS_CONSUMER_SECRET are not configured');
  }
  return { consumerKey, consumerSecret };
}

function createClient(connection: DiscogsConnection): AxiosInstance {
  const instance = axios.create({
    baseURL: getOauthApiBaseUrl(),
    timeout: 10_000,
    headers: {
      'User-Agent': process.env.DISCOGS_USER_AGENT || 'Vinylmania/0.1',
    },
  });

  instance.interceptors.request.use((config) => {
    // A fresh nonce/timestamp per request, so the header is built here
    // rather than once at client creation.
    config.headers.Authorization = buildProtectedResourceHeader(getCredentials(), {
      token: connection.accessToken,
      tokenSecret: connection.accessTokenSecret,
    });
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
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
    (error: unknown) => {
      const endpoint = isAxiosError(error) ? (error.config?.url ?? 'unknown') : 'unknown';

      if (isAxiosError(error) && error.response) {
        const { status } = error.response;

        if (status === 401 || status === 403) {
          logger.warn({ route: endpoint, outcome: 'auth_failed', message: `Discogs collection ${status}` });
          return Promise.reject(new DiscogsAuthError(error));
        }
        if (status === 404) {
          return Promise.reject(new DiscogsNotFoundError(error));
        }
        if (status === 429) {
          logger.warn({ route: endpoint, outcome: 'rate_limited', message: 'Discogs collection 429' });
          return Promise.reject(new DiscogsRateLimitError(error));
        }

        logger.error({
          route: endpoint,
          outcome: 'unavailable',
          message: `Discogs collection responded with status ${status}`,
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

export async function getFieldMap(connection: DiscogsConnection): Promise<CollectionFieldMap> {
  return withCache(fieldsCacheKey(connection.uid), FIELDS_CACHE_TTL_SECONDS, async () => {
    const response = await createClient(connection).get(
      `/users/${encodeURIComponent(connection.discogsUsername)}/collection/fields`,
    );
    const fields = (response.data as { fields?: Array<{ id: number; name: string }> }).fields ?? [];

    const byName = (name: string): number | null =>
      fields.find((field) => field.name === name)?.id ?? null;

    return {
      mediaConditionFieldId: byName('Media Condition'),
      sleeveConditionFieldId: byName('Sleeve Condition'),
      notesFieldId: byName('Notes'),
    };
  });
}

/** Walks every page of folder 0 (the "All" folder) of the user's collection. */
export async function listAllInstances(
  connection: DiscogsConnection,
  prefetchedFieldMap?: CollectionFieldMap,
): Promise<CollectionInstance[]> {
  const fieldMap = prefetchedFieldMap ?? await getFieldMap(connection);
  const client = createClient(connection);
  const username = encodeURIComponent(connection.discogsUsername);

  const instances: CollectionInstance[] = [];
  let page = 1;
  let pages = 1;
  do {
    const response = await client.get(`/users/${username}/collection/folders/0/releases`, {
      params: { page, per_page: COLLECTION_PAGE_SIZE },
    });
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
  const fieldMap = prefetchedFieldMap ?? await getFieldMap(connection);
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
  await createClient(connection).post(`${instancePath(connection, ref)}/fields/${fieldId}`, { value });
}

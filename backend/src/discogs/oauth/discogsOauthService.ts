import { isAxiosError } from 'axios';

import { invalidateCache } from '../../cache/cacheAside';
import { getFirestoreDb } from '../../config/firebase-admin';
import { logger } from '../../config/logger';
import { fieldsCacheKey } from '../collection/collectionClient';
import {
  createOauthHttpClient,
  getAuthorizeBaseUrl,
  parseTokenResponse,
} from './oauthHttpClient';
import {
  buildAccessTokenHeader,
  buildIdentityHeader,
  buildRequestTokenHeader,
  type ConsumerCredentials,
} from './oauthSignature';
import type { ConnectionStatus, DiscogsConnection } from './types';

const PENDING_COLLECTION = 'discogsOAuthRequests';
const CONNECTIONS_COLLECTION = 'discogsConnections';
const PENDING_TTL_MS = 15 * 60 * 1000; // Discogs' verifier validity window

/**
 * A linking-flow failure the user can act on. `code` maps 1:1 to the error
 * codes in contracts/discogs-oauth-api.md.
 */
export class DiscogsOauthFlowError extends Error {
  constructor(
    public readonly code: 'invalid_request' | 'expired_request' | 'already_connected',
    message: string,
  ) {
    super(message);
    this.name = 'DiscogsOauthFlowError';
  }
}

function getCredentials(): ConsumerCredentials {
  const consumerKey = process.env.DISCOGS_CONSUMER_KEY;
  const consumerSecret = process.env.DISCOGS_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    throw new Error('DISCOGS_CONSUMER_KEY / DISCOGS_CONSUMER_SECRET are not configured');
  }
  return { consumerKey, consumerSecret };
}

function pendingDoc(oauthToken: string) {
  return getFirestoreDb().collection(PENDING_COLLECTION).doc(oauthToken);
}

function connectionDoc(uid: string) {
  return getFirestoreDb().collection(CONNECTIONS_COLLECTION).doc(uid);
}

export async function startLink(uid: string): Promise<{ authorizeUrl: string }> {
  const callbackUrl = process.env.DISCOGS_OAUTH_CALLBACK_URL ?? '';
  const header = buildRequestTokenHeader(getCredentials(), callbackUrl);

  const response = await createOauthHttpClient().get('/oauth/request_token', {
    headers: { Authorization: header },
  });
  const { token, tokenSecret } = parseTokenResponse(String(response.data));

  const now = new Date();
  await pendingDoc(token).set({
    uid,
    requestTokenSecret: tokenSecret,
    createdAt: now,
    expiresAt: new Date(now.getTime() + PENDING_TTL_MS),
  });

  logger.info({ route: 'discogs-oauth', outcome: 'link_started', uid });
  return {
    authorizeUrl: `${getAuthorizeBaseUrl()}?oauth_token=${encodeURIComponent(token)}`,
  };
}

export async function completeLink(
  uid: string,
  oauthToken: string,
  oauthVerifier: string,
): Promise<ConnectionStatus> {
  const snapshot = await pendingDoc(oauthToken).get();

  if (!snapshot.exists) {
    logFailure(uid, 'unknown or already-consumed oauth token');
    throw new DiscogsOauthFlowError('invalid_request', 'Unknown link attempt.');
  }

  const pending = snapshot.data()!;

  if (pending.uid !== uid) {
    // Retain the doc: its rightful owner may still complete the flow.
    logFailure(uid, 'pending link attempt belongs to a different user');
    throw new DiscogsOauthFlowError(
      'invalid_request',
      'Link attempt belongs to another session.',
    );
  }

  if (pending.expiresAt.toDate().getTime() < Date.now()) {
    await pendingDoc(oauthToken).delete();
    logFailure(uid, 'link attempt expired');
    throw new DiscogsOauthFlowError('expired_request', 'Link attempt expired.');
  }

  const credentials = getCredentials();
  const client = createOauthHttpClient();

  let accessToken: string;
  let accessTokenSecret: string;
  try {
    const exchangeResponse = await client.post('/oauth/access_token', undefined, {
      headers: {
        Authorization: buildAccessTokenHeader(credentials, {
          token: oauthToken,
          tokenSecret: pending.requestTokenSecret,
          verifier: oauthVerifier,
        }),
      },
    });
    ({ token: accessToken, tokenSecret: accessTokenSecret } = parseTokenResponse(
      String(exchangeResponse.data),
    ));
  } catch (err) {
    if (
      isAxiosError(err) &&
      err.response &&
      err.response.status >= 400 &&
      err.response.status < 500
    ) {
      // Discogs answers 400 for expired/invalid verifiers — the attempt is dead.
      await pendingDoc(oauthToken).delete();
      logFailure(
        uid,
        `Discogs rejected the token exchange (status ${err.response.status})`,
      );
      throw new DiscogsOauthFlowError('expired_request', 'Link attempt expired.');
    }
    logFailure(uid, err instanceof Error ? err.message : 'token exchange failed');
    throw err;
  }

  const identityResponse = await client.get('/oauth/identity', {
    headers: {
      Authorization: buildIdentityHeader(credentials, {
        token: accessToken,
        tokenSecret: accessTokenSecret,
      }),
    },
  });
  const identity = identityResponse.data as { id: number; username: string };

  const linkedAt = new Date();
  await connectionDoc(uid).set({
    uid,
    discogsUsername: identity.username,
    discogsUserId: identity.id,
    accessToken,
    accessTokenSecret,
    linkedAt,
  });
  await pendingDoc(oauthToken).delete();

  logger.info({
    route: 'discogs-oauth',
    outcome: 'link_completed',
    uid,
    meta: { discogsUsername: identity.username },
  });

  return {
    connected: true,
    discogsUsername: identity.username,
    linkedAt: linkedAt.toISOString(),
  };
}

export async function getConnection(uid: string): Promise<DiscogsConnection | null> {
  const snapshot = await connectionDoc(uid).get();
  if (!snapshot.exists) {
    return null;
  }
  const data = snapshot.data()!;
  return {
    uid: data.uid,
    discogsUsername: data.discogsUsername,
    discogsUserId: data.discogsUserId,
    accessToken: data.accessToken,
    accessTokenSecret: data.accessTokenSecret,
    linkedAt: data.linkedAt.toDate().toISOString(),
    ...(data.initialLibrarySyncAt
      ? { initialLibrarySyncAt: data.initialLibrarySyncAt.toDate().toISOString() }
      : {}),
  };
}

/**
 * Marks the connection's first library synchronization (union merge + legacy
 * migration, feature 016) as completed; later syncs run in mirror mode.
 */
export async function markInitialLibrarySync(uid: string): Promise<void> {
  await connectionDoc(uid).update({ initialLibrarySyncAt: new Date() });
}

export async function getStatus(uid: string): Promise<ConnectionStatus> {
  const connection = await getConnection(uid);
  if (!connection) {
    return { connected: false };
  }
  return {
    connected: true,
    discogsUsername: connection.discogsUsername,
    linkedAt: connection.linkedAt,
  };
}

export async function disconnect(uid: string): Promise<void> {
  await connectionDoc(uid).delete();
  // The cached collection field map belongs to the departing Discogs account.
  await invalidateCache(fieldsCacheKey(uid));
  logger.info({ route: 'discogs-oauth', outcome: 'disconnected', uid });
}

function logFailure(uid: string, message: string): void {
  logger.warn({ route: 'discogs-oauth', outcome: 'link_failed', uid, message });
}

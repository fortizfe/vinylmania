import { isAxiosError } from 'axios';

import { getFirestoreDb } from '../../config/firebase-admin';
import { DiscogsOauthFlowError } from '../../domain/discogsOauth/discogsOauthErrors';
import type { DiscogsConnection, PendingOAuthRequest } from '../../domain/discogsOauth/types';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';
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

const PENDING_COLLECTION = 'discogsOAuthRequests';
const CONNECTIONS_COLLECTION = 'discogsConnections';
const PENDING_TTL_MS = 15 * 60 * 1000; // Discogs' verifier validity window

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

export async function createPendingRequest(uid: string): Promise<{ authorizeUrl: string }> {
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

  return {
    authorizeUrl: `${getAuthorizeBaseUrl()}?oauth_token=${encodeURIComponent(token)}`,
  };
}

export async function getPendingRequest(
  oauthToken: string,
): Promise<PendingOAuthRequest | null> {
  const snapshot = await pendingDoc(oauthToken).get();
  if (!snapshot.exists) {
    return null;
  }
  const data = snapshot.data()!;
  return {
    uid: data.uid,
    requestTokenSecret: data.requestTokenSecret,
    createdAt: data.createdAt.toDate().toISOString(),
    expiresAt: data.expiresAt.toDate().toISOString(),
  };
}

export async function deletePendingRequest(oauthToken: string): Promise<void> {
  await pendingDoc(oauthToken).delete();
}

export async function exchangeAccessToken(
  oauthToken: string,
  requestTokenSecret: string,
  verifier: string,
): Promise<{ accessToken: string; accessTokenSecret: string }> {
  const credentials = getCredentials();
  const client = createOauthHttpClient();

  try {
    const exchangeResponse = await client.post('/oauth/access_token', undefined, {
      headers: {
        Authorization: buildAccessTokenHeader(credentials, {
          token: oauthToken,
          tokenSecret: requestTokenSecret,
          verifier,
        }),
      },
    });
    const { token, tokenSecret } = parseTokenResponse(String(exchangeResponse.data));
    return { accessToken: token, accessTokenSecret: tokenSecret };
  } catch (err) {
    if (
      isAxiosError(err) &&
      err.response &&
      err.response.status >= 400 &&
      err.response.status < 500
    ) {
      // Discogs answers 400 for expired/invalid verifiers — the attempt is dead.
      throw new DiscogsOauthFlowError('expired_request', 'Link attempt expired.');
    }
    throw err;
  }
}

export async function fetchIdentity(
  accessToken: string,
  accessTokenSecret: string,
): Promise<{ discogsUserId: number; discogsUsername: string }> {
  const credentials = getCredentials();
  const identityResponse = await createOauthHttpClient().get('/oauth/identity', {
    headers: {
      Authorization: buildIdentityHeader(credentials, {
        token: accessToken,
        tokenSecret: accessTokenSecret,
      }),
    },
  });
  const identity = identityResponse.data as { id: number; username: string };
  return { discogsUserId: identity.id, discogsUsername: identity.username };
}

export async function saveConnection(
  uid: string,
  connection: Omit<DiscogsConnection, 'uid'>,
): Promise<void> {
  await connectionDoc(uid).set({
    uid,
    discogsUsername: connection.discogsUsername,
    discogsUserId: connection.discogsUserId,
    accessToken: connection.accessToken,
    accessTokenSecret: connection.accessTokenSecret,
    linkedAt: new Date(connection.linkedAt),
    ...(connection.initialLibrarySyncAt
      ? { initialLibrarySyncAt: new Date(connection.initialLibrarySyncAt) }
      : {}),
  });
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

export async function deleteConnection(uid: string): Promise<void> {
  await connectionDoc(uid).delete();
}

/**
 * Marks the connection's first library synchronization (union merge + legacy
 * migration, feature 016) as completed; later syncs run in mirror mode.
 */
export async function markInitialLibrarySync(uid: string): Promise<void> {
  await connectionDoc(uid).update({ initialLibrarySyncAt: new Date() });
}

export const discogsConnectionAdapter: DiscogsConnectionPort = {
  createPendingRequest,
  getPendingRequest,
  deletePendingRequest,
  exchangeAccessToken,
  fetchIdentity,
  saveConnection,
  getConnection,
  deleteConnection,
  markInitialLibrarySync,
};

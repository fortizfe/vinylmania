import { randomUUID } from 'node:crypto';

import axios from 'axios';

import { getFirestoreDb } from '../../config/firebase-admin';
import { GoogleAuthFlowError } from '../../domain/googleAuth/googleAuthErrors';
import type { GoogleIdentity, PendingGoogleLogin } from '../../domain/googleAuth/types';
import type { GoogleIdentityPort } from '../../ports/googleAuth/googleIdentityPort';

const PENDING_COLLECTION = 'pendingGoogleLogins';
const PENDING_TTL_MS = 15 * 60 * 1000; // mirrors the Discogs pending-request window

function getOauthBaseUrl(): string {
  return process.env.GOOGLE_OAUTH_BASE_URL || 'https://accounts.google.com';
}

function getTokenBaseUrl(): string {
  return process.env.GOOGLE_TOKEN_BASE_URL || 'https://oauth2.googleapis.com';
}

function getUserinfoBaseUrl(): string {
  return process.env.GOOGLE_USERINFO_BASE_URL || 'https://openidconnect.googleapis.com';
}

function getClientCredentials(): { clientId: string; clientSecret: string; callbackUrl: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_OAUTH_CALLBACK_URL;
  if (!clientId || !clientSecret || !callbackUrl) {
    throw new Error(
      'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_CALLBACK_URL are not configured',
    );
  }
  return { clientId, clientSecret, callbackUrl };
}

function pendingDoc(state: string) {
  return getFirestoreDb().collection(PENDING_COLLECTION).doc(state);
}

function getAuthorizeUrl(state: string): string {
  const { clientId, callbackUrl } = getClientCredentials();
  const url = new URL('/o/oauth2/v2/auth', getOauthBaseUrl());
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeCodeForIdentity(code: string): Promise<GoogleIdentity> {
  const { clientId, clientSecret, callbackUrl } = getClientCredentials();

  let accessToken: string;
  try {
    const tokenRes = await axios.post(
      `${getTokenBaseUrl()}/token`,
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
      { timeout: 10_000 },
    );
    accessToken = tokenRes.data.access_token;
  } catch {
    throw new GoogleAuthFlowError(
      'exchange_failed',
      'We could not reach the sign-in service. Please try again.',
    );
  }

  try {
    const userinfoRes = await axios.get(`${getUserinfoBaseUrl()}/v1/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10_000,
    });
    const { sub, email, name, picture } = userinfoRes.data as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
    };
    return { sub, email, name, picture };
  } catch {
    throw new GoogleAuthFlowError(
      'exchange_failed',
      'We could not reach the sign-in service. Please try again.',
    );
  }
}

async function createPendingLogin(): Promise<{ state: string }> {
  const state = randomUUID();
  const now = new Date();
  await pendingDoc(state).set({
    createdAt: now,
    expiresAt: new Date(now.getTime() + PENDING_TTL_MS),
  });
  return { state };
}

async function getPendingLogin(state: string): Promise<PendingGoogleLogin | null> {
  const snapshot = await pendingDoc(state).get();
  if (!snapshot.exists) {
    return null;
  }
  const data = snapshot.data()!;
  return {
    state,
    createdAt: data.createdAt.toDate().toISOString(),
    expiresAt: data.expiresAt.toDate().toISOString(),
  };
}

async function deletePendingLogin(state: string): Promise<void> {
  await pendingDoc(state).delete();
}

export const googleIdentityAdapter: GoogleIdentityPort = {
  getAuthorizeUrl,
  exchangeCodeForIdentity,
  createPendingLogin,
  getPendingLogin,
  deletePendingLogin,
};

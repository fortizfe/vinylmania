import { authorizedFetch } from './apiClient';

export type DiscogsConnectionStatus =
  { connected: false } | { connected: true; discogsUsername: string; linkedAt: string };

export async function getDiscogsStatus(): Promise<DiscogsConnectionStatus> {
  const response = await authorizedFetch('/api/discogs/oauth/status');
  return response.json();
}

export async function requestDiscogsLink(): Promise<{ authorizeUrl: string }> {
  const response = await authorizedFetch('/api/discogs/oauth/request', {
    method: 'POST',
  });
  return response.json();
}

export async function completeDiscogsLink(
  oauthToken: string,
  oauthVerifier: string,
): Promise<DiscogsConnectionStatus> {
  const response = await authorizedFetch('/api/discogs/oauth/complete', {
    method: 'POST',
    body: JSON.stringify({ oauthToken, oauthVerifier }),
  });
  return response.json();
}

export async function disconnectDiscogs(): Promise<void> {
  await authorizedFetch('/api/discogs/oauth/connection', { method: 'DELETE' });
}

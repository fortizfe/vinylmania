import { randomBytes } from 'node:crypto';

/**
 * OAuth 1.0a Authorization headers with the PLAINTEXT signature method,
 * as recommended by the Discogs API documentation for HTTPS requests.
 * The signature is the consumer secret plus '&' plus the token secret
 * (empty for the request-token step) — no base-string signing involved.
 */

export interface ConsumerCredentials {
  consumerKey: string;
  consumerSecret: string;
}

function formatHeader(params: Record<string, string>): string {
  const parts = Object.entries(params).map(([key, value]) => `${key}="${value}"`);
  return `OAuth ${parts.join(', ')}`;
}

function baseParams(credentials: ConsumerCredentials, tokenSecret: string): Record<string, string> {
  return {
    oauth_consumer_key: credentials.consumerKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature: `${credentials.consumerSecret}&${tokenSecret}`,
    oauth_signature_method: 'PLAINTEXT',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
  };
}

export function buildRequestTokenHeader(
  credentials: ConsumerCredentials,
  callbackUrl: string,
): string {
  return formatHeader({
    ...baseParams(credentials, ''),
    oauth_callback: callbackUrl,
  });
}

export function buildAccessTokenHeader(
  credentials: ConsumerCredentials,
  request: { token: string; tokenSecret: string; verifier: string },
): string {
  return formatHeader({
    ...baseParams(credentials, request.tokenSecret),
    oauth_token: request.token,
    oauth_verifier: request.verifier,
  });
}

export function buildIdentityHeader(
  credentials: ConsumerCredentials,
  access: { token: string; tokenSecret: string },
): string {
  return formatHeader({
    ...baseParams(credentials, access.tokenSecret),
    oauth_token: access.token,
  });
}

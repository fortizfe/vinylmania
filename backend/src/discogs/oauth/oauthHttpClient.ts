import axios, { isAxiosError, type AxiosInstance } from 'axios';

import { logger } from '../../config/logger';
import { DiscogsRateLimitError, DiscogsUnavailableError } from '../discogsErrors';

/**
 * Dedicated HTTP client for Discogs' OAuth endpoints. Token exchanges are
 * one-shot, side-effecting requests, so unlike the catalog client this one
 * never caches. Base URLs are env-overridable so tests and e2e can target
 * a local stub instead of the real Discogs hosts.
 */

export function getOauthApiBaseUrl(): string {
  return process.env.DISCOGS_OAUTH_BASE_URL || 'https://api.discogs.com';
}

export function getAuthorizeBaseUrl(): string {
  return (
    process.env.DISCOGS_AUTHORIZE_BASE_URL || 'https://www.discogs.com/oauth/authorize'
  );
}

export function createOauthHttpClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: getOauthApiBaseUrl(),
    timeout: 10_000,
    headers: {
      'User-Agent': process.env.DISCOGS_USER_AGENT || 'Vinylmania/0.1',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  instance.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const endpoint = isAxiosError(error) ? (error.config?.url ?? 'unknown') : 'unknown';

      if (isAxiosError(error) && error.response) {
        const { status } = error.response;

        if (status === 429) {
          logger.warn({
            route: endpoint,
            outcome: 'rate_limited',
            message: 'Discogs OAuth 429',
          });
          return Promise.reject(new DiscogsRateLimitError(error));
        }

        if (status >= 400 && status < 500) {
          // Flow-specific failures (expired verifier, bad token) surface as
          // 400s from Discogs; let the service map them to user-facing codes.
          return Promise.reject(error);
        }

        logger.error({
          route: endpoint,
          outcome: 'unavailable',
          message: `Discogs OAuth responded with status ${status}`,
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

/** Parses an `application/x-www-form-urlencoded` token response body. */
export function parseTokenResponse(body: string): { token: string; tokenSecret: string } {
  const params = new URLSearchParams(body);
  const token = params.get('oauth_token');
  const tokenSecret = params.get('oauth_token_secret');

  if (!token || !tokenSecret) {
    throw new DiscogsUnavailableError(
      new Error('Discogs OAuth response missing oauth_token/oauth_token_secret'),
    );
  }

  return { token, tokenSecret };
}

import { clearSessionToken, getSessionToken } from './sessionStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/** Registered by AuthContext so a 401 from any request can clear the signed-in user. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

export async function authorizedFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getSessionToken();

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: 'unknown', message: 'Request failed' }));
    // A 401 clears the vinylmania session — except `discogs_link_invalid`
    // (spec 053), which means the caller's *linked Discogs account* was
    // rejected, not their vinylmania session; clearing the session here
    // would redirect away before the caller's own relink-prompt UI ever
    // gets a chance to render.
    if (response.status === 401 && body.error !== 'discogs_link_invalid') {
      clearSessionToken();
      onUnauthorized?.();
    }
    throw new ApiError(
      body.message ?? 'Request failed',
      response.status,
      body.error ?? 'unknown',
    );
  }

  return response;
}

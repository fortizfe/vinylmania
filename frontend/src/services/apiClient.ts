import { firebaseAuth } from './firebaseClient';

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

export async function authorizedFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const user = firebaseAuth.currentUser;
  const idToken = await user?.getIdToken();

  const headers = new Headers(options.headers);
  if (idToken) {
    headers.set('Authorization', `Bearer ${idToken}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: 'unknown', message: 'Request failed' }));
    throw new ApiError(
      body.message ?? 'Request failed',
      response.status,
      body.error ?? 'unknown',
    );
  }

  return response;
}

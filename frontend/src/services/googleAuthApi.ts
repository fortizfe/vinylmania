import type { UserProfile } from '../auth/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export interface CompleteGoogleLoginInput {
  state: string;
  code?: string;
  error?: string;
}

export interface CompleteGoogleLoginResult {
  sessionToken: string;
  user: UserProfile;
}

export class GoogleAuthApiError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'GoogleAuthApiError';
    this.code = code;
  }
}

/**
 * No session exists yet at this point in the flow, so this is a plain,
 * unauthenticated `fetch` — it deliberately does not go through
 * `authorizedFetch`.
 */
export async function completeGoogleLogin(
  input: CompleteGoogleLoginInput,
): Promise<CompleteGoogleLoginResult> {
  const response = await fetch(`${API_BASE_URL}/api/auth/google/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: 'unknown', message: 'Sign-in failed.' }));
    throw new GoogleAuthApiError(body.message ?? 'Sign-in failed.', body.error ?? 'unknown');
  }

  return response.json();
}

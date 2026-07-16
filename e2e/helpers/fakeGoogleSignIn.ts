import type { Page } from '@playwright/test';

export interface FakeGoogleIdentity {
  displayName: string;
  email: string;
}

interface SignInOptions {
  displayName?: string;
  email?: string;
}

// Doubled under CI (spec 042): a shared runner running the Firestore
// emulator alongside all webServer dev processes and Chromium has less
// headroom than a local dev machine for the redirect chain (backend →
// google stub → frontend callback) to settle.
const DEFAULT_TIMEOUT = process.env.CI ? 30_000 : 15_000;

/**
 * Drives the app's real "Sign in with Google" control through a full-page
 * redirect chain — backend `/api/auth/google/authorize` → the local Google
 * OAuth stub (`googleOauthStub.ts`, never real Google) → the frontend's
 * `/login/callback` — per `contracts/google-login-api.md`. Replaces the
 * previous popup-based flow (`signInWithPopup` against the Firebase Auth
 * Emulator) now that the frontend no longer uses a client-side SDK.
 */
export async function signInAsFakeGoogleUser(
  page: Page,
  options: SignInOptions = {},
): Promise<FakeGoogleIdentity> {
  const unique = Date.now();
  const identity: FakeGoogleIdentity = {
    displayName: options.displayName ?? `E2E Test User ${unique}`,
    email: options.email ?? `e2e-user-${unique}@example.com`,
  };

  try {
    await page.getByRole('button', { name: /sign in with google/i }).click();
    await page.waitForSelector('#approve', { timeout: DEFAULT_TIMEOUT });
  } catch (cause) {
    throw new Error(
      'signInAsFakeGoogleUser: the redirect to the Google stub authorize page never landed',
      { cause },
    );
  }

  try {
    await page.locator('#email-input').fill(identity.email);
    await page.locator('#display-name-input').fill(identity.displayName);
    await page.locator('#approve').click();
  } catch (cause) {
    throw new Error(
      'signInAsFakeGoogleUser: could not complete the stub authorize form',
      { cause },
    );
  }

  try {
    await page.waitForURL(/\/app$/, { timeout: DEFAULT_TIMEOUT });
  } catch (cause) {
    throw new Error(
      'signInAsFakeGoogleUser: the app never reached the authenticated state (/app) after sign-in',
      { cause },
    );
  }

  return identity;
}

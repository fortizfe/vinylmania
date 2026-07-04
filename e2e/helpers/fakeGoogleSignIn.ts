import type { Page } from '@playwright/test';

export interface FakeGoogleIdentity {
  displayName: string;
  email: string;
}

interface SignInOptions {
  displayName?: string;
  email?: string;
}

const DEFAULT_TIMEOUT = 15_000;

/**
 * Drives the app's real "Sign in with Google" control through the Firebase
 * Auth emulator's fake identity-provider popup (never real Google), per
 * contracts/e2e-sign-in-helper.md. The popup's DOM (#add-account-button,
 * #email-input, #display-name-input, #sign-in) is the Auth Emulator's own
 * fixture UI, not something this project controls, but its ids have been
 * stable across firebase-tools releases.
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

  let popup;
  try {
    const popupPromise = page.waitForEvent('popup', { timeout: DEFAULT_TIMEOUT });
    await page.getByRole('button', { name: /sign in with google/i }).click();
    popup = await popupPromise;
  } catch (cause) {
    throw new Error('signInAsFakeGoogleUser: the fake Google popup never appeared', {
      cause,
    });
  }

  try {
    await popup.waitForLoadState('domcontentloaded');
    await popup.locator('#add-account-button button').click();
    await popup.locator('#email-input').fill(identity.email);
    await popup.locator('#display-name-input').fill(identity.displayName);
    await popup.locator('#sign-in').click();
  } catch (cause) {
    throw new Error(
      'signInAsFakeGoogleUser: could not complete the fake-account form in the emulator popup',
      { cause },
    );
  }

  try {
    await popup.waitForEvent('close', { timeout: DEFAULT_TIMEOUT });
  } catch (cause) {
    throw new Error(
      'signInAsFakeGoogleUser: the fake Google popup never closed after submitting',
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

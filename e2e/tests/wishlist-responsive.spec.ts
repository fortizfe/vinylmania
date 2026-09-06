/**
 * E2E spec: Wishlist page responsive layout (feature 060)
 *
 * Feature 060 replaced the old `UnderConstruction` wishlist placeholder with
 * the real `WishlistPage` — a Discogs-wantlist-backed responsive grid of
 * `WantlistCard`s (`<h1>Your wishlist</h1>`, `data-testid="wishlist-grid"`).
 * This spec mirrors `library-list-responsive.spec.ts`: it only checks the
 * dual mobile / desktop layout, the nav entry's reachability at both sizes,
 * and that the remove-confirmation dialog is usable on a phone. Functional
 * wantlist behaviour (add / edit / remove / buy) lives in
 * `wishlist-discogs-sync.spec.ts` and is not duplicated here.
 *
 * Runs against the full stack + Discogs stub (see playwright.config.ts), the
 * same hermetic setup `wishlist-discogs-sync.spec.ts` uses.
 */

import { expect, test, type Page } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const STUB_URL = 'http://localhost:4571';
const STUB_USERNAME = 'e2e-discogs-user';

/** Signs in with a fresh identity and links Discogs via the stub authorize page. */
async function signInAndLinkDiscogs(page: Page): Promise<void> {
  await page.goto('/');
  await signInAsFakeGoogleUser(page);

  await page.goto('/app/profile');
  await page.getByRole('button', { name: /connect discogs account/i }).click();
  await expect(page.getByRole('heading', { name: /discogs authorization/i })).toBeVisible();
  await page.locator('#authorize').click();
  await expect(page).toHaveURL(/\/app\/profile$/);
  await expect(page.getByText('e2e-discogs-user')).toBeVisible();
}

/** Seeds (replaces) the stub wantlist for the linked user. */
async function seedWantlist(releaseIds: number[]): Promise<void> {
  const res = await fetch(`${STUB_URL}/__stub/wants/${STUB_USERNAME}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wants: releaseIds.map((releaseId) => ({ releaseId })) }),
  });
  if (!res.ok) throw new Error(`Failed to seed stub wantlist: ${res.status}`);
}

function columnCount(page: Page): Promise<number> {
  return page.getByTestId('wishlist-grid').evaluate((el) => {
    const style = window.getComputedStyle(el);
    return style.gridTemplateColumns.split(' ').length;
  });
}

function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

test.beforeEach(async () => {
  await fetch(`${STUB_URL}/__stub/reset`, { method: 'POST' });
});

test.describe('Wishlist page responsive layout (feature 060)', () => {
  test('desktop: the wantlist grid uses a deliberate multi-column composition', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seedWantlist([701, 702, 703, 704, 705, 706]);

    await signInAndLinkDiscogs(page);
    await page.goto('/app/wishlist');

    await expect(page.getByRole('heading', { name: 'Your wishlist' })).toBeVisible();
    await expect(page.getByTestId('wishlist-grid')).toBeVisible({ timeout: 15_000 });

    expect(await columnCount(page)).toBe(5);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test('mobile: single column, no horizontal scroll, pagination controls meet 44x44px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seedWantlist([701, 702, 703, 704]);

    await signInAndLinkDiscogs(page);
    await page.goto('/app/wishlist');

    await expect(page.getByRole('heading', { name: 'Your wishlist' })).toBeVisible();
    await expect(page.getByTestId('wishlist-grid')).toBeVisible({ timeout: 15_000 });

    expect(await columnCount(page)).toBe(1);
    expect(await hasHorizontalScroll(page)).toBe(false);

    const nextButton = page.getByRole('button', { name: 'Next' });
    const box = await nextButton.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test('resizing live across the sm/xl breakpoints re-lays-out with no navigation/reload', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seedWantlist([701, 702, 703, 704]);

    await signInAndLinkDiscogs(page);
    await page.goto('/app/wishlist');
    await expect(page.getByTestId('wishlist-grid')).toBeVisible({ timeout: 15_000 });
    expect(await columnCount(page)).toBe(5);

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('heading', { name: 'Your wishlist' })).toBeVisible();
    expect(await columnCount(page)).toBe(1);

    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await columnCount(page)).toBe(5);
    await expect(page).toHaveURL(/\/app\/wishlist$/);
  });
});

test.describe('Wishlist nav entry reachable at both sizes (feature 060)', () => {
  test('desktop: the "My wishlist" header icon link routes to the wishlist', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const wishlistIcon = page.getByRole('link', { name: /my wishlist/i });
    await expect(wishlistIcon).toBeVisible();
    await expect(page.getByRole('button', { name: /^menu$/i })).toBeHidden();

    await wishlistIcon.click();
    await expect(page).toHaveURL(/\/app\/wishlist$/);
    await expect(page.getByRole('heading', { name: 'Your wishlist' })).toBeVisible();
  });

  test('mobile: the "My wishlist" entry is reachable through the hamburger menu', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await expect(page.getByRole('link', { name: /my wishlist/i })).toBeHidden();
    await page.getByRole('button', { name: /^menu$/i }).click();

    const dialog = page.getByRole('dialog');
    const wishlistLink = dialog.getByRole('link', { name: /my wishlist/i });
    await expect(wishlistLink).toBeVisible();

    await wishlistLink.click();
    await expect(page).toHaveURL(/\/app\/wishlist$/);
    await expect(page.getByRole('heading', { name: 'Your wishlist' })).toBeVisible();
  });
});

test.describe('Wishlist remove dialog on a mobile viewport (feature 060, FR-011)', () => {
  test('mobile: the remove-confirmation dialog opens, is legible, and Cancel dismisses it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seedWantlist([701, 702]);

    await signInAndLinkDiscogs(page);
    await page.goto('/app/wishlist');
    await expect(page.getByTestId('wishlist-grid')).toBeVisible({ timeout: 15_000 });

    const card = page.locator('li', { hasText: 'Stub Release 701' });
    await card.getByRole('button', { name: 'Remove from wishlist' }).click();

    const dialog = page.getByRole('dialog', { name: 'Remove from wishlist?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Remove' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // The dialog must not force the page to scroll sideways on a phone.
    expect(await hasHorizontalScroll(page)).toBe(false);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card).toBeVisible();
  });
});

test.describe('Wishlist WCAG 2.1 AA automated scan (spec 058, US1)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`has no automatically detectable WCAG 2.1 AA violations in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await seedWantlist([701, 702, 703]);

      await signInAndLinkDiscogs(page);
      await page.goto('/app/wishlist');
      await expect(page.getByRole('heading', { name: 'Your wishlist' })).toBeVisible();
      await expect(page.getByTestId('wishlist-grid')).toBeVisible({ timeout: 15_000 });

      const seriousOrCritical = await runAxeScan(page);

      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }
});

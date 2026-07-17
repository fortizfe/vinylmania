import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

function buildLibraryResponse(count: number) {
  return {
    items: Array.from({ length: count }, (_, i) => ({
      id: `entry-${i}`,
      discogsReleaseId: i,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok',
      release: {
        discogsId: i,
        title: `Record ${i}`,
        artists: [{ discogsArtistId: i, name: 'Test Artist' }],
        labels: [],
        formats: [],
        genres: [],
        styles: [],
        tracklist: [],
        images: [],
        discogsUrl: `https://www.discogs.com/release/${i}`,
      },
    })),
    page: 1,
    pageSize: 20,
    totalItems: count,
  };
}

async function goToLibrary(page: import('@playwright/test').Page, count: number) {
  await page.route('**/api/library*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildLibraryResponse(count)),
    });
  });

  await page.goto('/');
  await signInAsFakeGoogleUser(page);
  await page.goto('/app/library');
  await expect(page.getByTestId('library-record-grid')).toBeVisible();
}

test.describe('Library page responsive layout (spec 035, US1)', () => {
  test('desktop: record grid uses a deliberate multi-column composition (Scenario 5)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goToLibrary(page, 12);

    const grid = page.getByTestId('library-record-grid');
    const columnCount = await grid.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.gridTemplateColumns.split(' ').length;
    });
    expect(columnCount).toBe(5);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('mobile: single column, no horizontal scroll, and pagination controls meet 44x44px (Scenario 6)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await goToLibrary(page, 25);

    const grid = page.getByTestId('library-record-grid');
    const columnCount = await grid.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.gridTemplateColumns.split(' ').length;
    });
    expect(columnCount).toBe(1);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    const nextButton = page.getByRole('button', { name: 'Next' });
    const box = await nextButton.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test('mobile: the "link Discogs account" control meets 44x44px when the account is unlinked (Scenario 6 edge case)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.route('**/api/library*', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'discogs_not_linked', message: 'Not linked' }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');

    const link = page.getByRole('link', { name: /go to your profile/i });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});

test.describe('List mode (feature 052, US2)', () => {
  function buildListResponse() {
    return {
      items: [
        {
          id: 'entry-1',
          discogsReleaseId: 1,
          addedAt: '2026-07-03T00:00:00.000Z',
          catalogStatus: 'ok',
          release: {
            discogsId: 1,
            title: 'Stockholm',
            year: 1999,
            country: 'Sweden',
            artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
            labels: [{ discogsLabelId: 1, name: 'Svek' }],
            formats: [{ name: 'Vinyl', descriptions: [] }],
            genres: [],
            styles: [],
            tracklist: [],
            images: [],
            discogsUrl: 'https://www.discogs.com/release/1',
          },
        },
      ],
      page: 1,
      pageSize: 20,
      totalItems: 25,
    };
  }

  test('shows all six fields per row and pagination still works', async ({ page }) => {
    await page.route('**/api/library*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildListResponse()),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByTestId('library-record-grid')).toBeVisible();

    await page.getByTestId('view-mode-list').click();
    await expect(page.getByTestId('library-record-list')).toBeVisible();

    await expect(page.getByText('Stockholm')).toBeVisible();
    await expect(page.getByText('The Persuader')).toBeVisible();
    await expect(page.getByText('Vinyl')).toBeVisible();
    await expect(page.getByText('Sweden')).toBeVisible();
    await expect(page.getByText('1999')).toBeVisible();
    await expect(page.getByText('Svek')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  test('mobile: list mode has no horizontal scroll and title/artist remain legible', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.route('**/api/library*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildListResponse()),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByTestId('library-record-grid')).toBeVisible();

    await page.getByTestId('view-mode-list').click();
    await expect(page.getByTestId('library-record-list')).toBeVisible();
    await expect(page.getByText('Stockholm')).toBeVisible();
    await expect(page.getByText('The Persuader')).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});

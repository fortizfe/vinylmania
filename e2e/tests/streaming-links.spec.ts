import { expect, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const RELEASE_ID = 1;

const APPLE_MUSIC_URL = 'https://music.apple.com/es/album/x/123';

const searchResponse = {
  results: [
    {
      discogsId: RELEASE_ID,
      resultType: 'release',
      title: 'Stockholm',
      artist: 'The Persuader',
      year: 1999,
      formats: ['Vinyl'],
    },
  ],
  pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
};

const releaseResponse = {
  discogsId: RELEASE_ID,
  title: 'Stockholm',
  year: 1999,
  country: 'Sweden',
  releaseDate: '1999-05-01',
  artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
  labels: [{ discogsLabelId: 5, name: 'Svek', catalogNumber: 'SK032' }],
  formats: [{ name: 'Vinyl', descriptions: ['12"'] }],
  genres: ['Electronic'],
  styles: ['Deep House'],
  notes: 'Recorded at Stockholm Sound Studio.',
  identifiers: [{ type: 'Barcode', value: '7 39051 23421 6' }],
  community: { have: 214, want: 58, rating: { average: 4.3, count: 37 } },
  tracklist: [{ position: 'A', title: 'Östermalm', duration: '4:45' }],
  images: [
    { url: 'https://example.com/cover-front.jpg', imageType: 'primary' },
    { url: 'https://example.com/cover-back.jpg', imageType: 'secondary' },
  ],
  discogsUrl: 'https://www.discogs.com/release/1',
};

// Fakes the Discogs/library/streaming endpoints at the browser network
// boundary (Playwright route interception), same rationale as the other
// search/detail e2e suites — the live Discogs API and the iTunes Search API
// are rate-limited and CI has no reliable access to them. This still drives
// the real release detail page, the real `StreamingLinksSection`, and a real
// browser rendering the resolved (or absent) Apple Music link.
test.describe('Streaming links section (feature 062, US1)', () => {
  async function stubSearchAndRelease(page: import('@playwright/test').Page) {
    await page.route('**/api/discogs/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(searchResponse),
      });
    });
    await page.route(`**/api/discogs/releases/${RELEASE_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(releaseResponse),
      });
    });
  }

  async function stubStreamingLinks(
    page: import('@playwright/test').Page,
    body: { links: Array<{ platform: string; url: string }> },
  ) {
    await page.route('**/api/streaming/links**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });
  }

  test('a record matched on Apple Music shows the "Escúchalo en streaming" section with a single-click new-tab link (US1, FR-001, FR-004, FR-010)', async ({
    page,
  }) => {
    await stubSearchAndRelease(page);
    await stubStreamingLinks(page, {
      links: [{ platform: 'apple_music', url: APPLE_MUSIC_URL }],
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto(`/app/releases/${RELEASE_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const streamingHeading = page.getByRole('heading', { name: /escúchalo en streaming/i });
    await expect(streamingHeading).toBeVisible();

    const appleMusicLink = page.getByRole('link', { name: 'Escuchar en Apple Music' });
    await expect(appleMusicLink).toBeVisible();
    await expect(appleMusicLink).toHaveText(/apple music/i);
    await expect(appleMusicLink).toHaveAttribute('href', APPLE_MUSIC_URL);
    await expect(appleMusicLink).toHaveAttribute('target', '_blank');
    await expect(appleMusicLink).toHaveAttribute('rel', /noopener/);

    const seriousOrCritical = await runAxeScan(page);
    expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
  });

  test('a record with no Apple Music match renders no streaming section and no broken link, leaving the rest of the page intact (US1, FR-004, FR-009, FR-014)', async ({
    page,
  }) => {
    await stubSearchAndRelease(page);
    await stubStreamingLinks(page, { links: [] });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto(`/app/releases/${RELEASE_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    // The rest of the detail page still renders normally (FR-014).
    await expect(page.getByText('Sweden')).toBeVisible();
    await expect(page.getByText('Tracklist')).toBeVisible();
    await expect(page.getByText('Östermalm')).toBeVisible();

    // No section, no heading, no link, no placeholder card (FR-004 / FR-009).
    await expect(
      page.getByRole('heading', { name: /escúchalo en streaming/i }),
    ).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Escuchar en Apple Music' })).toHaveCount(0);
    await expect(page.getByTestId('record-detail-streaming-card')).toHaveCount(0);

    const seriousOrCritical = await runAxeScan(page);
    expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
  });
});

const MASTER_ID = 1660109;
const ENTRY_ID = 'e2e-streaming-entry-1';

const masterSearchResponse = {
  results: [
    {
      discogsId: MASTER_ID,
      resultType: 'master',
      title: 'Hybrid Theory',
      artist: 'Linkin Park',
      year: 2000,
      formats: ['Vinyl'],
    },
  ],
  pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
};

const masterResponse = {
  discogsId: MASTER_ID,
  title: 'Hybrid Theory',
  year: 2000,
  artists: [{ discogsArtistId: 1, name: 'Linkin Park' }],
  genres: ['Rock'],
  styles: ['Nu Metal'],
  images: [{ url: 'https://example.com/cover.jpg', imageType: 'primary' }],
  tracklist: [{ position: '1', title: 'Papercut', duration: '3:05' }],
  mainReleaseId: 98765,
  discogsUrl: 'https://www.discogs.com/master/1660109',
};

function masterVersionsResponse(page: number) {
  return {
    results: [
      {
        discogsId: 98765,
        title: 'Hybrid Theory',
        format: 'Vinyl, LP, Album',
        year: 2000,
        label: 'Warner Bros. Records',
        country: 'US',
      },
    ],
    pagination: { page, pages: 1, items: 1, perPage: 10 },
  };
}

const libraryEntryResponse = {
  id: ENTRY_ID,
  discogsReleaseId: RELEASE_ID,
  addedAt: '2026-07-04T00:00:00.000Z',
  catalogStatus: 'ok',
  release: releaseResponse,
  discogs: {
    instanceId: 100,
    folderId: 1,
    rating: 0,
    mediaCondition: 'Good (G)',
    sleeveCondition: null,
    notes: 'Bought at a record fair',
    editable: { mediaCondition: true, sleeveCondition: true, notes: true },
  },
};

// The identical `StreamingLinksSection` is mounted last on the master and the
// library-record detail surfaces too (feature 062, US2 — T027/T028). Same
// browser-boundary route interception as US1: the live iTunes Search API is
// rate-limited and CI cannot reach it, so `**/api/streaming/links**` is stubbed
// while the real section, hook, and anchor rendering are exercised for real.
test.describe('Streaming links section (feature 062, US2)', () => {
  async function stubMaster(page: import('@playwright/test').Page) {
    await page.route('**/api/discogs/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(masterSearchResponse),
      });
    });
    await page.route(`**/api/discogs/masters/${MASTER_ID}/versions**`, async (route) => {
      const url = new URL(route.request().url());
      const requestedPage = Number(url.searchParams.get('page') ?? '1');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(masterVersionsResponse(requestedPage)),
      });
    });
    await page.route(`**/api/discogs/masters/${MASTER_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(masterResponse),
      });
    });
  }

  async function stubLibraryEntry(page: import('@playwright/test').Page) {
    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(libraryEntryResponse),
      });
    });
  }

  async function stubStreamingLinks(
    page: import('@playwright/test').Page,
    body: { links: Array<{ platform: string; url: string }> },
  ) {
    await page.route('**/api/streaming/links**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });
  }

  test('the "Escúchalo en streaming" section + Apple Music link appears on a MASTER detail page (FR-002, SC-007)', async ({
    page,
  }) => {
    await stubMaster(page);
    await stubStreamingLinks(page, {
      links: [{ platform: 'apple_music', url: APPLE_MUSIC_URL }],
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto(`/app/masters/${MASTER_ID}`);
    await expect(page.getByRole('heading', { name: 'Hybrid Theory' })).toBeVisible();

    await expect(
      page.getByRole('heading', { name: /escúchalo en streaming/i }),
    ).toBeVisible();

    const appleMusicLink = page.getByRole('link', { name: 'Escuchar en Apple Music' });
    await expect(appleMusicLink).toBeVisible();
    await expect(appleMusicLink).toHaveText(/apple music/i);
    await expect(appleMusicLink).toHaveAttribute('href', APPLE_MUSIC_URL);
    await expect(appleMusicLink).toHaveAttribute('target', '_blank');
    await expect(appleMusicLink).toHaveAttribute('rel', /noopener/);

    const seriousOrCritical = await runAxeScan(page);
    expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
  });

  test('the "Escúchalo en streaming" section + Apple Music link appears on a LIBRARY RECORD detail page (FR-002)', async ({
    page,
  }) => {
    await stubLibraryEntry(page);
    await stubStreamingLinks(page, {
      links: [{ platform: 'apple_music', url: APPLE_MUSIC_URL }],
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto(`/app/library/records/${ENTRY_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    await expect(
      page.getByRole('heading', { name: /escúchalo en streaming/i }),
    ).toBeVisible();

    const appleMusicLink = page.getByRole('link', { name: 'Escuchar en Apple Music' });
    await expect(appleMusicLink).toBeVisible();
    await expect(appleMusicLink).toHaveText(/apple music/i);
    await expect(appleMusicLink).toHaveAttribute('href', APPLE_MUSIC_URL);
    await expect(appleMusicLink).toHaveAttribute('target', '_blank');
    await expect(appleMusicLink).toHaveAttribute('rel', /noopener/);

    const seriousOrCritical = await runAxeScan(page);
    expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
  });

  test('SC-007: the same stubbed streaming result renders an identical link on the release page and the master page', async ({
    page,
  }) => {
    // One API body, served to every surface regardless of the query params it
    // was called with — a lightweight stand-in for "the same record identity
    // resolves to the same link everywhere" (FR-002, SC-007).
    await stubStreamingLinks(page, {
      links: [{ platform: 'apple_music', url: APPLE_MUSIC_URL }],
    });
    await page.route(`**/api/discogs/releases/${RELEASE_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(releaseResponse),
      });
    });
    await stubMaster(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto(`/app/releases/${RELEASE_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();
    const releaseLink = page.getByRole('link', { name: 'Escuchar en Apple Music' });
    await expect(releaseLink).toBeVisible();
    const releaseHref = await releaseLink.getAttribute('href');
    const releaseName = await releaseLink.getAttribute('aria-label');

    await page.goto(`/app/masters/${MASTER_ID}`);
    await expect(page.getByRole('heading', { name: 'Hybrid Theory' })).toBeVisible();
    const masterLink = page.getByRole('link', { name: 'Escuchar en Apple Music' });
    await expect(masterLink).toBeVisible();
    const masterHref = await masterLink.getAttribute('href');
    const masterName = await masterLink.getAttribute('aria-label');

    expect(releaseHref).toBe(APPLE_MUSIC_URL);
    expect(masterHref).toBe(releaseHref);
    expect(masterName).toBe(releaseName);
  });
});

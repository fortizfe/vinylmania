import { expect, type Page, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import {
  collectMotionFrames,
  expectJumpNotGlide,
  expectNoTransformMotion,
  startMotionRecorder,
} from '../helpers/motion';

/**
 * Spec 059 — User Story 2, SC-004.
 *
 * With `prefers-reduced-motion: reduce`, every in-scope animated component
 * collapses to opacity-only (or an instant swap): mid-transition NO element
 * translates or scales from these animations, and skeleton loaders do not
 * pulse (`animation-name` computes to `none`).
 *
 * `emulateMedia({ reducedMotion: 'reduce' })` drives the live
 * `usePrefersReducedMotion()` (`matchMedia`) hook in every component, so both
 * the `data-reduced-motion` attributes and the motion behaviour flip.
 */

const RELEASE_ID = 1;

const releaseResponse = {
  discogsId: RELEASE_ID,
  title: 'Stockholm',
  year: 1999,
  country: 'Sweden',
  artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
  labels: [{ discogsLabelId: 5, name: 'Svek', catalogNumber: 'SK032' }],
  formats: [{ name: 'Vinyl', descriptions: ['12"'] }],
  genres: ['Electronic'],
  styles: ['Deep House'],
  tracklist: [{ position: 'A', title: 'Ostermalm', duration: '4:45' }],
  images: [
    { url: 'https://example.com/cover-front.jpg', imageType: 'primary' },
    { url: 'https://example.com/cover-back.jpg', imageType: 'secondary' },
  ],
  discogsUrl: 'https://www.discogs.com/release/1',
};

function libraryEntry(id: string, title: string) {
  return {
    id,
    discogsReleaseId: 1,
    addedAt: '2026-07-03T00:00:00.000Z',
    catalogStatus: 'ok',
    release: {
      discogsId: 1,
      title,
      artists: [{ discogsArtistId: 1, name: 'Test Artist' }],
      labels: [],
      formats: [],
      genres: [],
      styles: [],
      tracklist: [],
      images: [],
      discogsUrl: 'https://www.discogs.com/release/1',
    },
  };
}

async function mockLibrary(page: Page) {
  await page.route('**/api/library*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [libraryEntry('entry-1', 'Stockholm'), libraryEntry('entry-2', 'Berlin')],
        page: 1,
        pageSize: 20,
        totalItems: 2,
      }),
    });
  });
}

/**
 * Spec 068 / US3 (research D22): the collapsible filter panel and its centred
 * `SelectableListFilter` modal are gone from `/app/library` — its filters are
 * a "Filters" end-drawer (>= 640 px) and a "Sort & Filter" bottom sheet
 * (< 640 px). `/app/search` keeps both primitives, so the centred-Modal and
 * disclosure cases run there and stay covered.
 */
async function mockSearch(page: Page) {
  await page.route('**/api/discogs/search*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          { discogsId: 501, resultType: 'release', title: 'Stockholm', artist: 'The Persuader', year: 1999 },
          { discogsId: 502, resultType: 'release', title: 'Berlin', artist: 'The Persuader', year: 2001 },
        ],
        pagination: { page: 1, pages: 1, items: 2, perPage: 20 },
      }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  // `test.use({ reducedMotion })` was observed not to reach the page here;
  // `emulateMedia` reliably drives the live `usePrefersReducedMotion()` hook.
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('Reduced motion — overlays, disclosures, toggles, gallery (spec 059 US2, SC-004)', () => {
  test('the centered Modal opens with opacity only — no scale, no translate mid-transition', async ({
    page,
  }) => {
    await mockSearch(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/search?q=stockholm');
    await expect(page.getByText('Stockholm')).toBeVisible();

    await page.getByRole('button', { name: /^filters$/i }).click();

    await startMotionRecorder(
      page,
      {
        dialog: '[role="dialog"][data-variant="center"]',
        scrim: '[data-testid="modal-backdrop"]',
      },
      900,
    );
    await page.locator('#filter-genre-trigger').click();
    const frames = await collectMotionFrames(page);

    await expect(page.locator('[role="dialog"][data-variant="center"]')).toHaveAttribute(
      'data-reduced-motion',
      'true',
    );
    expectNoTransformMotion(frames.dialog, 'Modal (center) surface under reduced motion');
    expectNoTransformMotion(frames.scrim, 'Modal scrim under reduced motion');
  });

  test('the end-drawer (hamburger menu) opens with no slide translate under reduced motion', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const menu = page.getByRole('button', { name: /^menu$/i });
    await expect(menu).toBeVisible();

    await startMotionRecorder(
      page,
      { drawer: '[role="dialog"][data-variant="end"]' },
      900,
    );
    await menu.click();
    const frames = await collectMotionFrames(page);

    await expect(page.locator('[role="dialog"][data-variant="end"]')).toHaveAttribute(
      'data-reduced-motion',
      'true',
    );
    // The slide-in (`x: 100% -> 0`) must be entirely absent.
    expectNoTransformMotion(frames.drawer, 'End-drawer surface under reduced motion');
  });

  /**
   * Spec 068 US3 (T041, FR-027, contracts/library-ui §3, §7): Library's own
   * overlays. At >= 640 px the toolbar's "Filters" button opens an end-drawer;
   * under reduced motion its `x: 100% -> 0` slide must not run.
   */
  test('the Library Filters drawer opens with no slide translate under reduced motion', async ({
    page,
  }) => {
    await mockLibrary(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByText('Stockholm')).toBeVisible();

    const trigger = page.getByRole('button', { name: /^filters(,|$)/i });
    await expect(trigger).toBeVisible();

    await startMotionRecorder(
      page,
      {
        drawer: '[role="dialog"][data-variant="end"]',
        scrim: '[data-testid="modal-backdrop"]',
      },
      900,
    );
    await trigger.click();
    const frames = await collectMotionFrames(page);

    await expect(page.getByRole('dialog', { name: 'Filters' })).toHaveAttribute(
      'data-reduced-motion',
      'true',
    );
    expectNoTransformMotion(frames.drawer, 'Library Filters drawer under reduced motion');
    expectNoTransformMotion(frames.scrim, 'Library Filters drawer scrim under reduced motion');
  });

  /**
   * Spec 068 US3 (T041, FR-027): below 640 px the capsule's "Sort & Filter"
   * button opens a bottom sheet (`Modal position="bottom"` →
   * `Overlay variant="bottom"`, `y: 100% -> 0` on `spring.sheet`). Under
   * reduced motion that translate must be absent — opacity only.
   */
  test('the Library "Sort & Filter" bottom sheet opens with no translate under reduced motion (390 px)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockLibrary(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByText('Stockholm')).toBeVisible();

    const trigger = page.getByRole('button', { name: /^sort & filter(,|$)/i });
    await expect(trigger).toBeVisible();

    await startMotionRecorder(
      page,
      {
        sheet: '[role="dialog"][data-variant="bottom"]',
        scrim: '[data-testid="modal-backdrop"]',
      },
      900,
    );
    await trigger.click();
    const frames = await collectMotionFrames(page);

    await expect(page.getByRole('dialog', { name: 'Sort & Filter' })).toHaveAttribute(
      'data-reduced-motion',
      'true',
    );
    expectNoTransformMotion(frames.sheet, 'Library Sort & Filter sheet under reduced motion');
    expectNoTransformMotion(frames.scrim, 'Library Sort & Filter sheet scrim under reduced motion');
  });

  test('the ViewModeToggle pill does not animate its position under reduced motion', async ({
    page,
  }) => {
    await mockLibrary(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByTestId('library-record-grid')).toBeVisible();
    await expect(page.getByTestId('view-mode-pill')).toBeVisible();

    await startMotionRecorder(page, { pill: '[data-testid="view-mode-pill"]' }, 800);
    await page.getByTestId('view-mode-list').click();
    const frames = await collectMotionFrames(page);

    await expect(page.getByTestId('view-mode-pill')).toHaveAttribute(
      'data-reduced-motion',
      'true',
    );
    // The pill carries a static positioning transform and repositions on the
    // mode switch, but reduced motion must make it jump in one step, not glide.
    expectJumpNotGlide(frames.pill, 'ViewModeToggle pill under reduced motion');
  });

  test('the CollapsibleFilterPanel disclosure body reveals with no transform under reduced motion', async ({
    page,
  }) => {
    await mockSearch(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/search?q=stockholm');
    await expect(page.getByText('Stockholm')).toBeVisible();

    await startMotionRecorder(
      page,
      { body: '[data-testid="collapsible-filter-body"]' },
      900,
    );
    await page.getByRole('button', { name: /^filters$/i }).click();
    const frames = await collectMotionFrames(page);

    await expect(page.getByTestId('collapsible-filter-body')).toHaveAttribute(
      'data-reduced-motion',
      'true',
    );
    expectNoTransformMotion(frames.body, 'CollapsibleFilterPanel body under reduced motion');
  });

  test('the fullscreen gallery viewer opens and swaps images with no scale/slide under reduced motion', async ({
    page,
  }) => {
    await page.route(`**/api/discogs/releases/${RELEASE_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(releaseResponse),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/releases/${RELEASE_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    // Open the viewer.
    await startMotionRecorder(
      page,
      {
        surface: '[data-testid="gallery-viewer-surface"]',
        image: '[data-testid="gallery-viewer-surface"] img',
      },
      900,
    );
    await page.getByRole('button', { name: /view stockholm fullscreen/i }).click();
    const openFrames = await collectMotionFrames(page);

    await expect(page.getByTestId('gallery-viewer-surface')).toHaveAttribute(
      'data-reduced-motion',
      'true',
    );
    expectNoTransformMotion(openFrames.surface, 'Gallery viewer surface (open) under reduced motion');
    expectNoTransformMotion(openFrames.image, 'Gallery viewer image (open) under reduced motion');

    // Swap to the next image — the directional slide must not run.
    await startMotionRecorder(
      page,
      { image: '[data-testid="gallery-viewer-surface"] img' },
      900,
    );
    await page
      .getByTestId('gallery-fullscreen-viewer')
      .getByRole('button', { name: /show image 2 of 2/i })
      .click();
    const swapFrames = await collectMotionFrames(page);
    expectNoTransformMotion(swapFrames.image, 'Gallery viewer image (swap) under reduced motion');
  });

  test('skeleton loaders do not pulse under reduced motion (animation-name: none)', async ({
    page,
  }) => {
    let releaseLibrary: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseLibrary = resolve;
    });

    await page.route('**/api/library*', async (route) => {
      await gate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [libraryEntry('entry-1', 'Stockholm')],
          page: 1,
          pageSize: 20,
          totalItems: 1,
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');

    // While the library request is still in flight, the card skeletons render.
    const skeleton = page.getByTestId('record-card-skeleton').first();
    await expect(skeleton).toBeVisible();

    const pulseAnimationNames = await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll('[data-testid="record-card-skeleton"] [class*="animate-pulse"]'),
      );
      return nodes.map((node) => getComputedStyle(node).animationName);
    });

    expect(pulseAnimationNames.length).toBeGreaterThan(0);
    for (const name of pulseAnimationNames) {
      expect(name, 'skeleton pulse animation-name under reduced motion').toBe('none');
    }

    releaseLibrary();
    await expect(page.getByText('Stockholm')).toBeVisible();
  });
});

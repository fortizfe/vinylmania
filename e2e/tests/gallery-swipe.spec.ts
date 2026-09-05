import { expect, type Page, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import { routeGalleryImages } from '../helpers/galleryImages';

/**
 * Spec 059 — User Story 4, T069 (FR-012 / FR-013, SC-008).
 *
 * The fullscreen gallery viewer supports a horizontal swipe between images:
 *   • swipe left advances one image, swipe right goes back one;
 *   • the thumbnail strip's `aria-current` selection follows the swipe;
 *   • a hard flick never skips two images — the viewer always steps ±1
 *     (momentum projection reads intent only);
 *   • at the first / last image the gesture does not wrap;
 *   • `ArrowLeft` / `ArrowRight`, the thumbnail buttons, the close button and
 *     Escape all keep working unchanged (FR-013).
 *
 * The swipe is dispatched as rAF-paced `PointerEvent`s directly on
 * `[data-testid="gallery-swipe-surface"]` — this drives `motion`'s drag layer
 * deterministically and, unlike a real off-surface `page.mouse` drag, never
 * synthesises a stray `click` on the scrim.
 *
 * Broken cover-art URLs collapse the swipe surface to ~0px wide (making the
 * distance threshold meaningless); `routeGalleryImages` fulfils them with a
 * real 600×600 PNG so the surface has a stable measured width.
 */

const RELEASE = {
  discogsId: 1,
  title: 'Stockholm',
  artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
  labels: [],
  formats: [],
  genres: [],
  styles: [],
  tracklist: [{ position: 'A1', title: 'Östermalm', duration: '4:45' }],
  images: [
    { url: 'https://img.test/a.jpg', imageType: 'primary' },
    { url: 'https://img.test/b.jpg', imageType: 'secondary' },
    { url: 'https://img.test/c.jpg', imageType: 'secondary' },
    { url: 'https://img.test/d.jpg', imageType: 'secondary' },
  ],
  discogsUrl: 'https://www.discogs.com/release/1',
};

async function openGallery(page: Page): Promise<void> {
  await routeGalleryImages(page);
  await page.route('**/api/discogs/releases/1', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(RELEASE),
    }),
  );
  await page.goto('/');
  await signInAsFakeGoogleUser(page);
  await page.goto('/app/releases/1');
  await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();
  await page.getByRole('button', { name: /view stockholm fullscreen/i }).click();
  await expect(page.getByTestId('gallery-fullscreen-viewer')).toBeVisible();
}

/**
 * Index (0-based) of the thumbnail currently marked `aria-current="true"`
 * inside the fullscreen viewer's own strip (the embedded page gallery has a
 * second strip with identical labels).
 */
function currentIndex(page: Page): Promise<number> {
  return page.evaluate(() => {
    const viewer = document.querySelector('[data-testid="gallery-fullscreen-viewer"]');
    if (!viewer) return -1;
    return [...viewer.querySelectorAll('button[aria-label^="Show image"]')].findIndex(
      (b) => b.getAttribute('aria-current') === 'true',
    );
  });
}

const viewerThumb = (page: Page, label: string) =>
  page.getByTestId('gallery-fullscreen-viewer').getByRole('button', { name: label });

/**
 * A horizontal swipe on the gallery surface.
 * @param dir       'left' advances, 'right' goes back.
 * @param framePx    px moved per animation frame (higher ⇒ faster ⇒ more velocity).
 * @param frames     number of move frames.
 * @param rafPerFrame extra rAF waits between frames to bleed off velocity (a slow drag).
 */
async function swipe(
  page: Page,
  dir: 'left' | 'right',
  { framePx, frames, rafPerFrame = 1 }: { framePx: number; frames: number; rafPerFrame?: number },
): Promise<void> {
  await page.evaluate(
    async ({ dir, framePx, frames, rafPerFrame }) => {
      const el = document.querySelector(
        '[data-testid="gallery-swipe-surface"]',
      ) as HTMLElement;
      const r = el.getBoundingClientRect();
      const y = r.y + r.height / 2;
      let x = r.x + r.width / 2;
      const sign = dir === 'left' ? -1 : 1;
      const raf = () => new Promise((res) => requestAnimationFrame(res));
      const fire = (type: string, buttons: number, mx: number) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
            movementX: mx,
            buttons,
            button: type === 'pointerdown' || type === 'pointerup' ? 0 : -1,
          }),
        );
      fire('pointerdown', 1, 0);
      await raf();
      for (let i = 0; i < frames; i += 1) {
        x += sign * framePx;
        fire('pointermove', 1, sign * framePx);
        for (let k = 0; k < rafPerFrame; k += 1) await raf();
      }
      fire('pointerup', 0, 0);
      await raf();
    },
    { dir, framePx, frames, rafPerFrame },
  );
  await page.waitForTimeout(450); // settle the spring.momentum image swap
}

test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

test.describe('Gallery horizontal swipe (spec 059 US4, T069)', () => {
  test.beforeEach(async ({ page }) => {
    await openGallery(page);
  });

  test('swipe left advances one image and the thumbnail aria-current follows', async ({
    page,
  }) => {
    const viewerImg = page.getByTestId('gallery-fullscreen-viewer').getByRole('img', {
      name: 'Stockholm',
    });
    await expect(currentIndex(page)).resolves.toBe(0);

    await swipe(page, 'left', { framePx: 26, frames: 6 });

    await expect(currentIndex(page)).resolves.toBe(1);
    await expect(
      viewerThumb(page, 'Show image 2 of 4'),
    ).toHaveAttribute('aria-current', 'true');
    await expect(viewerImg).toHaveAttribute('src', /b\.jpg/);
  });

  test('swipe right from a later image goes back exactly one', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(currentIndex(page)).resolves.toBe(2);

    await swipe(page, 'right', { framePx: 26, frames: 6 });

    await expect(currentIndex(page)).resolves.toBe(1);
  });

  test('a hard flick advances exactly one — momentum never skips two images', async ({
    page,
  }) => {
    await expect(currentIndex(page)).resolves.toBe(0);

    // Deliberately violent: large per-frame delta, no bleed-off — the
    // momentum projection lands far past the next image, but the viewer must
    // still step exactly +1.
    await swipe(page, 'left', { framePx: 60, frames: 6 });

    await expect(currentIndex(page)).resolves.toBe(1);
  });

  test('the swipe does not wrap at the last image, and the keys still bring it back', async ({
    page,
  }) => {
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight');
    await expect(currentIndex(page)).resolves.toBe(3);

    await swipe(page, 'left', { framePx: 60, frames: 6 }); // hard flick past the end
    await expect(currentIndex(page)).resolves.toBe(3); // no wrap to 0

    await page.keyboard.press('ArrowLeft');
    await expect(currentIndex(page)).resolves.toBe(2);
  });

  test('the swipe does not wrap before the first image', async ({ page }) => {
    await expect(currentIndex(page)).resolves.toBe(0);

    await swipe(page, 'right', { framePx: 60, frames: 6 });

    await expect(currentIndex(page)).resolves.toBe(0); // no wrap to 3
  });

  test('parity: ArrowLeft / ArrowRight keys navigate and stay in sync with the thumbnails', async ({
    page,
  }) => {
    await page.keyboard.press('ArrowRight');
    await expect(currentIndex(page)).resolves.toBe(1);
    await page.keyboard.press('ArrowRight');
    await expect(currentIndex(page)).resolves.toBe(2);
    await page.keyboard.press('ArrowLeft');
    await expect(currentIndex(page)).resolves.toBe(1);

    await expect(
      viewerThumb(page, 'Show image 2 of 4'),
    ).toHaveAttribute('aria-current', 'true');
  });

  test('parity: the thumbnail buttons still select an image directly', async ({ page }) => {
    const viewer = page.getByTestId('gallery-fullscreen-viewer');
    await viewer.getByRole('button', { name: 'Show image 3 of 4' }).click();

    await expect(currentIndex(page)).resolves.toBe(2);
    await expect(viewer.getByRole('img', { name: 'Stockholm' })).toHaveAttribute(
      'src',
      /c\.jpg/,
    );
  });

  test('parity: the close button and Escape both close the viewer and restore focus', async ({
    page,
  }) => {
    const viewer = page.getByTestId('gallery-fullscreen-viewer');
    const trigger = page.getByRole('button', { name: /view stockholm fullscreen/i });

    await page.getByTestId('gallery-fullscreen-close').click();
    await expect(viewer).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(viewer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(viewer).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

/**
 * Spec 059 — SC-005 / SC-008 (T077): no WCAG 2.1 AA regression while the
 * swipe-enabled fullscreen viewer is open, on both themes.
 */
test.describe('Gallery viewer open — WCAG 2.1 AA scan (spec 059 US4, T077)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

  for (const theme of ['light', 'dark'] as const) {
    test(`no serious/critical axe violations with the viewer open in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await openGallery(page);
      await expect(page.getByTestId('gallery-swipe-surface')).toBeVisible();

      const seriousOrCritical = await runAxeScan(page);
      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }
});

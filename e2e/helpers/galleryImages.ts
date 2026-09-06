import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

/**
 * The gallery swipe distance threshold (`Sheet`/gallery: 45% of the swipe
 * surface's own width) is only meaningful when the `<img>` actually has
 * intrinsic dimensions — a broken `example.com` URL collapses the surface to
 * ~0px wide and every release then falls back to velocity-only behaviour.
 *
 * This fulfils any image request the release-detail gallery makes with a real
 * 600×600 PNG so the surface has a stable measured width in-browser. Route it
 * before navigating to the release page.
 */
const COVER_PNG = readFileSync(path.resolve(__dirname, '../fixtures/test-cover.png'));

export async function routeGalleryImages(page: Page): Promise<void> {
  await page.route(
    // Off-origin cover-art requests only — never the frontend's own bundled
    // assets (logos, favicons served from localhost).
    (url) =>
      url.host !== 'localhost:5173' &&
      /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url.pathname),
    async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: COVER_PNG });
    },
  );
}

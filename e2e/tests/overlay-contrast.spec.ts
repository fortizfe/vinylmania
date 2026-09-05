import { expect, type Page, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { assertOverlayContentContrast, colorAlpha } from '../helpers/contrast';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

/**
 * Spec 059 — User Story 3, FR-009 / SC-005, acceptance scenario 5 (T061).
 *
 * "Given overlay content over a blurred backdrop showing busy cover art,
 *  When contrast is measured, Then all overlay text and controls still meet
 *  WCAG 2.1 AA."
 *
 * The worst case for a translucent, blurred scrim is a page full of
 * high-chroma album art directly behind the overlay. This opens the Genre
 * filter Modal on a My Library grid packed with cover images and asserts —
 * in both themes — that every text string and control on the overlay clears
 * AA *against the overlay's own opaque `.overlay-surface`*, never against
 * the scrim (see `assertOverlayContentContrast`).
 */

// A 2x2 magenta/cyan/yellow/black checker as a data URI — deterministic,
// high-chroma "busy cover art" that needs no network and renders identically
// in CI. Every library card behind the overlay paints one of these.
const BUSY_COVER =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">' +
      '<rect width="4" height="4" fill="#ff00aa"/>' +
      '<rect x="4" width="4" height="4" fill="#00ddff"/>' +
      '<rect y="4" width="4" height="4" fill="#ffee00"/>' +
      '<rect x="4" y="4" width="4" height="4" fill="#0b0b0b"/>' +
    '</svg>',
  ).toString('base64');

/**
 * Waits for an overlay's enter animation to fully settle — the surface at
 * `opacity: 1` with an identity transform. axe-core folds ancestor `opacity`
 * into its contrast maths, so scanning mid-spring produces washed-out
 * false positives (fg blended toward the backdrop). Real contrast is only
 * meaningful once the surface is opaque and at rest.
 */
async function settleOverlay(page: Page, dialogSelector: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((sel) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) return null;
          const s = getComputedStyle(el);
          const t = s.transform;
          const identity = t === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(t);
          return s.opacity === '1' && identity ? 'settled' : `${s.opacity}|${t}`;
        }, dialogSelector),
      { timeout: 4000 },
    )
    .toBe('settled');
}

function libraryEntryWithCover(id: string, title: string) {
  return {
    id,
    discogsReleaseId: 1,
    addedAt: '2026-07-03T00:00:00.000Z',
    catalogStatus: 'ok',
    release: {
      discogsId: 1,
      title,
      artists: [{ discogsArtistId: 1, name: 'Busy Art Artist' }],
      labels: [],
      formats: [],
      genres: [],
      styles: [],
      tracklist: [],
      images: [{ url: BUSY_COVER, imageType: 'primary' as const }],
      discogsUrl: 'https://www.discogs.com/release/1',
    },
  };
}

async function openGenreModalOverBusyArt(page: Page) {
  await page.route('**/api/library*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: Array.from({ length: 24 }, (_, i) =>
          libraryEntryWithCover(`entry-${i + 1}`, `Busy Record ${i + 1}`),
        ),
        page: 1,
        pageSize: 24,
        totalItems: 24,
      }),
    });
  });

  await page.goto('/');
  await signInAsFakeGoogleUser(page);
  await page.goto('/app/library');
  await expect(page.getByText('Busy Record 1', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^filters$/i }).click();
  await page.locator('#filter-genre-trigger').click();

  const scrim = page.locator('[data-testid="modal-backdrop"]');
  const surface = scrim.locator('.overlay-surface');
  await expect(surface).toBeVisible();
  await settleOverlay(page, '[data-testid="modal-backdrop"] [role="dialog"]');
  return { scrim, surface };
}

for (const theme of ['light', 'dark'] as const) {
  test(`overlay text and controls meet WCAG AA over blurred busy cover art (${theme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    const { surface } = await openGenreModalOverBusyArt(page);
    await assertOverlayContentContrast(
      page,
      surface,
      `Genre Modal over busy cover art (${theme})`,
    );
  });

  // SC-005 — zero serious/critical axe violations with an overlay actually
  // open, in both themes (the pre-change baseline scans these same screens
  // with no overlay open).
  test(`axe: no serious/critical violations with the Genre Modal open (${theme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await openGenreModalOverBusyArt(page);
    const violations = await runAxeScan(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test(`axe: no serious/critical violations with the fullscreen gallery open (${theme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.route('**/api/discogs/releases/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          discogsId: 1,
          title: 'Stockholm',
          artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
          labels: [],
          formats: [],
          genres: [],
          styles: [],
          tracklist: [],
          images: [
            { url: BUSY_COVER, imageType: 'primary' },
            { url: BUSY_COVER, imageType: 'secondary' },
          ],
          discogsUrl: 'https://www.discogs.com/release/1',
        }),
      });
    });
    await page.goto('/');
    await signInAsFakeGoogleUser(page, { email: `e2e-${theme}-gallery-axe@example.com` });
    await page.goto('/app/releases/1');
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();
    await page.getByRole('button', { name: /view stockholm fullscreen/i }).click();
    await expect(page.getByTestId('gallery-fullscreen-viewer')).toBeVisible();
    await settleOverlay(page, '[data-testid="gallery-fullscreen-viewer"] [role="dialog"]');

    const violations = await runAxeScan(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
}

/**
 * Spec 059 — FR-007: the three material degradations of the scrim.
 *
 * Playwright 1.61's `emulateMedia` can emulate `prefers-contrast: more` but
 * NOT `prefers-reduced-transparency` nor the absence of `backdrop-filter`
 * support — for those two we assert the CSS rule is present and correct in
 * the shipped stylesheet (a `@media`/`@supports` block keyed on
 * `.overlay-scrim`), which is the mechanism that degrades the animated
 * inline `backdrop-filter`. See `frontend/src/styles/global.css`.
 */
test.describe('Overlay material fallbacks (spec 059 US3, FR-007)', () => {
  test('prefers-contrast: more → solid scrim, no blur, bordered surface (emulated)', async ({
    page,
  }) => {
    await page.emulateMedia({ contrast: 'more' });
    const { scrim, surface } = await openGenreModalOverBusyArt(page);

    const scrimStyle = await scrim.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        backgroundColor: s.backgroundColor,
        backdropFilter:
          s.backdropFilter ||
          (s as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter ||
          'none',
      };
    });
    expect(scrimStyle.backdropFilter).toBe('none');
    expect(await colorAlpha(page, scrimStyle.backgroundColor)).toBeGreaterThanOrEqual(0.99);

    const border = await surface.evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.borderTopWidth, style: s.borderTopStyle };
    });
    expect(border.style).toBe('solid');
    expect(Number.parseFloat(border.width)).toBeGreaterThanOrEqual(1);
  });

  test('the reduced-transparency and no-backdrop-filter fallback rules ship in the stylesheet', async ({
    page,
  }) => {
    await page.goto('/');

    const rules = await page.evaluate(() => {
      const collected: string[] = [];
      const visit = (list: CSSRuleList) => {
        for (const rule of Array.from(list)) {
          const asGroup = rule as CSSGroupingRule & { conditionText?: string; media?: MediaList };
          const condition =
            asGroup.conditionText ?? (asGroup.media ? asGroup.media.mediaText : '');
          if (
            /prefers-reduced-transparency|backdrop-filter/.test(condition) &&
            asGroup.cssRules
          ) {
            collected.push(`${condition} ::: ${rule.cssText}`);
          }
          if (asGroup.cssRules) visit(asGroup.cssRules);
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          visit(sheet.cssRules);
        } catch {
          /* cross-origin sheet — skip */
        }
      }
      return collected;
    });

    const reducedTransparency = rules.find((r) => /prefers-reduced-transparency:\s*reduce/.test(r));
    expect(reducedTransparency, 'no @media (prefers-reduced-transparency: reduce) rule found').toBeTruthy();
    expect(reducedTransparency).toMatch(/\.overlay-scrim/);
    expect(reducedTransparency).toMatch(/backdrop-filter:\s*none/);

    const noSupport = rules.find(
      (r) => /^\s*not\s*\(/.test(r) && /backdrop-filter/.test(r) && /\.overlay-scrim/.test(r),
    );
    expect(noSupport, 'no @supports not (backdrop-filter...) fallback for .overlay-scrim found').toBeTruthy();
    expect(noSupport).toMatch(/background-color/);
  });
});

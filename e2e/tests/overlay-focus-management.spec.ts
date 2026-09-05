import { expect, type Page, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import {
  collectMotionFrames,
  connectedFrames,
  decomposeTransform,
  expectNoSingleFrameJump,
  startMotionRecorder,
} from '../helpers/motion';

/**
 * Spec 059 — User Story 2, SC-003 (interruptibility).
 *
 * When a transition is reversed mid-flight, the animated element continues
 * from its current on-screen value — it never jumps to its start or end
 * transform in a single frame, and input is never locked out.
 *
 * (US3 / T060 extends this file with the focus-trap / focus-restore /
 * scroll-lock coverage for the modal, drawer, and gallery.)
 */

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
        items: [libraryEntry('entry-1', 'Stockholm')],
        page: 1,
        pageSize: 20,
        totalItems: 1,
      }),
    });
  });
}

test.describe('Overlay motion is interruptible (spec 059 US2, SC-003)', () => {
  test('closing the centered Modal mid-enter reverses from the current value with no transform jump', async ({
    page,
  }) => {
    await mockLibrary(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByText('Stockholm')).toBeVisible();
    await page.getByRole('button', { name: /^filters$/i }).click();

    const trigger = page.locator('#filter-genre-trigger');
    await expect(trigger).toBeVisible();

    // Recorder running before the overlay mounts, so it captures the whole
    // enter → interrupt → exit arc.
    await startMotionRecorder(page, { dialog: '[role="dialog"][data-variant="center"]' }, 2000);
    await trigger.click();
    await page.waitForTimeout(80); // ~20% into the 400ms enter spring
    await page.keyboard.press('Escape');
    const frames = await collectMotionFrames(page, 2100);

    const seen = connectedFrames(frames.dialog);
    expect(seen.length, 'the dialog was never captured mid-transition').toBeGreaterThanOrEqual(3);

    // No single-frame jump to the start (scale 0.96 / opacity 0) or end
    // (scale 1 / opacity 1) value.
    expectNoSingleFrameJump(frames.dialog, 'Modal (center) interrupted enter', {
      opacity: 0.45,
      scale: 0.05,
      translate: 40,
    });

    // The surface stayed within the animated scale band the whole time — it
    // never snapped fully open before exiting.
    for (const frame of seen) {
      const { scaleX } = decomposeTransform(frame.transform);
      const longhand = Number.parseFloat(frame.scale);
      const scale = Number.isNaN(longhand) ? scaleX : scaleX * longhand;
      expect(
        scale,
        `scale ${scale.toFixed(3)} left the 0.96–1.0 enter band at t=${frame.t.toFixed(0)}ms`,
      ).toBeGreaterThan(0.93);
      expect(scale).toBeLessThan(1.02);
    }

    // Input is not locked out — the overlay finishes closing and the trigger
    // is focusable again.
    await expect(page.locator('[role="dialog"][data-variant="center"]')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('reversing the end-drawer mid-slide tracks back to the edge with no jump to the open position', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const menu = page.getByRole('button', { name: /^menu$/i });
    await expect(menu).toBeVisible();
    const drawer = page.locator('[role="dialog"][data-variant="end"]');

    // Baseline: where the drawer sits once fully open.
    await menu.click();
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(600);
    const restingX = (await drawer.evaluate((el) => el.getBoundingClientRect().x)) as number;
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);

    // Re-open with the recorder already running, then reverse partway
    // through the enter slide.
    await startMotionRecorder(page, { drawer: '[role="dialog"][data-variant="end"]' }, 2500);
    await menu.click();
    await page.waitForTimeout(70); // ~20% into the 350ms enter slide
    await page.keyboard.press('Escape');
    const frames = await collectMotionFrames(page, 2600);

    const seen = connectedFrames(frames.drawer);
    expect(seen.length, 'the drawer was never captured mid-slide').toBeGreaterThanOrEqual(5);

    // No single-frame jump (a snap to open or to fully-closed would show one
    // outsized delta).
    expectNoSingleFrameJump(frames.drawer, 'End-drawer interrupted slide', {
      opacity: 0.5,
      scale: 0.05,
      translate: 130,
    });

    // The drawer never reached its open resting position — the reversal
    // caught it in flight.
    const minX = Math.min(...seen.map((f) => f.x));
    expect(
      minX,
      `drawer reached x=${minX.toFixed(1)}, at/under its open resting x=${restingX.toFixed(1)} — the interrupt did not catch it in flight`,
    ).toBeGreaterThan(restingX + 40);

    // Once it started closing it kept heading toward the edge (spring.sheet
    // has bounce: 0 — no move back toward open beyond spring settle jitter).
    const minIndex = seen.findIndex((f) => f.x === minX);
    for (let i = minIndex + 1; i < seen.length; i += 1) {
      expect(
        seen[i].x,
        `drawer moved back toward open (x ${seen[i].x.toFixed(1)} < ${seen[i - 1].x.toFixed(1)}) at t=${seen[i].t.toFixed(0)}ms while closing`,
      ).toBeGreaterThanOrEqual(seen[i - 1].x - 3);
    }

    await expect(drawer).toHaveCount(0);
    await expect(menu).toBeFocused();
  });
});

/**
 * Spec 059 — User Story 3, FR-008 / SC-005 (the four latent `Modal` gaps).
 *
 * For the centered Modal, the end-drawer and the fullscreen gallery — all
 * three now routed through `motion/Overlay`:
 *   • Tab / Shift+Tab cycle only within the overlay, never the background;
 *   • Escape, scrim-click and the close button each restore focus to the
 *     exact control that opened the overlay;
 *   • `document.body` scroll is locked while open and restored on close;
 *   • the background does not scroll on wheel or keyboard;
 *   • the scrim visibly distinguishes the layer (dim + blur, or a solid-dim
 *     fallback).
 */

const FOCUSABLE =
  ':is(a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]))';

async function activeElementIsInside(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const active = document.activeElement;
    return !!root && !!active && root !== active && root.contains(active);
  }, selector);
}

/** Tab and Shift+Tab a full cycle-and-a-bit; focus must never leave `selector`. */
async function expectFocusTrapped(page: Page, selector: string): Promise<void> {
  const focusableCount = await page.locator(`${selector} ${FOCUSABLE}`).count();
  expect(focusableCount, `${selector}: expected >= 2 focusables to prove a trap`).toBeGreaterThanOrEqual(2);
  const steps = focusableCount + 3;

  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('Tab');
    expect(
      await activeElementIsInside(page, selector),
      `focus escaped ${selector} after ${i + 1} Tab press(es)`,
    ).toBe(true);
  }
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(
      await activeElementIsInside(page, selector),
      `focus escaped ${selector} after ${i + 1} Shift+Tab press(es)`,
    ).toBe(true);
  }
}

/** The scrim reads as a backdrop: a dim fill and/or a blur (FR-007). */
async function expectBackdropDistinct(page: Page, scrimSelector: string): Promise<void> {
  const material = await page.locator(scrimSelector).evaluate((el) => {
    const s = getComputedStyle(el);
    return { backgroundColor: s.backgroundColor, backdropFilter: s.backdropFilter || (s as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter || 'none' };
  });
  const alphaMatch = material.backgroundColor.match(/rgba?\(([^)]+)\)/);
  const alpha = alphaMatch
    ? (() => {
        const parts = alphaMatch[1].split(/[,/]/).map((p) => Number.parseFloat(p.trim()));
        return parts.length >= 4 ? parts[3] : 1;
      })()
    : 1;
  const blurs = /blur\(\s*([1-9]\d*(?:\.\d+)?|0\.\d*[1-9])/.test(material.backdropFilter);
  expect(
    alpha >= 0.5 || blurs,
    `${scrimSelector}: scrim is not a distinct backdrop (bg ${material.backgroundColor}, backdrop-filter ${material.backdropFilter})`,
  ).toBe(true);
}

function libraryPage(count: number) {
  const items = Array.from({ length: count }, (_, i) => libraryEntry(`entry-${i + 1}`, `Record ${i + 1}`));
  return { items, page: 1, pageSize: count, totalItems: count };
}

test.describe('Overlay focus trap, restore and scroll lock (spec 059 US3, T060)', () => {
  async function openGenreModal(page: Page) {
    await page.route('**/api/library*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(libraryPage(30)),
      });
    });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByText('Record 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^filters$/i }).click();

    const trigger = page.locator('#filter-genre-trigger');
    await expect(trigger).toBeVisible();
    await trigger.click();

    const scrim = page.locator('[data-testid="modal-backdrop"]');
    const dialog = scrim.locator('[role="dialog"][data-variant="center"]');
    await expect(dialog).toBeVisible();
    return { trigger, scrim, dialog };
  }

  test('Modal: Tab/Shift+Tab stay inside; the scrim is a distinct backdrop', async ({ page }) => {
    const { dialog, scrim } = await openGenreModal(page);
    await expectBackdropDistinct(page, '[data-testid="modal-backdrop"]');
    await expectFocusTrapped(page, '[data-testid="modal-backdrop"] [role="dialog"][data-variant="center"]');
    // The opener behind the scrim is never reachable.
    await expect(page.locator('#filter-genre-trigger')).not.toBeFocused();
    await expect(dialog).toBeVisible();
    await expect(scrim).toBeVisible();
  });

  test('Modal: Escape, scrim-click and the close button each restore focus to the trigger', async ({
    page,
  }) => {
    const { trigger, scrim, dialog } = await openGenreModal(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await scrim.click({ position: { x: 5, y: 5 } });
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('Modal: background scroll is locked while open and restored after close', async ({ page }) => {
    const { trigger, scrim, dialog } = await openGenreModal(page);

    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(bodyOverflow).toBe('hidden');

    await page.mouse.move(640, 360);
    await page.mouse.wheel(0, 800);
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(120);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY, 'background page scrolled while an overlay was open').toBe(0);

    await scrim.click({ position: { x: 5, y: 5 } });
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe('hidden');
    // Background scrolls again once the lock is released.
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  async function openDrawer(page: Page) {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.route('**/api/library*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(libraryPage(30)),
      });
    });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByText('Record 1', { exact: true })).toBeVisible();

    const menu = page.getByRole('button', { name: /^menu$/i });
    await expect(menu).toBeVisible();
    await menu.click();

    const scrim = page.locator('[data-testid="modal-backdrop"]');
    const drawer = scrim.locator('[role="dialog"][data-variant="end"]');
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(500); // settle the enter slide
    return { menu, scrim, drawer };
  }

  test('End-drawer: Tab/Shift+Tab stay inside; the scrim is a distinct backdrop', async ({ page }) => {
    await openDrawer(page);
    await expectBackdropDistinct(page, '[data-testid="modal-backdrop"]');
    await expectFocusTrapped(page, '[data-testid="modal-backdrop"] [role="dialog"][data-variant="end"]');
  });

  test('End-drawer: Escape, scrim-click and the close button each restore focus to the menu button', async ({
    page,
  }) => {
    const { menu, scrim, drawer } = await openDrawer(page);

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(menu).toBeFocused();

    await menu.click();
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(500);
    await scrim.click({ position: { x: 5, y: 400 } });
    await expect(drawer).toHaveCount(0);
    await expect(menu).toBeFocused();

    await menu.click();
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(500);
    await drawer.getByRole('button', { name: 'Close' }).click();
    await expect(drawer).toHaveCount(0);
    await expect(menu).toBeFocused();
  });

  test('End-drawer: background scroll is locked while open and restored after close', async ({
    page,
  }) => {
    const { menu, scrim, drawer } = await openDrawer(page);

    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    await page.mouse.move(320, 400);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(120);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await scrim.click({ position: { x: 5, y: 400 } });
    await expect(drawer).toHaveCount(0);
    await expect(menu).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe('hidden');
  });

  async function openGallery(page: Page) {
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
          tracklist: [
            { position: 'A1', title: 'Track One', duration: '4:00' },
            { position: 'A2', title: 'Track Two', duration: '5:00' },
            { position: 'B1', title: 'Track Three', duration: '6:00' },
          ],
          images: [
            { url: 'https://example.com/cover-front.jpg', imageType: 'primary' },
            { url: 'https://example.com/cover-back.jpg', imageType: 'secondary' },
            { url: 'https://example.com/cover-sleeve.jpg', imageType: 'secondary' },
          ],
          discogsUrl: 'https://www.discogs.com/release/1',
        }),
      });
    });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/releases/1');
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const trigger = page.getByRole('button', { name: /view stockholm fullscreen/i });
    await trigger.click();
    const scrim = page.locator('[data-testid="gallery-fullscreen-viewer"]');
    const dialog = scrim.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    return { trigger, scrim, dialog };
  }

  test('Fullscreen gallery: Tab/Shift+Tab stay inside; the scrim is a distinct backdrop', async ({
    page,
  }) => {
    await openGallery(page);
    await expectBackdropDistinct(page, '[data-testid="gallery-fullscreen-viewer"]');
    await expectFocusTrapped(page, '[data-testid="gallery-fullscreen-viewer"] [role="dialog"]');
  });

  test('Fullscreen gallery: Escape, scrim-click and the close button each restore focus to the thumbnail trigger', async ({
    page,
  }) => {
    const { trigger, scrim, dialog } = await openGallery(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await scrim.click({ position: { x: 5, y: 5 } });
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.getByTestId('gallery-fullscreen-close').click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('Fullscreen gallery: background scroll is locked while open and restored after close', async ({
    page,
  }) => {
    const { trigger, scrim, dialog } = await openGallery(page);

    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    await page.mouse.move(640, 360);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(120);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await scrim.click({ position: { x: 5, y: 5 } });
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe('hidden');
  });
});

test.describe('Nested overlay focus unwind (spec 059 US3, T065)', () => {
  // The innermost open dialog is the one that contains no other dialog.
  const INNERMOST = '[role="dialog"]:not(:has([role="dialog"]))';

  async function openStack(page: Page) {
    await page.goto('/__dev/nested-overlay');
    const openOuter = page.getByTestId('open-outer');
    await openOuter.click();
    await expect(page.getByRole('heading', { name: 'Outer dialog' })).toBeVisible();

    const openInner = page.getByTestId('open-inner');
    await openInner.click();
    await expect(page.getByRole('heading', { name: 'Confirm action' })).toBeVisible();

    return { openOuter, openInner };
  }

  test('the inner confirm dialog traps focus and unwinds to the outer opener, then to the original trigger', async ({
    page,
  }) => {
    const { openOuter, openInner } = await openStack(page);

    // Focus is pulled into the inner dialog on open.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const dialogs = [...document.querySelectorAll('[role="dialog"]')];
          const innerDlg = dialogs.find((d) => !d.querySelector('[role="dialog"]'));
          return !!innerDlg && !!document.activeElement && innerDlg.contains(document.activeElement);
        }),
      )
      .toBe(true);

    // Tab / Shift+Tab cycle only inside the inner dialog — the outer dialog's
    // own controls (open-inner, its Close) are not reachable.
    await expectFocusTrapped(page, INNERMOST);
    await expect(openInner).not.toBeFocused();

    // Close the inner dialog via its confirm button → focus returns to the
    // control inside the OUTER dialog that opened it.
    await page.locator(INNERMOST).getByTestId('confirm-yes').click();
    await expect(page.getByRole('heading', { name: 'Confirm action' })).toHaveCount(0);
    await expect(openInner).toBeFocused();

    // The outer dialog is still open and has re-taken the trap (only one
    // dialog left, so INNERMOST now resolves to the outer one).
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await expectFocusTrapped(page, INNERMOST);

    // Close the outer dialog → focus returns to the page-level trigger.
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(openOuter).toBeFocused();

    // Scroll lock fully released after the whole stack unwinds.
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe('hidden');
  });

  test('scroll lock is ref-counted across the nested stack (stays locked until the last overlay closes)', async ({
    page,
  }) => {
    await openStack(page);

    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');

    await page.locator(INNERMOST).getByTestId('confirm-yes').click();
    await expect(page.getByRole('heading', { name: 'Confirm action' })).toHaveCount(0);
    // Outer still open → still locked (ref count did not hit zero).
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');

    await page.keyboard.press('Escape');
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe('hidden');
  });
});

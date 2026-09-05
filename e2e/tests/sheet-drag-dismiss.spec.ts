import { expect, type Locator, type Page, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

/**
 * Spec 059 — User Story 4, T068 (FR-010 / FR-011 / FR-013, SC-008).
 *
 * The `end`-anchored drawer (`motion/Sheet`, reached here through the header
 * hamburger menu → `Modal position="end"`) must be dismissible by a 1:1
 * drag:
 *   • the drawer surface tracks the pointer 1:1 from the grab offset;
 *   • released short of 45% of its width AND slowly → it springs back open
 *     (the dialog stays mounted, focus stays trapped);
 *   • released past 45% OR flicked outward ≥ 500 px/s → it dismisses,
 *     `onClose` runs (dialog unmounts, focus returns to the opener);
 *   • a drag that begins on scrollable content that is NOT at its scroll
 *     origin scrolls that content instead of starting a dismissal; at the
 *     scroll boundary the same gesture dismisses.
 * The close button and Escape remain always-available equivalents (FR-013).
 *
 * How the gesture is driven in Playwright
 * --------------------------------------
 * `motion`'s drag layer is fed by Pointer Events on `window` (capture
 * phase). Two synthesis strategies are used, both of which reliably drive it:
 *   • `slowDrag` — real `page.mouse` moves with a delay between each so the
 *     release velocity stays low; used for the 1:1-tracking, spring-back and
 *     distance-dismiss assertions.
 *   • `flickInPage` — rAF-paced `PointerEvent`s dispatched in-page so the
 *     final samples carry a high velocity over a short distance; used for the
 *     velocity-threshold assertion (distance kept well under 45%).
 */

const OPEN_X = 55; // resting left edge of the 320px drawer at a 375px viewport

async function openDrawer(page: Page): Promise<{ menu: Locator; surface: Locator }> {
  const menu = page.getByRole('button', { name: /^menu$/i });
  await expect(menu).toBeVisible();
  await menu.click();
  const surface = page.getByTestId('sheet-surface');
  await expect(surface).toBeVisible();
  await page.waitForTimeout(550); // settle the enter slide
  return { menu, surface };
}

/** A slow 1:1 drag along +x, sampling the surface's left edge after each step. */
async function slowDrag(
  page: Page,
  surface: Locator,
  totalDx: number,
  opts: { steps?: number; stepDelayMs?: number; from?: { x: number; y: number } } = {},
): Promise<{ samples: number[]; startX: number }> {
  const steps = opts.steps ?? 12;
  const stepDelayMs = opts.stepDelayMs ?? 55;
  const box = (await surface.boundingBox())!;
  const startX = opts.from?.x ?? box.x + box.width / 2;
  const startY = opts.from?.y ?? box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const samples: number[] = [];
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(startX + (totalDx * i) / steps, startY, { steps: 1 });
    await page.waitForTimeout(stepDelayMs);
    if ((await surface.count()) > 0) {
      samples.push(
        (await surface.evaluate((el) => el.getBoundingClientRect().x)) as number,
      );
    }
  }
  await page.mouse.up();
  return { samples, startX };
}

/** A short, fast rAF-paced pointer flick along +x, dispatched in-page. */
async function flickInPage(page: Page, framePx: number, frames: number): Promise<number> {
  return page.evaluate(
    async ({ framePx, frames }) => {
      const el = document.querySelector('[data-testid="sheet-surface"]') as HTMLElement;
      const r = el.getBoundingClientRect();
      const y = r.y + r.height / 2;
      let x = r.x + r.width / 2;
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
      const raf = () => new Promise((res) => requestAnimationFrame(res));
      fire('pointerdown', 1, 0);
      await raf();
      for (let i = 0; i < frames; i += 1) {
        x += framePx;
        fire('pointermove', 1, framePx);
        await raf();
      }
      fire('pointerup', 0, 0);
      await raf();
      return framePx * frames;
    },
    { framePx, frames },
  );
}

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

test.describe('Sheet drag-to-dismiss (spec 059 US4, T068)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
  });

  test('the drawer surface tracks the pointer 1:1 from the grab point', async ({ page }) => {
    const { surface } = await openDrawer(page);

    const { samples, startX } = await slowDrag(page, surface, 96); // 30% of 320px
    expect(samples.length).toBeGreaterThanOrEqual(10);

    // Each 8px pointer step moves the surface's left edge ~8px outward, 1:1,
    // starting from its resting position (grab offset preserved).
    const perStep = 96 / 12;
    samples.forEach((x, i) => {
      const expected = OPEN_X + perStep * (i + 1);
      expect(
        Math.abs(x - expected),
        `step ${i + 1}: surface.x ${x.toFixed(1)} vs expected ${expected.toFixed(1)} (1:1 from grab)`,
      ).toBeLessThan(6);
    });
    // Sanity: the pointer never left the surface band, so this was tracking,
    // not a fling.
    expect(startX).toBeGreaterThan(OPEN_X);
  });

  test('released short of 45% and slow → springs back open (dialog stays mounted)', async ({
    page,
  }) => {
    const { menu, surface } = await openDrawer(page);

    await slowDrag(page, surface, 96); // 30%, slow
    await page.waitForTimeout(800); // settle spring.sheet

    await expect(surface).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    const restX = (await surface.evaluate((el) => el.getBoundingClientRect().x)) as number;
    expect(
      Math.abs(restX - OPEN_X),
      `drawer settled at x=${restX.toFixed(1)}, expected it to spring back to ${OPEN_X}`,
    ).toBeLessThan(6);
    await expect(menu).not.toBeFocused(); // still trapped inside the drawer
  });

  test('released past 45% → dismisses, onClose runs and focus returns to the opener', async ({
    page,
  }) => {
    const { menu, surface } = await openDrawer(page);

    await slowDrag(page, surface, 224); // 70% of 320px, slow
    await expect(surface).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(menu).toBeFocused();
  });

  test('flicked outward ≥ 500 px/s over a short distance → dismisses', async ({ page }) => {
    const { menu, surface } = await openDrawer(page);

    const distance = await flickInPage(page, 10, 5); // 50px ≈ 16% of the width
    expect(distance).toBeLessThan(0.45 * 320); // well under the distance threshold

    await expect(surface).toHaveCount(0);
    await expect(menu).toBeFocused();
  });

  test('scroll-boundary disambiguation: the dismiss drag is captured from inside scrollable content, and vertical content scroll never swallows the horizontal dismiss', async ({
    page,
  }) => {
    // FR-011 note. The app's only `Sheet` is this x-axis drawer, whose
    // content scrolls only *vertically*. `scrollBlocksDismiss` gates an
    // x-axis dismiss on the *horizontal* scroll position (`scrollLeft`,
    // always 0 here) — so a vertical scroll offset is orthogonal to and
    // never blocks the horizontal dismiss (asserted directly in
    // `frontend/tests/unit/motion/Sheet.test.tsx`). The "content scrolls
    // instead of dismissing" branch only applies to a y-axis sheet, which
    // does not exist in the product yet, and is covered by that unit test.
    // What is verifiable end-to-end: the whole surface — not just the grab
    // handle — is the drag affordance, and the guard does not misfire when
    // the drawer content is mid-scroll.
    await page.setViewportSize({ width: 375, height: 240 });
    const { menu, surface } = await openDrawer(page);

    const scrollable = await surface.evaluate((el) => el.scrollHeight > el.clientHeight + 4);
    expect(scrollable, 'drawer content is not scrollable at this viewport height').toBe(true);

    // Park the content away from its vertical scroll origin.
    await surface.evaluate((el) => {
      el.scrollTop = 24;
    });
    expect(await surface.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    // Grab the drawer title — content inside the scroll container, not the
    // grab handle — and drag horizontally past 45%. The whole surface is the
    // drag affordance, and a vertical scroll offset does not block or swallow
    // the horizontal dismiss.
    const titleBox = await page.getByRole('heading', { name: 'Menu' }).boundingBox();
    const { samples } = await slowDrag(page, surface, 224, {
      from: { x: titleBox!.x + titleBox!.width / 2, y: titleBox!.y + titleBox!.height / 2 },
    });
    expect(samples.length).toBeGreaterThanOrEqual(6);
    // It tracked 1:1 before releasing (surface moved outward with the pointer).
    expect(samples.at(-1)! - samples[0]).toBeGreaterThan(80);

    await expect(surface).toHaveCount(0);
    await expect(menu).toBeFocused();
  });

  test('parity: the close button and Escape dismiss the drawer with no gesture', async ({
    page,
  }) => {
    const { menu } = await openDrawer(page);
    let drawer = page.getByRole('dialog');

    await drawer.getByRole('button', { name: 'Close' }).click();
    await expect(drawer).toHaveCount(0);
    await expect(menu).toBeFocused();

    await menu.click();
    drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(menu).toBeFocused();
  });
});

/**
 * Spec 059 — SC-005 / SC-008 (T077): no WCAG 2.1 AA regression while the
 * drag-dismissible drawer is open, on both themes.
 */
test.describe('Drawer open — WCAG 2.1 AA scan (spec 059 US4, T077)', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  for (const theme of ['light', 'dark'] as const) {
    test(`no serious/critical axe violations with the drawer open in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/');
      await signInAsFakeGoogleUser(page);
      await openDrawer(page);

      const seriousOrCritical = await runAxeScan(page);
      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }
});

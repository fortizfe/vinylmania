import { expect, type Page, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { assertFocusIndicatorContrast } from '../helpers/contrast';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import { assertSharedFocusRing } from '../helpers/focusRing';
import {
  assertHeaderScrollEdge,
  assertHeaderScrollEdgeInstant,
} from '../helpers/scrollEdge';

test.describe('Responsive header navigation (US1, US2, US3)', () => {
  test('shows three icon buttons and hides the hamburger at a wide viewport, each navigating correctly (US1)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const profileIcon = page.getByRole('link', { name: /^profile$/i });
    const wishlistIcon = page.getByRole('link', { name: /my wishlist/i });
    const libraryIcon = page.getByRole('link', { name: /my library/i });
    const hamburger = page.getByRole('button', { name: /^menu$/i });

    await expect(profileIcon).toBeVisible();
    await expect(wishlistIcon).toBeVisible();
    await expect(libraryIcon).toBeVisible();
    await expect(hamburger).toBeHidden();

    await libraryIcon.click();
    await expect(page).toHaveURL(/\/app\/library/);
    await expect(page.getByRole('heading', { name: /your library/i })).toBeVisible();

    await wishlistIcon.click();
    await expect(page).toHaveURL(/\/app\/wishlist/);
    await expect(page.getByRole('heading', { name: /my wishlist/i })).toBeVisible();

    await profileIcon.click();
    await expect(page).toHaveURL(/\/app\/profile/);
    await expect(page.getByRole('heading', { name: /^profile$/i })).toBeVisible();
  });

  test('shows the hamburger and hides the icons at a narrow viewport, still navigating correctly (US2)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const hamburger = page.getByRole('button', { name: /^menu$/i });

    await expect(hamburger).toBeVisible();
    await expect(page.getByRole('link', { name: /^profile$/i })).toBeHidden();
    await expect(page.getByRole('link', { name: /my wishlist/i })).toBeHidden();
    await expect(page.getByRole('link', { name: /my library/i })).toBeHidden();

    await hamburger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('link', { name: /my library/i })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /my wishlist/i })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /profile/i })).toBeVisible();

    await dialog.getByRole('link', { name: /my library/i }).click();
    await expect(page).toHaveURL(/\/app\/library/);
    await expect(page.getByRole('heading', { name: /your library/i })).toBeVisible();
  });

  test('switches between the icon layout and the hamburger menu when resized across the breakpoint, with no reload (US3)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const hamburger = page.getByRole('button', { name: /^menu$/i });
    const libraryIcon = page.getByRole('link', { name: /my library/i });

    await expect(libraryIcon).toBeVisible();
    await expect(hamburger).toBeHidden();

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(hamburger).toBeVisible();
    await expect(libraryIcon).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(libraryIcon).toBeVisible();
    await expect(hamburger).toBeHidden();

    // Confirm the switch happened without a page reload/navigation.
    await expect(page).toHaveURL(/\/app$/);
  });

  test.describe('44x44px touch targets (spec 035, Scenarios 14-15)', () => {
    test('every mobile header control meets 44x44px: hamburger trigger, nav-modal rows, and search submit', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await signInAsFakeGoogleUser(page);

      const hamburger = page.getByRole('button', { name: /^menu$/i });
      const hamburgerBox = await hamburger.boundingBox();
      expect(hamburgerBox?.width).toBeGreaterThanOrEqual(44);
      expect(hamburgerBox?.height).toBeGreaterThanOrEqual(44);

      await hamburger.click();
      const dialog = page.getByRole('dialog');
      for (const name of [/my library/i, /my wishlist/i, /profile/i]) {
        const box = await dialog.getByRole('link', { name }).boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }

      // Sign out lives inside the hamburger menu below `md` (spec 036,
      // Cluster D) — the header-row "Sign out" button is hidden here.
      const signOutRow = dialog.getByRole('button', { name: /sign out/i });
      const signOutBox = await signOutRow.boundingBox();
      expect(signOutBox?.width).toBeGreaterThanOrEqual(44);
      expect(signOutBox?.height).toBeGreaterThanOrEqual(44);
      await expect(
        page.getByRole('button', { name: /sign out/i }).and(page.locator(':visible')),
      ).toHaveCount(1);

      await page.keyboard.press('Escape');

      const searchSubmit = page.getByRole('button', { name: /^search$/i });
      const searchBox = await searchSubmit.boundingBox();
      expect(searchBox?.width).toBeGreaterThanOrEqual(44);
      expect(searchBox?.height).toBeGreaterThanOrEqual(44);
    });

    test('every desktop header control meets 44x44px: nav icons and sign-out button, with no regression to the existing composition', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      await signInAsFakeGoogleUser(page);

      for (const name of [/^profile$/i, /my wishlist/i, /my library/i]) {
        const box = await page.getByRole('link', { name }).boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }

      const signOut = page.getByRole('button', { name: /sign out/i });
      const signOutBox = await signOut.boundingBox();
      expect(signOutBox?.width).toBeGreaterThanOrEqual(44);
      expect(signOutBox?.height).toBeGreaterThanOrEqual(44);

      // Desktop composition unchanged: icons visible, hamburger hidden.
      await expect(page.getByRole('button', { name: /^menu$/i })).toBeHidden();
    });
  });

  test.describe('brand mark responsiveness (feature 034)', () => {
    test('shows the icon+wordmark lockup at 1280px, icon-only at 375px and 320px with no overlap of the hamburger, and stays fixed-size at an ultra-wide viewport', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      await signInAsFakeGoogleUser(page);

      const brand = page.getByRole('link', { name: 'Vinylmania' });
      await expect(brand).toBeVisible();
      await expect(page.getByText('VINYLMANIA')).toBeVisible();
      const desktopBox = await brand.boundingBox();

      for (const width of [375, 320]) {
        await page.setViewportSize({ width, height: 800 });
        await expect(brand).toBeVisible();
        await expect(page.getByText('VINYLMANIA')).toBeHidden();

        const brandBox = await brand.boundingBox();
        const hamburgerBox = await page.getByRole('button', { name: /^menu$/i }).boundingBox();
        expect(brandBox).not.toBeNull();
        expect(hamburgerBox).not.toBeNull();
        if (brandBox && hamburgerBox) {
          const overlaps =
            brandBox.x < hamburgerBox.x + hamburgerBox.width &&
            brandBox.x + brandBox.width > hamburgerBox.x;
          expect(overlaps, `brand mark and hamburger overlap at ${width}px`).toBe(false);
        }
      }

      // Ultra-wide: the lockup stays at its fixed size rather than scaling up.
      await page.setViewportSize({ width: 2200, height: 900 });
      await expect(page.getByText('VINYLMANIA')).toBeVisible();
      const ultraWideBox = await brand.boundingBox();
      expect(ultraWideBox?.width).toBeCloseTo(desktopBox?.width ?? 0, 0);
      expect(ultraWideBox?.height).toBeCloseTo(desktopBox?.height ?? 0, 0);
    });
  });
});

/**
 * Spec 059 — User Story 5, T088 (FR-014, SC-007).
 *
 * `AppHeader` replaced its permanent hard `border-b` divider with a
 * `.header-scroll-edge` box-shadow that fades in on `--motion-duration-fade`
 * only once content scrolls under it (apple-design §12). The box-shadow is
 * never a border, so the header box never resizes — no layout shift. Every
 * header nav control signals focus with the one shared `focusRing` treatment.
 */
test.describe('Header scroll-edge treatment & shared focus ring (spec 059 US5, T088)', () => {
  test('the app header gains a soft edge shadow on scroll and loses it at the top, with no height change', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await assertHeaderScrollEdge(page, page.getByRole('banner'), 'AppHeader');
  });

  test('under prefers-reduced-motion the edge shadow toggles instantly (transition neutralised)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const header = page.getByRole('banner');
    await assertHeaderScrollEdgeInstant(header, 'AppHeader');
    await assertHeaderScrollEdge(page, header, 'AppHeader (reduced motion)');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`every header nav control uses the shared focusRing, visible and AA in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      await signInAsFakeGoogleUser(page);

      for (const name of [/^profile$/i, /my wishlist/i, /my library/i]) {
        const control = page.getByRole('link', { name });
        await assertSharedFocusRing(control, `${String(name)} nav icon (${theme})`);
        await assertFocusIndicatorContrast(
          page,
          control,
          `${String(name)} nav icon focus indicator (${theme})`,
        );
      }

      const signOut = page.getByRole('button', { name: /sign out/i });
      await assertSharedFocusRing(signOut, `Sign out button (${theme})`);

      await page.setViewportSize({ width: 375, height: 812 });
      const hamburger = page.getByRole('button', { name: /^menu$/i });
      await expect(hamburger).toBeVisible();
      await assertSharedFocusRing(hamburger, `Hamburger button (${theme})`);
      await assertFocusIndicatorContrast(
        page,
        hamburger,
        `Hamburger button focus indicator (${theme})`,
      );
    });
  }
});

test.describe('Header/navigation WCAG 2.1 AA automated scan (spec 058, US1)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`has no automatically detectable WCAG 2.1 AA violations in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      await signInAsFakeGoogleUser(page);
      await expect(page.getByRole('banner')).toBeVisible();

      const seriousOrCritical = await runAxeScan(page);

      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }
});

test.describe('Header/navigation focus-indicator contrast (spec 058, US2)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`primary nav actions meet WCAG focus-indicator contrast in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      await signInAsFakeGoogleUser(page);

      await assertFocusIndicatorContrast(
        page,
        page.getByRole('link', { name: /^profile$/i }),
        `Profile nav link focus indicator (${theme})`,
      );
      await assertFocusIndicatorContrast(
        page,
        page.getByRole('link', { name: /my wishlist/i }),
        `Wishlist nav link focus indicator (${theme})`,
      );
      await assertFocusIndicatorContrast(
        page,
        page.getByRole('link', { name: /my library/i }),
        `Library nav link focus indicator (${theme})`,
      );

      await page.setViewportSize({ width: 375, height: 812 });
      const hamburger = page.getByRole('button', { name: /^menu$/i });
      await expect(hamburger).toBeVisible();
      await assertFocusIndicatorContrast(
        page,
        hamburger,
        `Hamburger menu button focus indicator (${theme})`,
      );
    });
  }
});

/**
 * Spec 059 — User Story 4, T076 (FR-010 / FR-013, SC-008).
 *
 * The header's hamburger drawer (`Modal position="end"` → `motion/Sheet`) is
 * now swipe-dismissible on touch. This covers the header-nav *integration*:
 * the drawer opens from the hamburger, a 1:1 drag right dismisses it, and
 * focus lands back on the hamburger button — exactly as it does for the
 * always-available Escape / close-button / nav-link paths. The drag
 * mechanics themselves (1:1 tracking, thresholds, spring-back, scroll
 * disambiguation) live in `sheet-drag-dismiss.spec.ts`.
 */
test.describe('Header drawer swipe-to-dismiss (spec 059 US4, T076)', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  /** rAF-paced pointer flick right on the drawer surface, dispatched in-page. */
  async function flickDrawerClosed(page: Page): Promise<void> {
    await page.evaluate(async () => {
      const el = document.querySelector('[data-testid="sheet-surface"]') as HTMLElement;
      const r = el.getBoundingClientRect();
      const y = r.y + r.height / 2;
      let x = r.x + r.width / 2;
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
      for (let i = 0; i < 5; i += 1) {
        x += 12;
        fire('pointermove', 1, 12);
        await raf();
      }
      fire('pointerup', 0, 0);
      await raf();
    });
  }

  test('opens from the hamburger, swipe-dismisses, and returns focus to the hamburger button', async ({
    page,
  }) => {
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const hamburger = page.getByRole('button', { name: /^menu$/i });
    await hamburger.click();

    const drawer = page.getByRole('dialog');
    const surface = page.getByTestId('sheet-surface');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: /my library/i })).toBeVisible();
    await page.waitForTimeout(550); // settle the enter slide

    await flickDrawerClosed(page);

    await expect(surface).toHaveCount(0);
    await expect(hamburger).toBeFocused();
    // The header is fully interactive again — reopening still works.
    await hamburger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('the swipe and the Escape / close-button paths all land focus back on the hamburger', async ({
    page,
  }) => {
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const hamburger = page.getByRole('button', { name: /^menu$/i });

    // Escape
    await hamburger.click();
    await expect(page.getByTestId('sheet-surface')).toBeVisible();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('sheet-surface')).toHaveCount(0);
    await expect(hamburger).toBeFocused();

    // Close button
    await hamburger.click();
    await expect(page.getByTestId('sheet-surface')).toBeVisible();
    await page.waitForTimeout(400);
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('sheet-surface')).toHaveCount(0);
    await expect(hamburger).toBeFocused();

    // Swipe
    await hamburger.click();
    await expect(page.getByTestId('sheet-surface')).toBeVisible();
    await page.waitForTimeout(550);
    await flickDrawerClosed(page);
    await expect(page.getByTestId('sheet-surface')).toHaveCount(0);
    await expect(hamburger).toBeFocused();
  });
});

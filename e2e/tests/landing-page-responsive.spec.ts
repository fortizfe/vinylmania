import { expect, test } from '@playwright/test';

// Unauthenticated landing page: dual layout + 44px touch targets
// (spec 035, Acceptance Scenarios 1-2). No sign-in needed — this is the
// anonymous entry point.
test.describe('Landing page responsive layout (spec 035, US1)', () => {
  test('desktop: pillar section renders in a multi-column composition using the available width (Scenario 1)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const pillarGrid = page.getByTestId('landing-pillar-grid');
    await expect(pillarGrid).toBeVisible();

    const columnCount = await pillarGrid.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.gridTemplateColumns.split(' ').length;
    });
    expect(columnCount).toBe(3);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('mobile: single column, no horizontal scroll, and the sign-in control meets 44x44px (Scenario 2)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const pillarGrid = page.getByTestId('landing-pillar-grid');
    await expect(pillarGrid).toBeVisible();

    const columnCount = await pillarGrid.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.gridTemplateColumns.split(' ').length;
    });
    expect(columnCount).toBe(1);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    const signIn = page.getByRole('button', { name: /sign in with google/i });
    const box = await signIn.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test('resizing live across the md/xl breakpoints changes column count with no navigation/reload (SC-004)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const pillarGrid = page.getByTestId('landing-pillar-grid');
    await expect(pillarGrid).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(async () => {
      const columnCount = await pillarGrid.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns.split(' ').length;
      });
      expect(columnCount).toBe(1);
    }).toPass();

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(async () => {
      const columnCount = await pillarGrid.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns.split(' ').length;
      });
      expect(columnCount).toBe(3);
    }).toPass();

    // Confirm no navigation/reload happened across the resizes.
    await expect(page).toHaveURL(/\/$/);
  });
});

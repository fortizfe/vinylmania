import type { Page } from '@playwright/test';

/**
 * Reads the active theme from the `dark` class on `<html>`, which is what
 * the app's `@custom-variant dark (&:where(.dark, .dark *))` rule (see
 * frontend/src/styles/global.css) keys every dark-mode style off of.
 */
export async function getActiveTheme(page: Page): Promise<'light' | 'dark'> {
  const isDark = await page.evaluate(() =>
    document.documentElement.classList.contains('dark'),
  );
  return isDark ? 'dark' : 'light';
}

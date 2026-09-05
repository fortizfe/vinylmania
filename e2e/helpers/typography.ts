import { expect, type Locator } from '@playwright/test';

/**
 * Spec 059 US5 (FR-015 / SC-007) — display / large headings set in
 * `--font-display` (Anton) carry the deliberate typography tokens:
 *   `--tracking-display` = `-0.02em`  → `letter-spacing` ≈ -0.02 × font-size
 *   `--leading-display`  = `1.05`     → `line-height`   ≈ 1.05 × font-size
 * exposed as the `tracking-display` / `leading-display` utilities, paired with
 * a fixed `text-*` size so an Anton font-swap never reflows the line box.
 */
export async function assertDisplayHeadingTokens(
  heading: Locator,
  label: string,
): Promise<void> {
  await expect(heading, `${label}: heading not visible`).toBeVisible();

  const metrics = await heading.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      fontFamily: s.fontFamily,
      fontSizePx: Number.parseFloat(s.fontSize),
      letterSpacing: s.letterSpacing,
      lineHeightPx: Number.parseFloat(s.lineHeight),
    };
  });

  expect(
    metrics.fontFamily.toLowerCase(),
    `${label}: heading is not set in the --font-display (Anton) stack (${metrics.fontFamily})`,
  ).toContain('anton');

  expect(
    metrics.letterSpacing.endsWith('px'),
    `${label}: letter-spacing did not resolve to a length (${metrics.letterSpacing}) — tracking-display not applied`,
  ).toBe(true);

  const trackingRatio = Number.parseFloat(metrics.letterSpacing) / metrics.fontSizePx;
  expect(
    trackingRatio,
    `${label}: tracking ${metrics.letterSpacing} on a ${metrics.fontSizePx}px heading is ${trackingRatio.toFixed(4)}em, expected ~-0.02em (tracking-display)`,
  ).toBeGreaterThan(-0.026);
  expect(trackingRatio).toBeLessThan(-0.014);

  const leadingRatio = metrics.lineHeightPx / metrics.fontSizePx;
  expect(
    leadingRatio,
    `${label}: line-height ${metrics.lineHeightPx}px on a ${metrics.fontSizePx}px heading is ${leadingRatio.toFixed(3)}, expected ~1.05 (leading-display)`,
  ).toBeGreaterThan(1.0);
  expect(leadingRatio).toBeLessThan(1.12);
}

import { expect, type Locator, type Page } from '@playwright/test';

export type Rgb = [number, number, number];

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance (0 = black, 1 = white) of an sRGB color. */
export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG 2.1 contrast ratio (1:1 to 21:1) between two sRGB colors. */
export function getContrastRatio(fgRgb: Rgb, bgRgb: Rgb): number {
  const l1 = relativeLuminance(fgRgb);
  const l2 = relativeLuminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const WCAG_AA_NORMAL_TEXT_RATIO = 4.5;

/** WCAG 2.1 AA minimum ratio for non-text UI component boundaries (1.4.11) and focus indicators. */
const WCAG_AA_UI_COMPONENT_RATIO = 3;

type ComputedColorProperty = 'color' | 'backgroundColor' | 'borderColor';

/**
 * Normalizes any CSS color string (rgb/rgba/oklch/etc — Tailwind v4 colors
 * compute in oklch) to an [r,g,b] triple by painting it onto a 1x1 canvas
 * and reading the pixel back — canvas always resolves to concrete sRGB
 * byte values regardless of the color space the color was declared in,
 * which is far more robust than parsing the string `ctx.fillStyle` returns.
 */
export async function toRgb(page: Page, cssColor: string): Promise<Rgb> {
  return page.evaluate((color) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b] as [number, number, number];
  }, cssColor);
}

/**
 * `getComputedStyle(el)[property]` has been observed to transiently return
 * an empty string right after a client-side route change (most likely a
 * StrictMode-driven remount racing this read), which `toRgb`'s canvas
 * conversion silently treats as opaque black — producing a false-negative
 * "1.07:1" contrast failure even though the element is correctly styled
 * and rendered (confirmed via CI screenshot pixel sampling, spec 043 PR
 * #31). Retrying briefly resolves the race without masking a real empty
 * computed style, which would keep failing past this short window.
 */
export async function getResolvedComputedStyle(
  locator: Locator,
  property: ComputedColorProperty,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const value = await locator.evaluate(
      (el, prop) => getComputedStyle(el)[prop as ComputedColorProperty],
      property,
    );
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Computed ${property} never resolved to a non-empty value`);
}

export async function assertReadableContrast(page: Page, locator: Locator, label: string) {
  const [textColor, backgroundColor] = await Promise.all([
    getResolvedComputedStyle(locator, 'color'),
    getResolvedComputedStyle(page.getByTestId('app-shell'), 'backgroundColor'),
  ]);

  const [fg, bg] = await Promise.all([toRgb(page, textColor), toRgb(page, backgroundColor)]);
  const ratio = getContrastRatio(fg, bg);

  expect(ratio, `${label}: contrast ratio ${ratio.toFixed(2)}:1 (fg ${textColor} on bg ${backgroundColor})`).toBeGreaterThanOrEqual(
    WCAG_AA_NORMAL_TEXT_RATIO,
  );
}

/**
 * Asserts the WCAG 1.4.11 (Non-text Contrast) ratio between an interactive
 * element's visual boundary and the surface it sits on is >= 3:1.
 *
 * Reads the element's computed `border-color` when it has a rendered
 * border (`border-style` isn't `none` and `border-width` isn't `0px`);
 * otherwise falls back to its `background-color`, since a borderless
 * component (e.g. a filled badge or a solid-fill button) communicates its
 * boundary via the fill/surface contrast instead.
 */
export async function assertUiComponentContrast(
  page: Page,
  elementLocator: Locator,
  comparisonLocator: Locator,
  label: string,
) {
  const { borderStyle, borderWidth } = await elementLocator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { borderStyle: style.borderStyle, borderWidth: style.borderWidth };
  });

  const hasVisibleBorder = borderStyle !== 'none' && borderWidth !== '0px';
  const property: ComputedColorProperty = hasVisibleBorder ? 'borderColor' : 'backgroundColor';

  const [elementColor, comparisonColor] = await Promise.all([
    getResolvedComputedStyle(elementLocator, property),
    getResolvedComputedStyle(comparisonLocator, 'backgroundColor'),
  ]);

  const [fg, bg] = await Promise.all([toRgb(page, elementColor), toRgb(page, comparisonColor)]);
  const ratio = getContrastRatio(fg, bg);

  expect(
    ratio,
    `${label}: ${property} contrast ratio ${ratio.toFixed(2)}:1 (${property} ${elementColor} vs adjacent surface ${comparisonColor})`,
  ).toBeGreaterThanOrEqual(WCAG_AA_UI_COMPONENT_RATIO);
}

/**
 * Resolves the color of a focused element's visible focus indicator.
 *
 * This codebase's components signal focus through one of three mechanisms,
 * checked in order of precedence:
 * 1. The browser's native `outline` (the default when nothing overrides it,
 *    e.g. `Button`, which sets no `focus:` styling at all).
 * 2. A Tailwind `ring-*` box-shadow (e.g. `ThemeToggle`'s
 *    `focus-visible:ring-2 focus-visible:ring-primary`) — used when
 *    `outline-style` is `none`. Tailwind's ring implementation stacks
 *    `--tw-ring-offset-shadow` (a spacer, transparent or ring-offset-colored),
 *    then `--tw-ring-shadow` (the actual ring color), then `--tw-shadow`
 *    (`0 0 #0000`/fully transparent when no `shadow-*` utility is applied),
 *    so the last non-transparent layer in the computed `box-shadow` is the
 *    visible ring.
 * 3. A plain `border-color` change with no outline or ring at all (e.g.
 *    `Input`, which sets `focus:outline-none` and relies solely on
 *    `focus:border-primary`) — the last resort once neither of the above
 *    produced a color.
 */
async function getFocusIndicatorColor(locator: Locator): Promise<string> {
  const { outlineStyle, outlineColor, boxShadow, borderStyle, borderColor } =
    await locator.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineColor: style.outlineColor,
        boxShadow: style.boxShadow,
        borderStyle: style.borderStyle,
        borderColor: style.borderColor,
      };
    });

  if (outlineStyle !== 'none') {
    return outlineColor;
  }

  const colorMatches = boxShadow.match(/rgba?\([^)]*\)/g) ?? [];
  const visibleColors = colorMatches.filter((color) => !/,\s*0\s*\)$/.test(color));
  const ringColor = visibleColors.at(-1);

  if (ringColor) {
    return ringColor;
  }

  if (borderStyle !== 'none') {
    return borderColor;
  }

  throw new Error(
    `No visible focus indicator found: outline-style is "none", box-shadow "${boxShadow}" has no non-transparent color layer, and border-style is "none"`,
  );
}

/**
 * Asserts the WCAG 1.4.11 (Non-text Contrast) ratio between an element's
 * visible keyboard-focus indicator and its adjacent surface is >= 3:1.
 *
 * Focuses `elementLocator` directly (equivalent, for contrast purposes, to
 * reaching it via `Tab` — both trigger the same `:focus-visible` styles),
 * then reads the resulting indicator color (see `getFocusIndicatorColor`)
 * against the app shell background, mirroring `assertReadableContrast`'s
 * choice of adjacent surface.
 */
export async function assertFocusIndicatorContrast(
  page: Page,
  elementLocator: Locator,
  label: string,
) {
  await elementLocator.focus();

  const [focusColor, backgroundColor] = await Promise.all([
    getFocusIndicatorColor(elementLocator),
    getResolvedComputedStyle(page.getByTestId('app-shell'), 'backgroundColor'),
  ]);

  const [fg, bg] = await Promise.all([toRgb(page, focusColor), toRgb(page, backgroundColor)]);
  const ratio = getContrastRatio(fg, bg);

  expect(
    ratio,
    `${label}: focus indicator contrast ratio ${ratio.toFixed(2)}:1 (indicator ${focusColor} on adjacent surface ${backgroundColor})`,
  ).toBeGreaterThanOrEqual(WCAG_AA_UI_COMPONENT_RATIO);
}

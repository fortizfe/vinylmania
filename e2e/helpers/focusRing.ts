import { expect, type Locator } from '@playwright/test';

/**
 * Spec 059 US5 (FR-014 / SC-007) — every interactive control signals keyboard
 * focus with the ONE shared treatment: the `focusRing` constant
 * (`focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
 * focus-visible:ring-offset-2`), rendered as a box-shadow ring in the primary
 * colour — never the UA outline, never a `border-color` swap, never an ad-hoc
 * ring. `focus-ring-consistency.test.ts` guards the string in `components/**`;
 * this asserts the resulting computed style on the real control.
 */
export async function assertSharedFocusRing(
  locator: Locator,
  label: string,
): Promise<void> {
  await locator.focus();

  const { outlineStyle, boxShadow } = await locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return { outlineStyle: s.outlineStyle, boxShadow: s.boxShadow };
  });

  expect(
    outlineStyle,
    `${label}: focus falls back to the UA outline (${outlineStyle}) instead of the shared ring`,
  ).toBe('none');

  const visibleShadowLayers = (boxShadow.match(/rgba?\([^)]*\)/g) ?? []).filter(
    (color) => !/,\s*0\s*\)$/.test(color),
  );
  expect(
    visibleShadowLayers.length,
    `${label}: no visible focus-ring box-shadow layer on focus (box-shadow "${boxShadow}")`,
  ).toBeGreaterThan(0);
}

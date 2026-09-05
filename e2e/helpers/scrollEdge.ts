import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Spec 059 US5 — sticky-header scroll-edge treatment (T084 / T088).
 *
 * `AppHeader` / `LandingHeader` dropped their permanent hard `border-b` for a
 * `.header-scroll-edge` box-shadow (`src/hooks/useScrolledPast.ts` +
 * `global.css`) that fades in — `transition-shadow` on `--motion-duration-fade`
 * / `ease-out` — only once page content has scrolled under the header
 * (apple-design §12: "scroll edge effects, not hard dividers").
 *
 * The shadow is a `box-shadow`, never a border, so the header box never
 * changes size: no layout shift. Under `prefers-reduced-motion: reduce` the
 * global guard collapses the transition so the edge appears instantly.
 */

/** Force the document tall enough to scroll, then scroll `y` px and settle. */
async function scrollPageBy(page: Page, y: number): Promise<void> {
  await page.evaluate((offset) => {
    const spacer = document.getElementById('e2e-scroll-spacer') ?? document.createElement('div');
    spacer.id = 'e2e-scroll-spacer';
    spacer.style.height = '2400px';
    spacer.style.width = '1px';
    spacer.style.flex = 'none';
    document.body.appendChild(spacer);
    window.scrollTo(0, offset);
  }, y);
}

async function resetScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('e2e-scroll-spacer')?.remove();
    window.scrollTo(0, 0);
  });
}

interface ScrollEdgeMetrics {
  boxShadow: string;
  borderBottomWidth: string;
  height: number;
}

async function readHeader(header: Locator): Promise<ScrollEdgeMetrics> {
  return header.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      boxShadow: s.boxShadow,
      borderBottomWidth: s.borderBottomWidth,
      height: el.getBoundingClientRect().height,
    };
  });
}

/**
 * Asserts the full scroll-edge behaviour on `header`:
 *  - at the top of the page: no `.header-scroll-edge`, computed box-shadow
 *    `none`, and no hard bottom border (the old `border-b` is gone);
 *  - after content scrolls under it: `.header-scroll-edge` present, a real
 *    box-shadow, and the header's own box height is unchanged (no CLS);
 *  - resets scroll afterwards.
 */
export async function assertHeaderScrollEdge(
  page: Page,
  header: Locator,
  label: string,
): Promise<void> {
  await expect(header, `${label}: header not visible`).toBeVisible();
  await resetScroll(page);
  await expect(header, `${label}: edge shown before any scroll`).not.toHaveClass(
    /header-scroll-edge/,
  );

  const atTop = await readHeader(header);
  expect(atTop.boxShadow, `${label}: header carries a box-shadow at scroll top`).toBe('none');
  expect(
    atTop.borderBottomWidth,
    `${label}: header still renders a hard bottom border (${atTop.borderBottomWidth}) — should be a scroll-edge shadow, not a divider`,
  ).toBe('0px');

  await scrollPageBy(page, 400);
  await expect(header, `${label}: edge shadow class did not appear after scroll`).toHaveClass(
    /header-scroll-edge/,
  );

  const scrolled = await readHeader(header);
  expect(
    scrolled.boxShadow,
    `${label}: no edge shadow painted after scroll (${scrolled.boxShadow})`,
  ).not.toBe('none');
  expect(
    Math.abs(scrolled.height - atTop.height),
    `${label}: header height changed on scroll (${atTop.height}px → ${scrolled.height}px) — layout shift`,
  ).toBeLessThan(0.5);

  await resetScroll(page);
  await expect(header, `${label}: edge shadow did not fade back out at the top`).not.toHaveClass(
    /header-scroll-edge/,
  );
}

/**
 * With `prefers-reduced-motion: reduce` emulated, the header's shadow
 * transition must be neutralised (global guard → `transition-duration: 1ms`)
 * so the edge appears instantly rather than fading.
 */
export async function assertHeaderScrollEdgeInstant(
  header: Locator,
  label: string,
): Promise<void> {
  const transitionDuration = await header.evaluate(
    (el) => getComputedStyle(el).transitionDuration,
  );
  const maxSeconds = Math.max(
    ...transitionDuration.split(',').map((part) => Number.parseFloat(part) || 0),
  );
  expect(
    maxSeconds,
    `${label}: header edge transition not collapsed under reduced motion (transition-duration ${transitionDuration})`,
  ).toBeLessThanOrEqual(0.005);
}

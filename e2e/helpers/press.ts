import type { Locator, Page } from '@playwright/test';

/**
 * Spec 059 US1 — pressed-state (`:active`) sampling helper.
 *
 * `frontend/src/components/ui/press.ts` acknowledges a press with a native
 * CSS `:active` transform: `pressable` shrinks a control to ~97% (a whole
 * card to ~99%), `pressableNudge` shifts `BackLink` ~2px toward its chevron,
 * plus a small `brightness()` nudge on all of them. Under
 * `prefers-reduced-motion` the scale/translate is dropped, the brightness
 * shift stays.
 *
 * This presses `locator` with a real pointer-down, samples its rendered
 * geometry + relevant computed styles *before releasing*, then releases the
 * pointer well off the control so no click / navigation side effect fires
 * (which also mirrors acceptance scenario 3 — "drag off before release
 * cancels, no action fires"). Reading `boundingBox()` — the post-transform
 * box — rather than a specific computed property keeps callers independent of
 * whether Tailwind v4 emits `scale:` or `transform:` for a given utility.
 */
export interface PressSample {
  restingWidth: number;
  restingX: number;
  pressedWidth: number;
  pressedX: number;
  /** pressedWidth / restingWidth — <1 means the control scaled down. */
  widthRatio: number;
  /** Signed px shift of the left edge while pressed (negative = moved left). */
  xShift: number;
  filter: string;
  scale: string;
  transform: string;
}

export async function samplePress(page: Page, locator: Locator): Promise<PressSample> {
  await locator.scrollIntoViewIfNeeded();
  const resting = await locator.boundingBox();
  if (!resting) throw new Error('control has no bounding box at rest');

  await page.mouse.move(resting.x + resting.width / 2, resting.y + resting.height / 2);
  await page.mouse.down();
  // Deterministic settle: the press transition is 130 ms
  // (--motion-duration-press); under prefers-reduced-motion global.css forces
  // it to 1 ms. 200 ms clears both without depending on animation timing.
  await page.waitForTimeout(200);

  const styles = await locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return { filter: s.filter, scale: s.scale, transform: s.transform };
  });
  const pressed = await locator.boundingBox();
  if (!pressed) throw new Error('control has no bounding box while pressed');

  // Release well off the control, clamped to the viewport, so no click /
  // navigation fires (a mouseup lands an activation only on the element the
  // mousedown started on).
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const controlCenterX = resting.x + resting.width / 2;
  const awayX = controlCenterX > viewport.width / 2 ? 5 : viewport.width - 5;
  await page.mouse.move(awayX, Math.min(resting.y + 300, viewport.height - 5));
  await page.mouse.up();

  return {
    restingWidth: resting.width,
    restingX: resting.x,
    pressedWidth: pressed.width,
    pressedX: pressed.x,
    widthRatio: pressed.width / resting.width,
    xShift: pressed.x - resting.x,
    filter: styles.filter,
    scale: styles.scale,
    transform: styles.transform,
  };
}

/** A standard `pressable` control: scales to ~97% and keeps a brightness nudge. */
export function expectPressed(sample: PressSample) {
  if (!(sample.widthRatio > 0.93 && sample.widthRatio < 0.99)) {
    throw new Error(
      `expected a ~97% press scale-down, got widthRatio ${sample.widthRatio.toFixed(4)}`,
    );
  }
  if (!sample.filter.includes('brightness')) {
    throw new Error(`expected a brightness() press nudge, got filter "${sample.filter}"`);
  }
}

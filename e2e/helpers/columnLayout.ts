import { expect, type Page } from '@playwright/test';

/**
 * Spec 065 (US1/US3) — `useIndependentColumnLayout` positions each rail/
 * content card via `ResizeObserver` callbacks that fire asynchronously after
 * mount (and again whenever a card's measured height changes). Reading
 * `boundingBox()` immediately after the page's first visible content is a
 * race against that measurement pass — usually won on fast/idle hardware,
 * but flaky under CI load or on browser engines with different
 * `ResizeObserver` delivery timing (observed webkit-only in CI).
 *
 * This mirrors `settleEntranceOpacity` in `settleEntrance.ts`: poll the
 * layout's geometry until two consecutive reads agree (no ResizeObserver
 * callback is still pending), then let the caller's own assertions run
 * against that settled geometry. It does not assert correctness itself —
 * only that measuring won't be racing an in-flight reflow.
 */
export async function waitForColumnLayoutSettled(
  page: Page,
  testIds: string[],
  timeout = 5000,
): Promise<void> {
  let previous: string | null = null;
  await expect
    .poll(
      async () => {
        const current = await page.evaluate((ids) => {
          return ids
            .map((id) => {
              const el = document.querySelector(`[data-testid="${id}"]`);
              if (!el) return `${id}:missing`;
              const rect = el.getBoundingClientRect();
              return `${id}:${Math.round(rect.top)}:${Math.round(rect.height)}`;
            })
            .join('|');
        }, testIds);
        const stable = current === previous;
        previous = current;
        return stable;
      },
      { timeout },
    )
    .toBe(true);
}

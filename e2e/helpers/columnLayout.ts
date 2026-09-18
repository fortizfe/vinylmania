import { expect, type Page } from '@playwright/test';

/**
 * Spec 065 (US1/US3) — `useIndependentColumnLayout` positions each rail/
 * content card via `ResizeObserver` callbacks that fire asynchronously after
 * mount (and again whenever a card's measured height changes), applying the
 * result as an inline `top` style. Reading geometry immediately after the
 * page's first visible content races that measurement pass.
 *
 * `Locator.boundingBox()` is deliberately NOT used here: CI runs surfaced a
 * webkit-only case where `boundingBox()` (a separate CDP round-trip) reported
 * a stale, overlapping geometry for these cards, while a screenshot taken at
 * the exact same failure — and this helper's own `page.evaluate` reads,
 * confirmed stable across repeated polls — showed the correct, gap-free
 * layout. Reading geometry via `getBoundingClientRect()` from inside the
 * page's own JS forces a synchronous layout flush in the renderer itself,
 * sidestepping whatever caching/timing quirk affects `boundingBox()` there.
 *
 * This mirrors `settleEntranceOpacity` in `settleEntrance.ts`: poll geometry
 * until two consecutive reads agree (no `ResizeObserver` callback pending or
 * in-flight commit), then hand back that settled geometry for assertions.
 */
export interface CardBox {
  top: number;
  height: number;
}

async function readCardGeometry(
  page: Page,
  testIds: string[],
): Promise<Record<string, CardBox>> {
  return page.evaluate((ids) => {
    const result: Record<string, { top: number; height: number }> = {};
    for (const id of ids) {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      result[id] = { top: rect.top, height: rect.height };
    }
    return result;
  }, testIds);
}

/**
 * Waits until every `testIds` element's geometry is unchanged across two
 * consecutive reads, then returns that settled geometry keyed by test id.
 * Throws (via `expect.poll`) if it never stabilizes within `timeout`.
 */
export async function waitForStableCardGeometry(
  page: Page,
  testIds: string[],
  timeout = 5000,
): Promise<Record<string, CardBox>> {
  let previous: string | null = null;
  let latest: Record<string, CardBox> = {};
  await expect
    .poll(
      async () => {
        latest = await readCardGeometry(page, testIds);
        const current = JSON.stringify(latest);
        const stable = current === previous;
        previous = current;
        return stable;
      },
      { timeout },
    )
    .toBe(true);
  return latest;
}

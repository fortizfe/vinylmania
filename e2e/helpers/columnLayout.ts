import { expect, type Page } from '@playwright/test';

/**
 * Spec 065 (US1/US3) — `useIndependentColumnLayout` measures card heights
 * synchronously before first paint, then re-positions cards from
 * `ResizeObserver` callbacks when a height changes later (image loads, font
 * swaps, a section resolving its data).
 *
 * This mirrors `settleEntranceOpacity` in `settleEntrance.ts`: poll geometry
 * until two consecutive reads agree, then hand back that settled geometry for
 * assertions. All cards are read in one `page.evaluate`, so the returned
 * boxes are a single consistent snapshot rather than N separate round-trips.
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

import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  endMessage,
  expectedIds,
  itemCount,
  mockLibrary,
  renderedIds,
  scrollUntil,
  signIn,
} from '../helpers/libraryFixture';

/**
 * Feature 068 — US3, the dual-layout controls bar (T038, quickstart §3
 * scenarios 1–3; FR-016–FR-019, FR-021a, FR-024; SC-005).
 *
 * One bar element, restyled by breakpoint (research D15, contracts
 * /library-ui.md §3):
 *   • < 640 px — a floating capsule fixed 16 px above the bottom edge, with
 *     the view toggle and a "Sort & Filter" button opening a bottom sheet;
 *   • ≥ 640 px — a sticky toolbar under the app header (`top: --header-h`)
 *     spanning the `<main>` content width, with the view toggle, the native
 *     sort `<select>` and a "Filters" button opening the end drawer.
 *
 * The bar is located structurally rather than by a testid: it is the nearest
 * positioned (`fixed` below 640 px, `sticky` above) ancestor of the single
 * `ViewModeToggle`. That is exactly what FR-016/FR-018 require, so the
 * locator itself is the assertion — today's in-flow US1 bar has no such
 * ancestor and every geometry scenario below fails on it.
 *
 * Accessibility (axe, keyboard-only walk, material contrast, reduced motion)
 * is quickstart §3 scenarios 4–7 and lands in this file with T062 (US4).
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface BarMetrics {
  position: string;
  rect: Rect;
  className: string;
}

/** The controls bar = the nearest `fixed`/`sticky` ancestor of the view toggle. */
async function barMetrics(page: Page): Promise<BarMetrics | null> {
  return page.evaluate(() => {
    let el = document.querySelector('[data-testid="view-mode-toggle"]')?.parentElement ?? null;
    while (el && el !== document.body) {
      const position = getComputedStyle(el).position;
      if (position === 'fixed' || position === 'sticky') {
        return {
          position,
          rect: el.getBoundingClientRect().toJSON() as Rect,
          className: el.className,
        };
      }
      el = el.parentElement;
    }
    return null;
  });
}

async function requireBar(page: Page): Promise<BarMetrics> {
  const bar = await barMetrics(page);
  expect(
    bar,
    'no fixed/sticky controls bar wraps the view toggle (FR-016 capsule / FR-018 sticky toolbar)',
  ).not.toBeNull();
  return bar!;
}

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const rectOf = async (locator: Locator): Promise<Rect> =>
  locator.evaluate((el) => el.getBoundingClientRect().toJSON() as Rect);

/** Resolves `--header-h` to CSS px without duplicating its rem value. */
const headerHeight = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;height:var(--header-h);width:0';
    document.body.append(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  });

/** `<main>`'s content-box width — what the toolbar must span (contracts §3). */
const mainContentWidth = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('main')!;
    const style = getComputedStyle(main);
    return (
      main.getBoundingClientRect().width -
      Number.parseFloat(style.paddingLeft) -
      Number.parseFloat(style.paddingRight)
    );
  });

const sortFilterTrigger = (page: Page) => page.getByRole('button', { name: /^Sort & Filter/ });
const filtersTrigger = (page: Page) => page.getByRole('button', { name: /^Filters/ });
/** Header record count, "N records" / "1 record" (contracts §4). */
const recordCount = (page: Page) => page.getByText(/^\d+ records?$/);

/** Opens a facet's native `<details>` disclosure and returns an option checkbox. */
async function facetOption(panel: Locator, facet: string, option: string): Promise<Locator> {
  const summary = panel.getByText(new RegExp(`^${facet}(\\s*\\(\\d+ selected\\))?$`));
  await summary.click();
  return panel.getByLabel(option, { exact: true });
}

const JAZZ = expectedIds({ sort: 'added', dir: 'desc', genre: 'Jazz' });
const ROCK = expectedIds({ sort: 'added', dir: 'desc', genre: 'Rock' });

// --- Scenario 1: the mobile capsule -----------------------------------------

test.describe('Library capsule at 390 × 844 (US3 AS1/AS5/AS6, FR-016, FR-019, FR-024)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the controls sit in a floating capsule whose bottom is 16 px above the viewport bottom', async ({
    page,
  }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    await expect.poll(() => itemCount(page)).toBe(20);

    const bar = await requireBar(page);
    expect(bar.position).toBe('fixed');
    // 16 px + the safe-area inset, which is 0 in a headless viewport.
    expect(844 - bar.rect.bottom).toBeCloseTo(16, 0);

    // It holds the view toggle and the combined "Sort & Filter" trigger, and
    // the desktop-only sort select is not rendered at this width.
    await expect(sortFilterTrigger(page)).toBeVisible();
    const triggerRect = await rectOf(sortFilterTrigger(page));
    expect(overlaps(triggerRect, bar.rect)).toBe(true);
    await expect(page.locator('#library-sort')).toBeHidden();
  });

  test('every interactive element in the capsule is at least 44 × 44 CSS px (SC-005)', async ({
    page,
  }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    await expect.poll(() => itemCount(page)).toBe(20);

    await requireBar(page);
    const targets = await page.evaluate(() => {
      let el = document.querySelector('[data-testid="view-mode-toggle"]')?.parentElement ?? null;
      while (el && el !== document.body && !['fixed', 'sticky'].includes(getComputedStyle(el).position)) {
        el = el.parentElement;
      }
      if (!el || el === document.body) return [];
      return [...el.querySelectorAll('button, a, select, summary, input:not([type="hidden"])')].map(
        (node) => {
          const r = node.getBoundingClientRect();
          const label =
            node.getAttribute('aria-label') ?? node.textContent?.trim().slice(0, 40) ?? node.tagName;
          return { label, width: r.width, height: r.height };
        },
      );
    });

    expect(targets.length).toBeGreaterThan(0);
    const tooSmall = targets.filter((t) => t.width < 44 || t.height < 44);
    expect(tooSmall, JSON.stringify(tooSmall, null, 2)).toEqual([]);
  });

  test('at the end of the list the capsule covers neither the last record nor the end message (AS5)', async ({
    page,
  }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library?genre=Jazz');
    await expect.poll(() => renderedIds(page)).toEqual(JAZZ.slice(0, 20));

    await scrollUntil(page, () => endMessage(page).isVisible());
    expect(await renderedIds(page)).toHaveLength(JAZZ.length);

    const bar = await requireBar(page);
    const lastCard = await rectOf(page.locator('[data-testid="library-record-grid"] > li').last());
    const end = await rectOf(endMessage(page));
    expect(overlaps(lastCard, bar.rect), 'the capsule overlaps the last record').toBe(false);
    expect(overlaps(end, bar.rect), 'the capsule overlaps the end message').toBe(false);
  });

  test('the capsule does not cover the retry alert when a batch fails (FR-019)', async ({
    page,
  }) => {
    const mock = await mockLibrary(page);
    mock.failPages.add(2);
    await signIn(page);
    await page.goto('/app/library?genre=Jazz');
    await expect.poll(() => renderedIds(page)).toEqual(JAZZ.slice(0, 20));

    const alert = page.getByRole('alert').filter({ hasText: "Couldn't load more records" });
    const retry = page.getByRole('button', { name: 'Retry' });
    await scrollUntil(page, () => retry.isVisible());

    const bar = await requireBar(page);
    expect(overlaps(await rectOf(alert), bar.rect), 'the capsule overlaps the alert').toBe(false);
    expect(overlaps(await rectOf(retry), bar.rect), 'the capsule overlaps Retry').toBe(false);
  });
});

// --- Scenario 2: the bottom sheet --------------------------------------------

test.describe('"Sort & Filter" sheet at 390 × 844 (US3 AS2/AS7, FR-017, FR-021a)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function openSheet(page: Page): Promise<{ trigger: Locator; sheet: Locator }> {
    const trigger = sortFilterTrigger(page);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await trigger.click();
    const sheet = page.getByRole('dialog', { name: 'Sort & Filter' });
    await expect(sheet).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.waitForTimeout(450); // settle the enter spring before measuring/dragging
    return { trigger, sheet };
  }

  /** Slow 1:1 downward drag from the sheet's grab handle, past the 45 % detent. */
  async function dragDown(page: Page, surface: Locator) {
    const box = (await surface.boundingBox())!;
    const startX = box.x + box.width / 2;
    const startY = box.y + 12;
    const distance = box.height * 0.6;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let step = 1; step <= 10; step += 1) {
      await page.mouse.move(startX, startY + (distance * step) / 10, { steps: 1 });
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
  }

  const DISMISSALS: Record<string, (page: Page, sheet: Locator) => Promise<void>> = {
    Escape: async (page) => page.keyboard.press('Escape'),
    'the Close button': async (_page, sheet) =>
      sheet.getByRole('button', { name: 'Close' }).click(),
    'a scrim click': async (page) =>
      page.getByTestId('modal-backdrop').click({ position: { x: 195, y: 24 } }),
    'a drag down': async (page) => dragDown(page, page.getByTestId('sheet-surface')),
  };

  for (const [how, dismiss] of Object.entries(DISMISSALS)) {
    test(`${how} dismisses the sheet and returns focus to "Sort & Filter" (AS2)`, async ({
      page,
    }) => {
      await mockLibrary(page);
      await signIn(page);
      await page.goto('/app/library');
      await expect.poll(() => itemCount(page)).toBe(20);

      const { trigger, sheet } = await openSheet(page);
      await dismiss(page, sheet);

      await expect(sheet).toHaveCount(0);
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toBeFocused();
    });
  }

  test('picking a sort radio applies it live and leaves the sheet open (FR-017)', async ({
    page,
  }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    await expect.poll(() => itemCount(page)).toBe(20);

    const { sheet } = await openSheet(page);
    // One radio group named "library-sort" across three criterion fieldsets
    // (contracts §4): the option label is the accessible name.
    const option = sheet.getByRole('radio', { name: 'Artist (A → Z)' });
    await option.check();

    await expect(page).toHaveURL(/[?&]sort=artist(&|$)/);
    await expect(page).toHaveURL(/[?&]dir=asc(&|$)/);
    await expect(option).toBeChecked();
    await expect(sheet).toBeVisible();
    await expect
      .poll(() => renderedIds(page))
      .toEqual(expectedIds({ sort: 'artist', dir: 'asc' }).slice(0, 20));
  });

  test('ticking a genre updates the badge and the record count while focus stays on the checkbox (AS7)', async ({
    page,
  }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    await expect.poll(() => itemCount(page)).toBe(20);
    await expect(recordCount(page)).toHaveText('205 records');

    const { sheet } = await openSheet(page);
    const rock = await facetOption(sheet, 'Genre', 'Rock');
    await rock.check();

    // Applied live: no Apply button anywhere in the sheet (FR-021a).
    await expect(sheet.getByRole('button', { name: /apply/i })).toHaveCount(0);
    await expect(page).toHaveURL(/[?&]genre=Rock(&|$)/);
    await expect(rock).toBeFocused();
    await expect(recordCount(page)).toHaveText(`${ROCK.length} records`);
    await expect(sortFilterTrigger(page)).toHaveAccessibleName(/1 active filter/);
    await expect.poll(() => renderedIds(page)).toEqual(ROCK.slice(0, 20));
  });
});

// --- Scenario 3: the sticky desktop toolbar ----------------------------------

test.describe('Sticky toolbar at 1280 × 800 (US3 AS3, FR-018, FR-021a)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the toolbar sticks under the app header at top = --header-h after scrolling 2000 px', async ({
    page,
  }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    await expect.poll(() => itemCount(page)).toBe(20);

    const beforeScroll = await requireBar(page);
    expect(beforeScroll.position).toBe('sticky');

    await scrollUntil(page, async () => (await itemCount(page)) >= 60);
    await page.evaluate(() => window.scrollTo(0, 2000));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(2000);

    const bar = await requireBar(page);
    expect(bar.rect.top).toBeCloseTo(await headerHeight(page), 0);
  });

  test('changing the sort select writes sort and dir to the URL', async ({ page }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    await expect.poll(() => itemCount(page)).toBe(20);

    const bar = await requireBar(page);
    const select = page.locator('#library-sort');
    await expect(select).toBeVisible();
    expect(overlaps(await rectOf(select), bar.rect), 'the select is not inside the toolbar').toBe(
      true,
    );

    await select.selectOption({ label: 'Album (Z → A)' });
    await expect(page).toHaveURL(/[?&]sort=album(&|$)/);
    await expect(page).toHaveURL(/[?&]dir=desc(&|$)/);
  });

  test('"Filters" opens the end drawer with the same live filters (AS3, AS7)', async ({ page }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    await expect.poll(() => itemCount(page)).toBe(20);

    const trigger = filtersTrigger(page);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await trigger.click();

    const drawer = page.getByRole('dialog', { name: 'Filters' });
    await expect(drawer).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // The drawer is the end-anchored Sheet, not the centred modal.
    await expect(page.getByTestId('sheet-surface')).toHaveAttribute('data-variant', 'end');
    // Same live filter content as the mobile sheet: no Apply, no sort radios.
    await expect(drawer.getByRole('button', { name: /apply/i })).toHaveCount(0);
    await expect(drawer.getByRole('radio')).toHaveCount(0);

    const rock = await facetOption(drawer, 'Genre', 'Rock');
    await rock.check();
    await expect(page).toHaveURL(/[?&]genre=Rock(&|$)/);
    await expect(rock).toBeFocused();
    await expect(trigger).toHaveAccessibleName(/1 active filter/);
    await expect.poll(() => renderedIds(page)).toEqual(ROCK.slice(0, 20));

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('"Clear all filters" clears every active filter and keeps focus on itself (FR-021a)', async ({
    page,
  }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library?genre=Rock');
    await expect.poll(() => renderedIds(page)).toEqual(ROCK.slice(0, 20));

    await filtersTrigger(page).click();
    const drawer = page.getByRole('dialog', { name: 'Filters' });
    const clear = drawer.getByRole('button', { name: 'Clear all filters' });
    await expect(clear).toBeVisible();
    await expect(clear).not.toHaveAttribute('aria-disabled', 'true');

    await clear.click();

    await expect(page).not.toHaveURL(/genre=/);
    await expect(clear).toBeFocused();
    await expect(clear).toHaveAttribute('aria-disabled', 'true');
    await expect(recordCount(page)).toHaveText('205 records');
  });
});

// --- Scenario 3 (cont.): the toolbar spans the page's content width ----------

test.describe('Toolbar width follows the <main> content width (FR-018)', () => {
  for (const { width, label, expected } of [
    // ≥ 1280 px: `xl:max-w-7xl` (80rem) − `sm:p-8` (2rem each side).
    { width: 1440, label: 'the wide content width (xl:max-w-7xl)', expected: 1280 - 64 },
    // < 1280 px: `max-w-4xl` (56rem) − `sm:p-8`.
    { width: 1100, label: 'the regular content width (max-w-4xl)', expected: 896 - 64 },
  ]) {
    test(`at ${width} px the toolbar spans ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockLibrary(page);
      await signIn(page);
      await page.goto('/app/library');
      await expect.poll(() => itemCount(page)).toBe(20);

      const bar = await requireBar(page);
      const content = await mainContentWidth(page);
      expect(content).toBeCloseTo(expected, 0);
      expect(bar.rect.width).toBeCloseTo(content, 0);
    });
  }
});

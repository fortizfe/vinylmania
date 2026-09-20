import { expect, type Locator, type Page, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { getContrastRatio, type Rgb, toRgb } from '../helpers/contrast';
import { assertSharedFocusRing } from '../helpers/focusRing';
import { getActiveTheme } from '../helpers/theme';
import {
  endMessage,
  expectedIds,
  itemCount,
  mockLibrary,
  RECORD_LINKS,
  renderedIds,
  scrollUntil,
  signIn,
} from '../helpers/libraryFixture';
import {
  collectMotionFrames,
  expectNoTransformMotion,
  startMotionRecorder,
} from '../helpers/motion';

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
 * is quickstart §3 scenarios 4–7, added below by T062 (US4).
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

/**
 * The same bar as a `Locator`, by tagging it in the page — computed-style and
 * contrast helpers take locators, and the bar has no testid of its own (it is
 * defined by its position, see above).
 */
async function barLocator(page: Page): Promise<Locator> {
  await page.evaluate(() => {
    let el = document.querySelector('[data-testid="view-mode-toggle"]')?.parentElement ?? null;
    while (el && el !== document.body && !['fixed', 'sticky'].includes(getComputedStyle(el).position)) {
      el = el.parentElement;
    }
    if (el && el !== document.body) el.setAttribute('data-e2e-bar', '');
  });
  const bar = page.locator('[data-e2e-bar]');
  await expect(
    bar,
    'no fixed/sticky controls bar wraps the view toggle (FR-016 capsule / FR-018 sticky toolbar)',
  ).toHaveCount(1);
  return bar;
}

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const rectOf = async (locator: Locator): Promise<Rect> =>
  locator.evaluate((el) => el.getBoundingClientRect().toJSON() as Rect);

/**
 * A batch rendered after the last scroll grows the document, leaving the page
 * short of the bottom — where the fixed capsule does cover the end of the
 * list. Geometry assertions must wait for the settled, scrolled-to-bottom
 * state, not merely for the element to exist.
 */
const atBottom = (page: Page) =>
  page.evaluate(
    () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1,
  );

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
      return [...el.querySelectorAll('button, a, select, summary, input:not([type="hidden"])')]
        // The `hidden sm:*` sort <select> and "Filters" trigger stay in the DOM at
        // 390 px (CSS-only hiding, asserted by T049) but are display:none, so their
        // boxes are 0 × 0. Only what the user can actually hit has a touch target.
        .filter((node) => node.checkVisibility())
        .map((node) => {
          const r = node.getBoundingClientRect();
          const label =
            node.getAttribute('aria-label') ?? node.textContent?.trim().slice(0, 40) ?? node.tagName;
          return { label, width: r.width, height: r.height };
        });
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

    await scrollUntil(page, async () => (await endMessage(page).isVisible()) && atBottom(page));
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
    await scrollUntil(page, async () => (await retry.isVisible()) && atBottom(page));

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

// ============================================================================
// US4 — rigorous accessibility and system preferences (T062, quickstart §3
// scenarios 4–7): SC-003, SC-004, FR-023, FR-025, FR-027.
// ============================================================================

/** A one-line description of whatever currently has focus, for trap reports. */
const describeActive = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return 'body';
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 28);
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${name ? `[${name}]` : ''}`;
  });

const isFocused = (locator: Locator) =>
  locator.evaluate((el) => el === document.activeElement).catch(() => false);

/**
 * Tabs forward until `target` holds focus, and reports the whole focus path
 * when it never does — which is what a keyboard trap looks like from the
 * outside (contracts §6: header → bar → records → end message/Retry).
 */
async function tabUntil(page: Page, target: Locator, label: string, max = 30): Promise<string[]> {
  const path: string[] = [];
  for (let step = 0; step < max; step += 1) {
    if (await isFocused(target)) return path;
    await page.keyboard.press('Tab');
    const active = await describeActive(page);
    // A trap also shows up as the same element coming back forever.
    path.push(active);
  }
  expect(
    await isFocused(target),
    `${label}: never reached after ${max} Tab presses — focus path: ${path.join(' → ')}`,
  ).toBe(true);
  return path;
}

// --- Scenario 4: the keyboard-only walk (SC-004, FR-025, contracts §6) -------

test.describe('Keyboard-only operation at 1280 × 800 (SC-004, FR-025)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('sort, Filters, a facet and Escape are all reachable by Tab with a visible focus ring', async ({
    page,
  }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    await expect.poll(() => itemCount(page)).toBe(20);

    // 1. Tab from the top of the document to the sort select.
    const select = page.locator('#library-sort');
    await tabUntil(page, select, 'the sort select');
    await assertSharedFocusRing(select, 'sort select');

    // 2. Change the sort with the keyboard alone, and it applies immediately
    //    (contracts §6). Type-ahead rather than ArrowDown: on macOS the arrow
    //    keys open the OS-owned popup instead of moving the value, so an
    //    arrow-based assertion would pass on CI and fail on a Mac.
    await select.press('a');
    await expect(page).toHaveURL(/[?&]sort=(artist|album)(&|$)/);
    await expect(select).toBeFocused();

    // 3. Tab on to "Filters" and open the drawer with Enter.
    const filters = filtersTrigger(page);
    await tabUntil(page, filters, '"Filters"');
    await assertSharedFocusRing(filters, '"Filters" trigger');
    await filters.press('Enter');
    const drawer = page.getByRole('dialog', { name: 'Filters' });
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(450);

    // 4. Focus moves into the drawer and is trapped there while it is open.
    await expect
      .poll(() => drawer.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);
    for (let step = 0; step < 20; step += 1) await page.keyboard.press('Tab');
    expect(
      await drawer.evaluate((el) => el.contains(document.activeElement)),
      'focus escaped the open drawer (contracts §6: Tab cycles inside it)',
    ).toBe(true);

    // 5. Tick and untick a genre from the keyboard; focus stays on the facet.
    const summary = drawer.locator('summary').filter({ hasText: /^Genre/ });
    await tabUntil(page, summary, 'the Genre disclosure');
    await summary.press('Enter');
    const rock = drawer.getByLabel('Rock', { exact: true });
    await tabUntil(page, rock, 'the Genre "Rock" checkbox');
    await assertSharedFocusRing(rock, '"Rock" checkbox');
    await rock.press('Space');
    await expect(page).toHaveURL(/[?&]genre=Rock(&|$)/);
    await expect(rock).toBeChecked();
    await expect(rock).toBeFocused();
    await rock.press('Space');
    await expect(rock).not.toBeChecked();
    await expect(page).not.toHaveURL(/genre=/);
    await expect(rock).toBeFocused();

    // 6. Escape closes it and returns focus to the trigger.
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(filters).toBeFocused();
  });

  test('records, Space-scrolling a new batch and Retry are keyboard-reachable', async ({
    page,
  }) => {
    const mock = await mockLibrary(page);
    mock.failPages.add(3);
    await signIn(page);
    await page.goto('/app/library');
    await expect.poll(() => itemCount(page)).toBe(20);

    // Tab past the bar into the list — no trap in the toolbar.
    const firstRecord = page.locator(RECORD_LINKS).first();
    await tabUntil(page, firstRecord, 'the first record link');
    await expectVisibleFocusIndicator(firstRecord, 'first record link');

    // Space scrolls, which loads batch 2 and then fails on batch 3 (FR-019).
    const alert = page.getByRole('alert').filter({ hasText: "Couldn't load more records" });
    for (let press = 0; press < 40 && !(await alert.isVisible()); press += 1) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);
    }
    expect(await itemCount(page), 'Space never loaded a further batch').toBeGreaterThan(20);
    await expect(alert).toBeVisible();

    // Retry is in the tab order after the records and recovers from there.
    mock.failPages.delete(3);
    const retry = page.getByRole('button', { name: 'Retry' });
    await tabUntil(page, retry, '"Retry"', 60);
    await assertSharedFocusRing(retry, '"Retry" button');
    await retry.press('Enter');
    await expect(alert).toHaveCount(0);
    await expect.poll(() => itemCount(page)).toBeGreaterThanOrEqual(60);
  });
});

/**
 * A focus indicator that is actually painted — either the shared `focusRing`
 * box-shadow or the UA outline, which whole-card `<Link>`s keep by design
 * (they compose `pressableCard`, not `focusRing`). FR-025 asks for a visible
 * ring at each step, not for one specific treatment on a record card.
 */
async function expectVisibleFocusIndicator(locator: Locator, label: string): Promise<void> {
  await locator.focus();
  const { outlineStyle, outlineWidth, outlineColor, boxShadow } = await locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      outlineStyle: s.outlineStyle,
      outlineWidth: s.outlineWidth,
      outlineColor: s.outlineColor,
      boxShadow: s.boxShadow,
    };
  });
  const transparent = /,\s*0\s*\)$/.test(outlineColor);
  const outlineVisible =
    outlineStyle === 'auto' ||
    (outlineStyle !== 'none' && Number.parseFloat(outlineWidth) > 0 && !transparent);
  const ringVisible = (boxShadow.match(/rgba?\([^)]*\)/g) ?? []).some(
    (color) => !/,\s*0\s*\)$/.test(color),
  );
  expect(
    outlineVisible || ringVisible,
    `${label}: no visible focus indicator (outline ${outlineStyle} ${outlineWidth} ${outlineColor}, box-shadow "${boxShadow}")`,
  ).toBe(true);
}

// --- Scenario 5: the axe matrix (SC-003) ------------------------------------

/** Collects `runAxeScan`'s serious/critical violations, tagged by state. */
async function scanInto(found: string[], page: Page, state: string): Promise<void> {
  for (const violation of await runAxeScan(page)) {
    const where = violation.nodes
      .slice(0, 3)
      .map((node) => node.target.join(' '))
      .join('; ');
    found.push(`${state}: ${violation.id} (${violation.impact}) — ${violation.help} [${where}]`);
  }
}

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

test.describe('Axe: light/dark × 390/1280 × loading/loaded/end/error/panel open (SC-003)', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const viewport of VIEWPORTS) {
      // All states of one (theme, width) cell are scanned in a single test and
      // reported together: an early `expect` would hide the later states.
      test(`no violations in the loading, loaded and panel-open states at ${viewport.width} px in ${theme} mode`, async ({
        page,
      }) => {
        const found: string[] = [];
        await page.setViewportSize({ ...viewport });
        await page.emulateMedia({ colorScheme: theme });
        await mockLibrary(page);
        await signIn(page);

        // Loading: hold the first batch open so the skeletons are on screen.
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route('**/api/library*', async (route) => {
          await gate;
          await route.fallback();
        });
        await page.goto('/app/library');
        await expect(page.getByTestId('record-card-skeleton').first()).toBeVisible();
        await scanInto(found, page, 'loading');

        release();
        await expect.poll(() => itemCount(page)).toBe(20);
        await scanInto(found, page, 'loaded');

        // Panel open: the sheet below 640 px, the drawer above it.
        const trigger = viewport.width < 640 ? sortFilterTrigger(page) : filtersTrigger(page);
        await trigger.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.waitForTimeout(450);
        await scanInto(found, page, 'panel open');

        expect(found, found.join('\n')).toEqual([]);
      });

      test(`no violations in the end and error states at ${viewport.width} px in ${theme} mode`, async ({
        page,
      }) => {
        const found: string[] = [];
        await page.setViewportSize({ ...viewport });
        await page.emulateMedia({ colorScheme: theme });
        const mock = await mockLibrary(page);
        await signIn(page);

        await page.goto('/app/library?genre=Jazz');
        await expect.poll(() => renderedIds(page)).toEqual(JAZZ.slice(0, 20));
        await scrollUntil(page, () => endMessage(page).isVisible());
        await scanInto(found, page, 'end of list');

        mock.failPages.add(2);
        await page.goto('/app/library?genre=Rock');
        await expect.poll(() => renderedIds(page)).toEqual(ROCK.slice(0, 20));
        const retry = page.getByRole('button', { name: 'Retry' });
        await scrollUntil(page, () => retry.isVisible());
        await scanInto(found, page, 'batch error');

        expect(found, found.join('\n')).toEqual([]);
      });
    }
  }
});

// --- Scenario 6: the chrome material over cover art (FR-023, research D17) ---

/** A solid cover: blur and saturation leave a flat fill unchanged, so the
 *  composite below is exactly D17's worst case (artwork under the 90 % layer). */
const solidCover = (hex: string) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${hex}"/></svg>`,
  ).toString('base64')}`;

interface Backdrop {
  rgb: Rgb;
  layers: string[];
  sawCover: boolean;
  /** Layer colours the canvas could not parse — see `paint` below. */
  unparsed: string[];
}

/**
 * The colour actually painted *behind* `locator`'s centre — the real stacking
 * order (cover art → translucent chrome → the element's own layers), composited
 * through a 1 × 1 canvas, rather than the element container's computed
 * background. The toggle track computes to `rgba(0, 0, 0, 0)`, which reads back
 * as opaque black and makes any foreground look contrasty (the artefact that
 * kept T063 green in `view-mode-toggle.spec.ts`).
 *
 * `includeSelf` = true for text (its own background is part of what the glyphs
 * sit on), false for a fill or a border (the thing being measured).
 */
async function paintedBackdrop(
  locator: Locator,
  coverCss: string,
  includeSelf: boolean,
): Promise<Backdrop> {
  return locator.evaluate(
    (el, { coverCss, includeSelf }) => {
      const rect = el.getBoundingClientRect();
      const y = rect.top + rect.height / 2;

      const sample = (x: number) => {
        const layers: string[] = [];
        let sawCover = false;
        // `elementsFromPoint` is topmost-first; reversed it is paint order.
        for (const node of [...document.elementsFromPoint(x, y)].reverse()) {
          if ((node === el || el.contains(node)) && !includeSelf) continue;
          if (node.tagName === 'IMG') {
            layers.push(coverCss);
            sawCover = true;
            continue;
          }
          const bg = getComputedStyle(node).backgroundColor;
          if (bg && bg !== 'transparent' && !/,\s*0\s*\)$/.test(bg)) layers.push(bg);
        }
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d')!;
        const unparsed: string[] = [];
        // `fillStyle` silently keeps its previous value when handed something
        // it cannot parse, which would paint the layer below twice and read
        // back as a plausible — but wrong — colour. The sentinel catches that.
        const paint = (color: string) => {
          ctx.fillStyle = '#123456';
          ctx.fillStyle = color;
          if (ctx.fillStyle === '#123456' && color.toLowerCase() !== '#123456') {
            unparsed.push(color);
            return;
          }
          ctx.fillRect(0, 0, 1, 1);
        };
        paint('#ffffff');
        for (const layer of layers) paint(layer);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return { rgb: [r, g, b] as [number, number, number], layers, sawCover, unparsed };
      };

      // Several points across the control: at ≥ 640 px the grid's column
      // gutters are wide enough that a single centre probe can miss the
      // artwork entirely and measure the page background instead.
      const samples = [0.1, 0.3, 0.5, 0.7, 0.9].map((fraction) =>
        sample(rect.left + rect.width * fraction),
      );
      return samples.find((s) => s.sawCover) ?? samples[2];
    },
    { coverCss, includeSelf },
  );
}

interface Pairing {
  name: string;
  /** WCAG floor: 4.5 for text (1.4.3), 3 for a component boundary (1.4.11). */
  floor: number;
  property: 'color' | 'borderColor' | 'backgroundColor';
  locator: (page: Page) => Locator;
}

const toggle = (page: Page) => page.getByTestId('view-mode-toggle');
const pill = (page: Page) => page.getByTestId('view-mode-pill');
const inactiveOption = (page: Page) => page.getByTestId('view-mode-list');

const SHARED_PAIRINGS: Pairing[] = [
  { name: 'view toggle track border (stone-500)', floor: 3, property: 'borderColor', locator: toggle },
  // research D17: the primary pill needs an OPAQUE track under it — straight
  // on the dark material it measures 2.49:1.
  { name: 'active view pill fill (primary)', floor: 3, property: 'backgroundColor', locator: pill },
  { name: 'inactive view icon (stone-500/400)', floor: 3, property: 'color', locator: inactiveOption },
];

const CAPSULE_PAIRINGS: Pairing[] = [
  ...SHARED_PAIRINGS,
  { name: '"Sort & Filter" label (stone-900/100)', floor: 4.5, property: 'color', locator: sortFilterTrigger },
  { name: '"Sort & Filter" border (stone-500/border-dark)', floor: 3, property: 'borderColor', locator: sortFilterTrigger },
  {
    name: 'active-filter badge text (stone-900 on accent)',
    floor: 4.5,
    property: 'color',
    locator: (page) => sortFilterTrigger(page).locator('span[aria-hidden="true"]'),
  },
];

const TOOLBAR_PAIRINGS: Pairing[] = [
  ...SHARED_PAIRINGS,
  { name: '"Sort" label (stone-700/300)', floor: 4.5, property: 'color', locator: (page) => page.locator('label[for="library-sort"]') },
  { name: 'sort select text (stone-900/100)', floor: 4.5, property: 'color', locator: (page) => page.locator('#library-sort') },
  { name: 'sort select border (stone-500/border-dark)', floor: 3, property: 'borderColor', locator: (page) => page.locator('#library-sort') },
  { name: '"Filters" label (stone-900/100)', floor: 4.5, property: 'color', locator: filtersTrigger },
  { name: '"Filters" border (stone-500/border-dark)', floor: 3, property: 'borderColor', locator: filtersTrigger },
  {
    name: 'active-filter badge text (stone-900 on accent)',
    floor: 4.5,
    property: 'color',
    locator: (page) => filtersTrigger(page).locator('span[aria-hidden="true"]'),
  },
];

/** Scrolls until cover art is painted under every pairing's measuring point. */
async function scrollCoversUnder(page: Page, pairings: Pairing[], coverCss: string) {
  for (let step = 0; step < 40; step += 1) {
    const backdrops = await Promise.all(
      pairings.map((pairing) => paintedBackdrop(pairing.locator(page), coverCss, false)),
    );
    if (backdrops.every((backdrop) => backdrop.sawCover)) return;
    await page.evaluate(() => window.scrollBy(0, 24));
    await page.waitForTimeout(40);
  }
  expect(
    false,
    'no scroll offset put cover art under every toolbar control — the material was never measured against artwork',
  ).toBe(true);
}

test.describe('Toolbar material contrast over solid cover art (FR-023, research D17)', () => {
  // D17's worst cases: solid black artwork under the light material
  // (→ #e6e6e6), solid white under the dark one (→ #232328).
  for (const { theme, cover } of [
    { theme: 'light', cover: '#000000' },
    { theme: 'dark', cover: '#ffffff' },
  ] as const) {
    for (const viewport of VIEWPORTS) {
      const pairings = viewport.width < 640 ? CAPSULE_PAIRINGS : TOOLBAR_PAIRINGS;

      test(`every ${viewport.width} px control clears its D17 floor over ${cover} covers in ${theme} mode`, async ({
        page,
      }) => {
        await page.setViewportSize({ ...viewport });
        await page.emulateMedia({ colorScheme: theme });
        await mockLibrary(page, { coverUrl: solidCover(cover) });
        await signIn(page);
        // `genre=Rock` so the active-filter badge exists to be measured.
        await page.goto('/app/library?genre=Rock');
        await expect.poll(() => renderedIds(page)).toEqual(ROCK.slice(0, 20));
        await requireBar(page);
        // Otherwise a theme that silently stayed light would measure the wrong
        // half of the D17 table and pass for the wrong reason.
        expect(await getActiveTheme(page), `the page is not in ${theme} mode`).toBe(theme);

        await scrollCoversUnder(page, pairings, cover);

        const failures: string[] = [];
        for (const pairing of pairings) {
          const locator = pairing.locator(page);
          const value = await locator.evaluate(
            (el, property) => getComputedStyle(el)[property as 'color'],
            pairing.property,
          );
          const backdrop = await paintedBackdrop(locator, cover, pairing.property === 'color');
          expect(
            backdrop.unparsed,
            `${pairing.name}: unparseable layer colour(s) — the composite would be wrong`,
          ).toEqual([]);
          const ratio = getContrastRatio(await toRgb(page, value), backdrop.rgb);
          const composited = `rgb(${backdrop.rgb.join(', ')})`;
          const line = `${pairing.name}: ${ratio.toFixed(2)}:1 (${pairing.property} ${value} over composited ${composited}, floor ${pairing.floor}:1, cover under: ${backdrop.sawCover})`;
          console.log(`  [${theme} ${viewport.width}px] ${line}`);
          if (ratio < pairing.floor) {
            failures.push(`${line} — layers: ${backdrop.layers.join(' / ')}`);
          }
        }
        expect(failures, failures.join('\n')).toEqual([]);
      });
    }
  }
});

test.describe('Increased contrast degrades the chrome material (FR-023, research D17)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('under prefers-contrast: more the bar drops its blur and gains a 1 px border', async ({
    page,
  }) => {
    await page.emulateMedia({ contrast: 'more' });
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    await expect.poll(() => itemCount(page)).toBe(20);

    const bar = await barLocator(page);
    const style = await bar.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        backdropFilter: s.backdropFilter,
        webkitBackdropFilter: s.getPropertyValue('-webkit-backdrop-filter'),
        borderStyle: s.borderTopStyle,
        borderWidth: s.borderTopWidth,
        backgroundColor: s.backgroundColor,
      };
    });

    expect(
      style.backdropFilter,
      `the bar still blurs its backdrop under prefers-contrast: more (backdrop-filter "${style.backdropFilter}")`,
    ).toBe('none');
    expect(style.webkitBackdropFilter === '' || style.webkitBackdropFilter === 'none').toBe(true);
    expect(
      style.borderStyle,
      'the bar has no defined edge under prefers-contrast: more (WCAG 1.4.11)',
    ).toBe('solid');
    expect(Number.parseFloat(style.borderWidth)).toBeCloseTo(1, 1);
    // Opaque, so nothing shows through the chrome at all.
    expect(
      /,\s*0?\.\d+\s*\)$/.test(style.backgroundColor),
      `the bar background ${style.backgroundColor} is still translucent`,
    ).toBe(false);
  });
});

// --- Scenario 7: reduced motion (FR-027) ------------------------------------

test.describe('Reduced motion (FR-027)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the sheet neither slides in nor slides out', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    await expect.poll(() => itemCount(page)).toBe(20);

    const selectors = {
      sheet: '[role="dialog"][data-variant="bottom"]',
      scrim: '[data-testid="modal-backdrop"]',
    };

    await startMotionRecorder(page, selectors, 900);
    await sortFilterTrigger(page).click();
    const opening = await collectMotionFrames(page);
    await expect(page.getByRole('dialog', { name: 'Sort & Filter' })).toHaveAttribute(
      'data-reduced-motion',
      'true',
    );
    expectNoTransformMotion(opening.sheet, 'sheet opening under reduced motion');
    expectNoTransformMotion(opening.scrim, 'scrim appearing under reduced motion');

    await startMotionRecorder(page, selectors, 900);
    await page.keyboard.press('Escape');
    const closing = await collectMotionFrames(page);
    await expect(page.getByRole('dialog', { name: 'Sort & Filter' })).toHaveCount(0);
    expectNoTransformMotion(closing.sheet, 'sheet closing under reduced motion');
    expectNoTransformMotion(closing.scrim, 'scrim dismissing under reduced motion');
  });
});

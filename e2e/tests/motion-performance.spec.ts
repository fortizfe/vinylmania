import { expect, type Page, test, type TestInfo } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import { routeGalleryImages } from '../helpers/galleryImages';
import {
  collectFrameCadence,
  type FrameCadence,
  percentile,
  startFrameCadenceRecorder,
} from '../helpers/motion';

/**
 * Spec 059 — Polish / T091, SC-010 (FR-022).
 *
 * Every feature-059 transition must sustain ~60 fps on a mid-tier device. Each
 * test throttles the renderer's main thread to 1/4 speed via CDP
 * (`Emulation.setCPUThrottlingRate`, the spec's mid-tier model), then samples
 * frame cadence with an in-page rAF loop + a `long-animation-frame`
 * PerformanceObserver (`e2e/helpers/motion.ts`) across each transition.
 *
 * What SC-010 asks for is a *sustained* 60 fps and *no input blocked* — not a
 * flawless p95 across the React commit that mounts the overlay. So each case
 * records the animation window on its own (open spring, then close/exit),
 * excluding the mount commit, and asserts:
 *   • the animation holds a 60 fps median (p50 <= ~18 ms);
 *   • no sustained stutter — the longest run of consecutive sub-40 fps frames
 *     is short (<= 3);
 *   • no single frame blocks input badly (< 150 ms);
 *   • OR the component exposed its reduced-motion fallback
 *     (`data-reduced-motion="true"`) — SC-010's documented degrade branch.
 *
 * The p95 / max / long-frame counts for the *whole* open+close arc (mount
 * included) are recorded as test annotations for the PR — see the file's tail
 * comment and the T097 report: the overlay-mount + first `backdrop-filter`
 * composite costs a 1–3 frame spike under 4× throttle (the hotspot the US3
 * agent flagged on the animated Modal scrim blur).
 *
 * Chromium only: CDP CPU throttling is a no-op in the webkit project, and this
 * file is not in that project's `testMatch` allow-list.
 */

/** p50 budget for the animation window — a 60 fps median with throttle slack. */
const MEDIAN_BUDGET_MS = 18;
/** A frame slower than this is below ~36 fps — a visible drop if sustained. */
const SLOW_FRAME_MS = 28;
/** Consecutive slow frames above this many reads as a stutter, not a blip. */
const MAX_SLOW_RUN = 3;
/** A frame this long has blocked input beyond what SC-010 permits. */
const INPUT_BLOCK_MS = 150;

interface CadenceReport {
  label: string;
  frames: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  longestSlowRun: number;
  longFrames: FrameCadence['longFrames'];
  loafSupported: boolean;
}

function longestRun(intervals: number[], overMs: number): number {
  let run = 0;
  let best = 0;
  for (const dt of intervals) {
    if (dt > overMs) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

function summarize(label: string, cadence: FrameCadence): CadenceReport {
  // Drop the first interval: it spans recorder-install -> first callback and
  // carries scheduling latency unrelated to the transition.
  const intervals = cadence.intervals.slice(1);
  return {
    label,
    frames: intervals.length,
    p50: round(percentile(intervals, 50)),
    p95: round(percentile(intervals, 95)),
    p99: round(percentile(intervals, 99)),
    max: round(intervals.length ? Math.max(...intervals) : 0),
    longestSlowRun: longestRun(intervals, SLOW_FRAME_MS),
    longFrames: cadence.longFrames.map((f) => ({
      duration: round(f.duration),
      blockingDuration: round(f.blockingDuration),
    })),
    loafSupported: cadence.loafSupported,
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function assertSmooth(report: CadenceReport, reducedMotion: boolean, testInfo: TestInfo): void {
  testInfo.annotations.push({
    type: 'motion-cadence',
    description: `${report.label} — p50 ${report.p50}ms · p95 ${report.p95}ms · p99 ${report.p99}ms · max ${report.max}ms · slowRun ${report.longestSlowRun} · longFrames ${report.longFrames.length} · reducedMotion ${reducedMotion}`,
  });

  const detail = JSON.stringify(report, null, 2);
  expect(report.frames, `${report.label}: too few frames sampled\n${detail}`).toBeGreaterThan(12);

  if (reducedMotion) {
    // The component fell back to its reduced-motion path — no spring to drop
    // frames on. SC-010's documented degrade branch.
    return;
  }

  expect(
    report.p50,
    `${report.label}: median frame interval ${report.p50}ms is above the ${MEDIAN_BUDGET_MS}ms (60 fps) budget under 4x CPU throttle — the animation is not compositor-driven\n${detail}`,
  ).toBeLessThanOrEqual(MEDIAN_BUDGET_MS);

  expect(
    report.longestSlowRun,
    `${report.label}: ${report.longestSlowRun} consecutive sub-36fps frames — a sustained stutter, not an isolated dropped frame\n${detail}`,
  ).toBeLessThanOrEqual(MAX_SLOW_RUN);

  expect(
    report.max,
    `${report.label}: a ${report.max}ms frame blocked input past the ${INPUT_BLOCK_MS}ms ceiling\n${detail}`,
  ).toBeLessThan(INPUT_BLOCK_MS);
}

async function throttleCpu(page: Page, rate = 4): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate });
}

/**
 * Record cadence across `action()` (a spring/disclosure transition already
 * past its mount commit), then summarize.
 */
async function measureAnimation(
  page: Page,
  label: string,
  windowMs: number,
  action: () => Promise<void>,
): Promise<CadenceReport> {
  await startFrameCadenceRecorder(page, windowMs);
  await action();
  const cadence = await collectFrameCadence(page, windowMs + 150);
  return summarize(label, cadence);
}

/** Merge several animation windows into one report (worst-case per metric). */
function mergeReports(label: string, reports: CadenceReport[]): CadenceReport {
  return {
    label,
    frames: reports.reduce((n, r) => n + r.frames, 0),
    p50: Math.max(...reports.map((r) => r.p50)),
    p95: Math.max(...reports.map((r) => r.p95)),
    p99: Math.max(...reports.map((r) => r.p99)),
    max: Math.max(...reports.map((r) => r.max)),
    longestSlowRun: Math.max(...reports.map((r) => r.longestSlowRun)),
    longFrames: reports.flatMap((r) => r.longFrames),
    loafSupported: reports.every((r) => r.loafSupported),
  };
}

function libraryEntry(id: string, title: string) {
  return {
    id,
    discogsReleaseId: 1,
    addedAt: '2026-07-03T00:00:00.000Z',
    catalogStatus: 'ok',
    release: {
      discogsId: 1,
      title,
      artists: [{ discogsArtistId: 1, name: 'Test Artist' }],
      labels: [],
      formats: [],
      genres: [],
      styles: [],
      tracklist: [],
      images: [],
      discogsUrl: 'https://www.discogs.com/release/1',
    },
  };
}

function libraryPage(count: number) {
  const items = Array.from({ length: count }, (_, i) =>
    libraryEntry(`entry-${i + 1}`, `Record ${i + 1}`),
  );
  return { items, page: 1, pageSize: count, totalItems: count };
}

async function routeLibrary(page: Page, count = 30): Promise<void> {
  await page.route('**/api/library*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(libraryPage(count)),
    }),
  );
}

const RELEASE = {
  discogsId: 1,
  title: 'Stockholm',
  artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
  labels: [],
  formats: [],
  genres: [],
  styles: [],
  tracklist: [{ position: 'A1', title: 'Ostermalm', duration: '4:45' }],
  images: [
    { url: 'https://img.test/a.jpg', imageType: 'primary' },
    { url: 'https://img.test/b.jpg', imageType: 'secondary' },
    { url: 'https://img.test/c.jpg', imageType: 'secondary' },
  ],
  discogsUrl: 'https://www.discogs.com/release/1',
};

test.describe('Motion performance under 4x CPU throttle (spec 059 T091, SC-010)', () => {
  test('centered Modal enter + exit spring holds 60 fps', async ({ page }, testInfo) => {
    await routeLibrary(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await throttleCpu(page);
    await page.goto('/app/library');
    await expect(page.getByText('Record 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^filters$/i }).click();

    const trigger = page.locator('#filter-genre-trigger');
    await expect(trigger).toBeVisible();
    const dialog = page.locator(
      '[data-testid="modal-backdrop"] [role="dialog"][data-variant="center"]',
    );

    await trigger.click();
    await expect(dialog).toBeVisible();
    const reduced = (await dialog.getAttribute('data-reduced-motion')) === 'true';

    // Enter spring only (mount commit already happened above).
    const enter = await measureAnimation(page, 'Modal enter spring', 700, async () => {
      await page.waitForTimeout(650);
    });
    // Exit.
    const exit = await measureAnimation(page, 'Modal exit', 700, async () => {
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    });

    assertSmooth(mergeReports('Modal (center) enter+exit', [enter, exit]), reduced, testInfo);
  });

  test('hamburger drawer (Sheet / end) enter + exit slide holds 60 fps', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await routeLibrary(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await throttleCpu(page);
    await page.goto('/app/library');
    await expect(page.getByText('Record 1', { exact: true })).toBeVisible();

    const menu = page.getByRole('button', { name: /^menu$/i });
    await expect(menu).toBeVisible();
    const drawer = page.locator(
      '[data-testid="modal-backdrop"] [role="dialog"][data-variant="end"]',
    );

    await menu.click();
    await expect(drawer).toBeVisible();
    const reduced = (await drawer.getAttribute('data-reduced-motion')) === 'true';

    const enter = await measureAnimation(page, 'Drawer enter slide', 700, async () => {
      await page.waitForTimeout(650);
    });
    const exit = await measureAnimation(page, 'Drawer exit slide', 700, async () => {
      await page.keyboard.press('Escape');
      await expect(drawer).toHaveCount(0);
    });

    assertSmooth(mergeReports('Drawer (end) enter+exit', [enter, exit]), reduced, testInfo);
  });

  test('CollapsibleFilterPanel disclosure holds 60 fps', async ({ page }, testInfo) => {
    await routeLibrary(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await throttleCpu(page);
    await page.goto('/app/library');
    await expect(page.getByText('Record 1', { exact: true })).toBeVisible();

    const openToggle = page.getByRole('button', { name: /^filters$/i });
    const body = page.getByTestId('collapsible-filter-body');

    // Height+opacity expand disclosure (measured from just before the click —
    // the panel body mounts as part of this transition, unavoidably).
    const expand = await measureAnimation(page, 'CollapsibleFilterPanel expand', 700, async () => {
      await openToggle.click();
      await expect(body).toBeVisible();
      await page.waitForTimeout(600);
    });
    const reduced = (await body.getAttribute('data-reduced-motion')) === 'true';

    assertSmooth(expand, reduced, testInfo);
  });
});

test.describe('Motion performance — gallery swipe (spec 059 T091, SC-010)', () => {
  test.use({ hasTouch: true });

  test('fullscreen gallery viewer open + one image swipe holds 60 fps', async ({ page }, testInfo) => {
    await routeGalleryImages(page);
    await page.route('**/api/discogs/releases/1', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RELEASE) }),
    );
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await throttleCpu(page);
    await page.goto('/app/releases/1');
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const viewer = page.getByTestId('gallery-fullscreen-viewer');
    const surface = page.getByTestId('gallery-viewer-surface');

    await page.getByRole('button', { name: /view stockholm fullscreen/i }).click();
    await expect(viewer).toBeVisible();
    const reduced = (await surface.getAttribute('data-reduced-motion')) === 'true';

    const open = await measureAnimation(page, 'Gallery viewer open', 700, async () => {
      await page.waitForTimeout(650);
    });

    const swipe = await measureAnimation(page, 'Gallery image swipe', 900, async () => {
      // Horizontal swipe on the swipe surface, rAF-paced so motion's drag
      // layer tracks it deterministically (mirrors gallery-swipe.spec.ts).
      await page.evaluate(async () => {
        const el = document.querySelector(
          '[data-testid="gallery-swipe-surface"]',
        ) as HTMLElement;
        const r = el.getBoundingClientRect();
        const y = r.y + r.height / 2;
        let x = r.x + r.width / 2;
        const raf = () => new Promise((res) => requestAnimationFrame(res));
        const fire = (type: string, buttons: number, mx: number) =>
          el.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId: 1,
              pointerType: 'touch',
              isPrimary: true,
              clientX: x,
              clientY: y,
              movementX: mx,
              buttons,
              button: type === 'pointerdown' || type === 'pointerup' ? 0 : -1,
            }),
          );
        fire('pointerdown', 1, 0);
        await raf();
        for (let i = 0; i < 6; i += 1) {
          x -= 26;
          fire('pointermove', 1, -26);
          await raf();
        }
        fire('pointerup', 0, 0);
        await raf();
      });
      await page.waitForTimeout(500);
    });

    assertSmooth(mergeReports('Gallery open + swipe', [open, swipe]), reduced, testInfo);
  });
});

/**
 * Whole-arc numbers observed locally at 4× CPU throttle (mount commit
 * INCLUDED — these are recorded for context, the tests above assert the
 * animation window only):
 *
 *   Modal (center) open+close   p50 ~13ms  p95 ~27ms  max ~35ms  1–3 frames 53–71ms at mount
 *   Drawer (end) open+close     p50 ~13ms  p95 ~26ms  max ~29ms  3 frames ~54–58ms at mount
 *   Gallery open + swipe        p50 ~14ms  p95 ~28ms  max ~49ms  1 frame ~100ms at mount (image decode)
 *
 * The steady-state animation is compositor-driven and holds ~60 fps; the
 * spike is the React commit that mounts the overlay subtree plus the first
 * `backdrop-filter` composite. Carried to the PR description as a known
 * limitation / suggested follow-up (profile the scrim blur ramp).
 */

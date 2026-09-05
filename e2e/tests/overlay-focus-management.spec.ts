import { expect, type Page, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import {
  collectMotionFrames,
  connectedFrames,
  decomposeTransform,
  expectNoSingleFrameJump,
  startMotionRecorder,
} from '../helpers/motion';

/**
 * Spec 059 — User Story 2, SC-003 (interruptibility).
 *
 * When a transition is reversed mid-flight, the animated element continues
 * from its current on-screen value — it never jumps to its start or end
 * transform in a single frame, and input is never locked out.
 *
 * (US3 / T060 extends this file with the focus-trap / focus-restore /
 * scroll-lock coverage for the modal, drawer, and gallery.)
 */

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

async function mockLibrary(page: Page) {
  await page.route('**/api/library*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [libraryEntry('entry-1', 'Stockholm')],
        page: 1,
        pageSize: 20,
        totalItems: 1,
      }),
    });
  });
}

test.describe('Overlay motion is interruptible (spec 059 US2, SC-003)', () => {
  test('closing the centered Modal mid-enter reverses from the current value with no transform jump', async ({
    page,
  }) => {
    await mockLibrary(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByText('Stockholm')).toBeVisible();
    await page.getByRole('button', { name: /^filters$/i }).click();

    const trigger = page.locator('#filter-genre-trigger');
    await expect(trigger).toBeVisible();

    // Recorder running before the overlay mounts, so it captures the whole
    // enter → interrupt → exit arc.
    await startMotionRecorder(page, { dialog: '[role="dialog"][data-variant="center"]' }, 2000);
    await trigger.click();
    await page.waitForTimeout(80); // ~20% into the 400ms enter spring
    await page.keyboard.press('Escape');
    const frames = await collectMotionFrames(page, 2100);

    const seen = connectedFrames(frames.dialog);
    expect(seen.length, 'the dialog was never captured mid-transition').toBeGreaterThanOrEqual(3);

    // No single-frame jump to the start (scale 0.96 / opacity 0) or end
    // (scale 1 / opacity 1) value.
    expectNoSingleFrameJump(frames.dialog, 'Modal (center) interrupted enter', {
      opacity: 0.45,
      scale: 0.05,
      translate: 40,
    });

    // The surface stayed within the animated scale band the whole time — it
    // never snapped fully open before exiting.
    for (const frame of seen) {
      const { scaleX } = decomposeTransform(frame.transform);
      const longhand = Number.parseFloat(frame.scale);
      const scale = Number.isNaN(longhand) ? scaleX : scaleX * longhand;
      expect(
        scale,
        `scale ${scale.toFixed(3)} left the 0.96–1.0 enter band at t=${frame.t.toFixed(0)}ms`,
      ).toBeGreaterThan(0.93);
      expect(scale).toBeLessThan(1.02);
    }

    // Input is not locked out — the overlay finishes closing and the trigger
    // is focusable again.
    await expect(page.locator('[role="dialog"][data-variant="center"]')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('reversing the end-drawer mid-slide tracks back to the edge with no jump to the open position', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const menu = page.getByRole('button', { name: /^menu$/i });
    await expect(menu).toBeVisible();
    const drawer = page.locator('[role="dialog"][data-variant="end"]');

    // Baseline: where the drawer sits once fully open.
    await menu.click();
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(600);
    const restingX = (await drawer.evaluate((el) => el.getBoundingClientRect().x)) as number;
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);

    // Re-open with the recorder already running, then reverse partway
    // through the enter slide.
    await startMotionRecorder(page, { drawer: '[role="dialog"][data-variant="end"]' }, 2500);
    await menu.click();
    await page.waitForTimeout(70); // ~20% into the 350ms enter slide
    await page.keyboard.press('Escape');
    const frames = await collectMotionFrames(page, 2600);

    const seen = connectedFrames(frames.drawer);
    expect(seen.length, 'the drawer was never captured mid-slide').toBeGreaterThanOrEqual(5);

    // No single-frame jump (a snap to open or to fully-closed would show one
    // outsized delta).
    expectNoSingleFrameJump(frames.drawer, 'End-drawer interrupted slide', {
      opacity: 0.5,
      scale: 0.05,
      translate: 130,
    });

    // The drawer never reached its open resting position — the reversal
    // caught it in flight.
    const minX = Math.min(...seen.map((f) => f.x));
    expect(
      minX,
      `drawer reached x=${minX.toFixed(1)}, at/under its open resting x=${restingX.toFixed(1)} — the interrupt did not catch it in flight`,
    ).toBeGreaterThan(restingX + 40);

    // Once it started closing it kept heading toward the edge (spring.sheet
    // has bounce: 0 — no move back toward open beyond spring settle jitter).
    const minIndex = seen.findIndex((f) => f.x === minX);
    for (let i = minIndex + 1; i < seen.length; i += 1) {
      expect(
        seen[i].x,
        `drawer moved back toward open (x ${seen[i].x.toFixed(1)} < ${seen[i - 1].x.toFixed(1)}) at t=${seen[i].t.toFixed(0)}ms while closing`,
      ).toBeGreaterThanOrEqual(seen[i - 1].x - 3);
    }

    await expect(drawer).toHaveCount(0);
    await expect(menu).toBeFocused();
  });
});

import { expect, type Page } from '@playwright/test';

/**
 * Spec 059 — Polish / T097.
 *
 * Waits for every element matching `selector` to reach `opacity: 1` with any
 * Web-Animations entrance no longer running — or resolves immediately if the
 * page renders none.
 *
 * axe-core folds an ancestor's `opacity` into its contrast maths, so an axe
 * scan fired while a feature-059 opacity entrance is still ramping reads the
 * text lighter than its resting colour and reports a false-positive
 * `color-contrast` violation. Every resting state passes; only the entrance
 * window is a problem. This mirrors `settleOverlay` in
 * `overlay-contrast.spec.ts` (the US3 agent's fix for the same issue on
 * overlays). Call it before `runAxeScan` on any page that renders such an
 * entrance.
 *
 * Note on `animationPlayState`: a finite CSS animation's computed
 * `animation-play-state` stays `"running"` after it completes, so this checks
 * the Web-Animations `playState` (which flips to `"finished"`) plus the
 * resting `opacity` instead.
 */
export async function settleEntranceOpacity(page: Page, selector: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((sel) => {
          const nodes = Array.from(document.querySelectorAll<HTMLElement>(sel));
          if (nodes.length === 0) return 'settled';
          const pending = nodes.find((el) => {
            const opaque = Number.parseFloat(getComputedStyle(el).opacity) >= 1;
            const animating = el
              .getAnimations()
              .some((a) => a.playState !== 'finished' && a.playState !== 'idle');
            return animating || !opaque;
          });
          if (!pending) return 'settled';
          const s = getComputedStyle(pending);
          const states = pending.getAnimations().map((a) => a.playState);
          return `${s.opacity}|${states.join(',')}`;
        }, selector),
      { timeout: 4000 },
    )
    .toBe('settled');
}

/**
 * Spec 059 — Polish / T086, scoped in T097.
 *
 * `.status-fade-in` (see `frontend/src/styles/global.css`) runs
 * `@keyframes vinyl-status-fade-in { from { opacity: 0 } to { opacity: 1 } }`
 * for `--motion-duration-fade` (~200 ms) with `both` fill on the
 * `FeedSourceStatusBanner` when a news source starts failing. Call this
 * before `runAxeScan` on any page that can render that banner.
 */
export async function settleStatusFadeIn(page: Page): Promise<void> {
  await settleEntranceOpacity(page, '.status-fade-in');
}

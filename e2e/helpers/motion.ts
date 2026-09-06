import { expect, type Page } from '@playwright/test';

/**
 * Spec 059 US2 — motion sampling helpers.
 *
 * `startMotionRecorder` installs an in-page `requestAnimationFrame` loop that
 * records the geometry + resolved transform of one or more elements, starting
 * on the very next frame. It is installed synchronously so the caller can
 * trigger the interruption (Escape, a second click, a mode switch) on the
 * next line and still capture the frames that straddle it.
 *
 * `collectMotionFrames` waits out the recording window and returns the
 * frames, keyed by the same names passed to the recorder.
 */

export interface MotionFrame {
  /** ms since the recorder started. */
  t: number;
  /** false once the element has left the DOM (AnimatePresence exit complete). */
  connected: boolean;
  transform: string;
  /** CSS `scale` longhand (`none` when unset). */
  scale: string;
  /** CSS `translate` longhand (`none` when unset). */
  translate: string;
  opacity: string;
  animationName: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MotionRecording = Record<string, MotionFrame[]>;

export async function startMotionRecorder(
  page: Page,
  selectors: Record<string, string>,
  durationMs = 1200,
): Promise<void> {
  await page.evaluate(
    ({ selectors, durationMs }) => {
      const store: Record<string, unknown[]> = {};
      for (const key of Object.keys(selectors)) store[key] = [];
      (window as unknown as { __motionFrames: unknown }).__motionFrames = store;

      const start = performance.now();
      const tick = () => {
        const now = performance.now() - start;
        for (const [key, selector] of Object.entries(selectors)) {
          const el = document.querySelector(selector) as HTMLElement | null;
          if (!el || !el.isConnected) {
            store[key].push({
              t: now,
              connected: false,
              transform: 'none',
              scale: 'none',
              translate: 'none',
              opacity: '0',
              animationName: 'none',
              x: 0,
              y: 0,
              width: 0,
              height: 0,
            });
            continue;
          }
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          store[key].push({
            t: now,
            connected: true,
            transform: cs.transform,
            scale: cs.scale,
            translate: cs.translate,
            opacity: cs.opacity,
            animationName: cs.animationName,
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
          });
        }
        if (now < durationMs) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    { selectors, durationMs },
  );
}

export async function collectMotionFrames(
  page: Page,
  waitMs = 1300,
): Promise<MotionRecording> {
  await page.waitForTimeout(waitMs);
  return page.evaluate(
    () => (window as unknown as { __motionFrames: MotionRecording }).__motionFrames,
  );
}

interface Decomposed {
  scaleX: number;
  translateX: number;
  translateY: number;
}

/** Pull scaleX / translateX / translateY out of a computed `transform` matrix. */
export function decomposeTransform(transform: string): Decomposed {
  if (!transform || transform === 'none') {
    return { scaleX: 1, translateX: 0, translateY: 0 };
  }
  const m2d = transform.match(/matrix\(([^)]+)\)/);
  if (m2d) {
    const [a, b, , , e, f] = m2d[1].split(',').map((v) => Number.parseFloat(v));
    return { scaleX: Math.hypot(a, b), translateX: e, translateY: f };
  }
  const m3d = transform.match(/matrix3d\(([^)]+)\)/);
  if (m3d) {
    const v = m3d[1].split(',').map((n) => Number.parseFloat(n));
    return { scaleX: Math.hypot(v[0], v[1]), translateX: v[12], translateY: v[13] };
  }
  return { scaleX: 1, translateX: 0, translateY: 0 };
}

/** The full effective offset of a frame: matrix translate + `translate` longhand. */
function effectiveTranslate(frame: MotionFrame): { x: number; y: number } {
  const d = decomposeTransform(frame.transform);
  let x = d.translateX;
  let y = d.translateY;
  if (frame.translate && frame.translate !== 'none') {
    const parts = frame.translate.split(/\s+/).map((p) => Number.parseFloat(p));
    if (!Number.isNaN(parts[0])) x += parts[0];
    if (parts.length > 1 && !Number.isNaN(parts[1])) y += parts[1];
  }
  return { x, y };
}

function effectiveScale(frame: MotionFrame): number {
  const d = decomposeTransform(frame.transform);
  let s = d.scaleX;
  const longhand = Number.parseFloat(frame.scale);
  if (!Number.isNaN(longhand)) s *= longhand;
  return s;
}

/** Frames where the element was actually in the DOM. */
export function connectedFrames(frames: MotionFrame[]): MotionFrame[] {
  return frames.filter((f) => f.connected);
}

/**
 * SC-004 — under `prefers-reduced-motion` an element must not translate or
 * scale at all: every frame carries an identity transform (allowing a static
 * sub-pixel rounding wobble).
 */
export function expectNoTransformMotion(frames: MotionFrame[], label: string): void {
  const connected = connectedFrames(frames);
  expect(connected.length, `${label}: element was never observed in the DOM`).toBeGreaterThan(0);
  for (const frame of connected) {
    const { x, y } = effectiveTranslate(frame);
    const scale = effectiveScale(frame);
    expect(
      Math.abs(x),
      `${label}: translateX ${x.toFixed(2)}px at t=${frame.t.toFixed(0)}ms (transform "${frame.transform}", translate "${frame.translate}")`,
    ).toBeLessThan(1);
    expect(
      Math.abs(y),
      `${label}: translateY ${y.toFixed(2)}px at t=${frame.t.toFixed(0)}ms`,
    ).toBeLessThan(1);
    expect(
      Math.abs(scale - 1),
      `${label}: scale ${scale.toFixed(3)} at t=${frame.t.toFixed(0)}ms`,
    ).toBeLessThan(0.01);
  }
}

/**
 * The element may carry a static positioning transform (e.g. the
 * ViewModeToggle pill) and may reposition itself when state changes, but
 * under reduced motion it must *jump*, not glide: at most one frame-to-frame
 * step shows movement, the rest stay put.
 */
export function expectJumpNotGlide(frames: MotionFrame[], label: string): void {
  const connected = connectedFrames(frames);
  expect(connected.length, `${label}: element was never observed in the DOM`).toBeGreaterThan(1);
  let movingSteps = 0;
  for (let i = 1; i < connected.length; i += 1) {
    const prev = effectiveTranslate(connected[i - 1]);
    const curr = effectiveTranslate(connected[i]);
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) > 2) movingSteps += 1;
  }
  expect(
    movingSteps,
    `${label}: transform changed across ${movingSteps} frame steps — reduced motion must jump in one step, not glide`,
  ).toBeLessThanOrEqual(1);
}

/**
 * Positive assertion that a transition actually played: some tracked quantity
 * (opacity, height, or transform offset) changed gradually across the
 * recording rather than snapping in a single frame.
 */
export function expectGradualMotion(frames: MotionFrame[], label: string): void {
  const connected = connectedFrames(frames);
  expect(connected.length, `${label}: element was never observed in the DOM`).toBeGreaterThan(2);

  let changingFrames = 0;
  for (let i = 1; i < connected.length; i += 1) {
    const a = connected[i - 1];
    const b = connected[i];
    const dOpacity = Math.abs(Number.parseFloat(b.opacity) - Number.parseFloat(a.opacity));
    const dHeight = Math.abs(b.height - a.height);
    const ta = effectiveTranslate(a);
    const tb = effectiveTranslate(b);
    const dTranslate = Math.hypot(tb.x - ta.x, tb.y - ta.y);
    if (dOpacity > 0.001 || dHeight > 0.5 || dTranslate > 0.5) changingFrames += 1;
  }

  expect(
    changingFrames,
    `${label}: expected the transition to play out over several frames, but nothing changed gradually (${changingFrames} changing frames)`,
  ).toBeGreaterThanOrEqual(2);
}

/**
 * Spec 059 Polish — T091 / SC-010 (60 fps under load).
 *
 * `startFrameCadenceRecorder` installs an in-page `requestAnimationFrame` loop
 * that records the interval between successive animation frames, plus a
 * `PerformanceObserver('long-animation-frame')` that captures any frame the
 * browser itself flagged as long (> 50 ms per the LoAF spec). Install it
 * synchronously, then trigger the transition on the next line so the window
 * straddles the whole enter → settle (or enter → interrupt → exit) arc.
 *
 * `collectFrameCadence` waits out the window and returns the raw samples;
 * `percentile` turns the intervals into the p95 the SC-010 gate asserts on.
 */
export interface FrameCadence {
  /** rAF-to-rAF intervals in ms across the recording window. */
  intervals: number[];
  /** Frames the browser flagged as long-animation-frames during the window. */
  longFrames: { duration: number; blockingDuration: number }[];
  /** Whether `long-animation-frame` was observable in this browser. */
  loafSupported: boolean;
  /** Total recording duration in ms. */
  elapsed: number;
}

export async function startFrameCadenceRecorder(page: Page, durationMs = 1600): Promise<void> {
  await page.evaluate((durationMs) => {
    const w = window as unknown as {
      __cadence: {
        intervals: number[];
        longFrames: { duration: number; blockingDuration: number }[];
        loafSupported: boolean;
        elapsed: number;
      };
      __cadenceObserver?: PerformanceObserver;
    };
    w.__cadence = { intervals: [], longFrames: [], loafSupported: false, elapsed: 0 };

    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          blockingDuration?: number;
        })[]) {
          w.__cadence.longFrames.push({
            duration: entry.duration,
            blockingDuration: entry.blockingDuration ?? 0,
          });
        }
      });
      po.observe({ type: 'long-animation-frame', buffered: true } as PerformanceObserverInit);
      w.__cadenceObserver = po;
      w.__cadence.loafSupported = true;
    } catch {
      // long-animation-frame unsupported — the rAF-interval sampler still runs.
    }

    const start = performance.now();
    let last = start;
    const tick = (now: number) => {
      w.__cadence.intervals.push(now - last);
      last = now;
      w.__cadence.elapsed = now - start;
      if (now - start < durationMs) requestAnimationFrame(tick);
      else w.__cadenceObserver?.disconnect();
    };
    requestAnimationFrame(tick);
  }, durationMs);
}

export async function collectFrameCadence(page: Page, waitMs = 1700): Promise<FrameCadence> {
  await page.waitForTimeout(waitMs);
  return page.evaluate(
    () => (window as unknown as { __cadence: FrameCadence }).__cadence,
  );
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

/**
 * SC-003 — an interrupted transition never jumps to its start or end value in
 * a single frame. Asserts the per-frame delta of every tracked quantity stays
 * bounded across the whole recording (a jump shows up as one outsized delta).
 */
export function expectNoSingleFrameJump(
  frames: MotionFrame[],
  label: string,
  bounds: { opacity?: number; scale?: number; translate?: number } = {},
): void {
  const { opacity = 0.4, scale = 0.06, translate = 48 } = bounds;
  const connected = connectedFrames(frames);
  expect(
    connected.length,
    `${label}: fewer than 3 in-DOM frames captured (${connected.length}) — cannot judge continuity`,
  ).toBeGreaterThanOrEqual(3);

  // Thresholds are expressed per ideal 60 fps frame (~16.7 ms). Under CI
  // runner contention rAF intervals stretch to 30–60 ms, so a smoothly
  // interpolating spring legitimately covers proportionally more ground
  // between the frames we sample. Scaling each delta down by the ratio of
  // the ideal interval to the *actual* interval keeps the assertion
  // frame-rate-independent: coarse sampling of continuous motion scales back
  // under the bound, while a genuine discontinuity (a teleport to the target
  // value in ~0 ms — the bug these guard against) still blows past it. The
  // factor is capped at 1 so a pair of near-coalesced frames (Δt ~1 ms) is
  // never *amplified* into a false jump, and sub-4 ms pairs (the same frame
  // sampled twice) are skipped outright.
  const IDEAL_FRAME_MS = 1000 / 60;
  for (let i = 1; i < connected.length; i += 1) {
    const a = connected[i - 1];
    const b = connected[i];
    const dt = b.t - a.t;
    if (dt < 4) continue;
    const norm = Math.min(1, IDEAL_FRAME_MS / dt);
    const dOpacity = Math.abs(Number.parseFloat(b.opacity) - Number.parseFloat(a.opacity)) * norm;
    const dScale = Math.abs(effectiveScale(b) - effectiveScale(a)) * norm;
    const ta = effectiveTranslate(a);
    const tb = effectiveTranslate(b);
    const dTranslate = Math.hypot(tb.x - ta.x, tb.y - ta.y) * norm;
    const dRect = Math.hypot(b.x - a.x, b.y - a.y) * norm;
    const span = `frames ${i - 1}→${i} (Δt ${dt.toFixed(0)}ms, 60fps-normalised)`;

    expect(
      dOpacity,
      `${label}: opacity jumped ${dOpacity.toFixed(3)} between ${span}`,
    ).toBeLessThan(opacity);
    expect(dScale, `${label}: scale jumped ${dScale.toFixed(3)} between ${span}`).toBeLessThan(scale);
    expect(
      dTranslate,
      `${label}: transform offset jumped ${dTranslate.toFixed(1)}px between ${span}`,
    ).toBeLessThan(translate);
    expect(
      dRect,
      `${label}: bounding box jumped ${dRect.toFixed(1)}px between ${span}`,
    ).toBeLessThan(translate);
  }
}

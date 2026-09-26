import { useEffect } from 'react';

/**
 * Locks `document.body` scroll while `active`, compensating the scrollbar
 * gutter with `padding-right` so the page does not shift (Constitution
 * no-layout-shift rule).
 *
 * `overflow: hidden` alone propagates from `body` to the viewport, which makes
 * the browser clamp the scroll offset to 0 and lose the reading position. So
 * the lock pins the body with `position: fixed` at `-scrollY` (the width is
 * held at 100% because a fixed body otherwise shrink-wraps) and scrolls back
 * to the saved offset on release. Reference-counted at module scope so nested
 * overlays don't release the lock early; the exact prior inline values of every
 * property touched are restored. Hand-rolled — no dependency (research.md R3).
 */

const LOCKED_PROPERTIES = [
  'overflow',
  'paddingRight',
  'position',
  'top',
  'width',
] as const;

let lockCount = 0;
let previousStyles: Record<string, string> = {};
let savedScrollY = 0;

function lock() {
  if (lockCount === 0) {
    const { body } = document;
    savedScrollY = window.scrollY;
    previousStyles = Object.fromEntries(LOCKED_PROPERTIES.map((p) => [p, body.style[p]]));

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.width = '100%';
  }
  lockCount += 1;
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    const { body } = document;
    for (const property of LOCKED_PROPERTIES) {
      body.style[property] = previousStyles[property] ?? '';
    }
    // The fixed body zeroed the viewport scroll; put the reader back.
    if (savedScrollY > 0) window.scrollTo(0, savedScrollY);
  }
}

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}

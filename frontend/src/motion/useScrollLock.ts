import { useEffect } from 'react';

/**
 * Locks `document.body` scroll while `active`, compensating the scrollbar
 * gutter with `padding-right` so the page does not shift (Constitution
 * no-layout-shift rule). Reference-counted at module scope so nested
 * overlays don't release the lock early; the exact prior inline
 * `overflow` / `padding-right` values are restored when the last consumer
 * releases. Hand-rolled — no dependency (research.md R3).
 */

let lockCount = 0;
let previousOverflow = '';
let previousPaddingRight = '';

function lock() {
  if (lockCount === 0) {
    const { body } = document;
    previousOverflow = body.style.overflow;
    previousPaddingRight = body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow;
    document.body.style.paddingRight = previousPaddingRight;
  }
}

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}

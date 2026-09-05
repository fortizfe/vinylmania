import { useEffect, type RefObject } from 'react';

/**
 * Captures `document.activeElement` on the rising edge of `active` and
 * returns focus to it on the falling edge / unmount — or to `ref.current`
 * when an explicit restore target is given. Skips restoration if the
 * captured element has left the DOM. Hand-rolled — no dependency
 * (research.md R3).
 */
export function useRestoreFocus(
  active: boolean,
  ref?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!active) return;

    const captured =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const explicitTarget = ref;

    return () => {
      const target = explicitTarget?.current ?? captured;
      if (target && target.isConnected) {
        target.focus();
      }
    };
  }, [active, ref]);
}

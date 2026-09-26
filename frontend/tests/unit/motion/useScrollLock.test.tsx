import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScrollLock } from '../../../src/motion/useScrollLock';

function LockHarness({ active }: { active: boolean }) {
  useScrollLock(active);
  return null;
}

/** The lock pins the body at the saved offset (`position: fixed`). */
function expectLocked(scrollY = 0) {
  expect(document.body.style.position).toBe('fixed');
  // CSSOM normalizes the `-0px` the hook writes at scroll origin back to `0px`.
  expect(document.body.style.top).toBe(scrollY === 0 ? '0px' : `-${scrollY}px`);
  expect(document.body.style.width).toBe('100%');
  expect(document.body.style.overflow).toBe('hidden');
}

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true });
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  setScrollY(0);
  document.body.removeAttribute('style');
});

describe('useScrollLock', () => {
  it('locks body scroll while active and restores it on deactivate', () => {
    const { rerender } = render(<LockHarness active />);
    expectLocked();

    rerender(<LockHarness active={false} />);
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(document.body.style.width).toBe('');
    expect(document.body.style.overflow).toBe('');
  });

  it('restores the exact scroll position that was current when it locked', () => {
    setScrollY(300);
    const { rerender } = render(<LockHarness active />);
    expectLocked(300);

    rerender(<LockHarness active={false} />);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 300);
  });

  it('restores the exact prior inline values of the properties it touches', () => {
    document.body.style.overflow = 'scroll';
    document.body.style.position = 'relative';
    document.body.style.width = '50%';

    const { rerender } = render(<LockHarness active />);
    expectLocked();

    rerender(<LockHarness active={false} />);
    expect(document.body.style.overflow).toBe('scroll');
    expect(document.body.style.position).toBe('relative');
    expect(document.body.style.width).toBe('50%');
  });

  it('compensates the scrollbar gutter to avoid layout shift', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(985);

    const { rerender } = render(<LockHarness active />);
    expect(document.body.style.paddingRight).toBe('15px');

    rerender(<LockHarness active={false} />);
    expect(document.body.style.paddingRight).toBe('');
  });

  it('is reference-counted so a nested lock does not unlock early', () => {
    setScrollY(120);
    const first = render(<LockHarness active />);
    const second = render(<LockHarness active />);
    expectLocked(120);

    first.unmount();
    // The second consumer still holds the lock.
    expectLocked(120);
    expect(window.scrollTo).not.toHaveBeenCalled();

    second.unmount();
    expect(document.body.style.position).toBe('');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 120);
  });

  it('unlocks on unmount', () => {
    setScrollY(80);
    const { unmount } = render(<LockHarness active />);
    expectLocked(80);

    unmount();
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 80);
  });
});

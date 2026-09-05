import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useScrollLock } from '../../../src/motion/useScrollLock';

function LockHarness({ active }: { active: boolean }) {
  useScrollLock(active);
  return null;
}

afterEach(() => {
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
});

describe('useScrollLock', () => {
  it('locks body scroll while active and restores it on deactivate', () => {
    const { rerender } = render(<LockHarness active />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<LockHarness active={false} />);
    expect(document.body.style.overflow).toBe('');
  });

  it('restores the exact prior inline overflow value', () => {
    document.body.style.overflow = 'scroll';
    const { rerender } = render(<LockHarness active />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<LockHarness active={false} />);
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('compensates the scrollbar gutter to avoid layout shift', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(985);

    const { rerender } = render(<LockHarness active />);
    expect(document.body.style.paddingRight).toBe('15px');

    rerender(<LockHarness active={false} />);
    expect(document.body.style.paddingRight).toBe('');
    vi.restoreAllMocks();
  });

  it('is reference-counted so a nested lock does not unlock early', () => {
    const first = render(<LockHarness active />);
    const second = render(<LockHarness active />);
    expect(document.body.style.overflow).toBe('hidden');

    first.unmount();
    // The second consumer still holds the lock.
    expect(document.body.style.overflow).toBe('hidden');

    second.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('unlocks on unmount', () => {
    const { unmount } = render(<LockHarness active />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

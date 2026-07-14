import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useEscapeKey } from '../../src/hooks/useEscapeKey';

describe('useEscapeKey', () => {
  it('calls the callback when Escape is pressed while active', () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeKey(onClose, true));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call the callback for other keys', () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeKey(onClose, true));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not call the callback at all while inactive', () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeKey(onClose, false));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes its keydown listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useEscapeKey(onClose, true));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});

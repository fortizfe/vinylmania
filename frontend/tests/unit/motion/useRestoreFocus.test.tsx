import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useRestoreFocus } from '../../../src/motion/useRestoreFocus';

function Overlayish({ active }: { active: boolean }) {
  useRestoreFocus(active);
  return active ? <button type="button">inside-overlay</button> : null;
}

function ExplicitTarget({ active }: { active: boolean }) {
  const target = useRef<HTMLButtonElement>(null);
  useRestoreFocus(active, target);
  return (
    <>
      <button type="button" ref={target}>
        explicit-target
      </button>
      {active && <button type="button">inside-overlay</button>}
    </>
  );
}

describe('useRestoreFocus', () => {
  it('restores focus to the element focused when it became active', () => {
    const opener = document.createElement('button');
    opener.textContent = 'opener';
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = render(<Overlayish active={false} />);
    rerender(<Overlayish active />);
    screen.getByRole('button', { name: 'inside-overlay' }).focus();

    rerender(<Overlayish active={false} />);
    expect(opener).toHaveFocus();

    opener.remove();
  });

  it('restores focus on unmount when the captured element is still connected', () => {
    const opener = document.createElement('button');
    opener.textContent = 'opener';
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(<Overlayish active />);
    screen.getByRole('button', { name: 'inside-overlay' }).focus();

    unmount();
    expect(opener).toHaveFocus();

    opener.remove();
  });

  it('prefers an explicit restore target ref when provided', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = render(<ExplicitTarget active={false} />);
    rerender(<ExplicitTarget active />);
    rerender(<ExplicitTarget active={false} />);

    expect(screen.getByRole('button', { name: 'explicit-target' })).toHaveFocus();
    opener.remove();
  });

  it('does not throw when the captured element has left the DOM', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = render(<Overlayish active={false} />);
    rerender(<Overlayish active />);
    opener.remove();

    expect(() => rerender(<Overlayish active={false} />)).not.toThrow();
  });
});

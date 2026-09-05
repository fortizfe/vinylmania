import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useFocusTrap } from '../../../src/motion/useFocusTrap';

function TrapHarness({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active);

  return (
    <div>
      <button type="button">outside-before</button>
      <div ref={ref} data-testid="trap">
        <button type="button">first</button>
        <button type="button">middle</button>
        <button type="button">last</button>
      </div>
      <button type="button">outside-after</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus into the container when activated', async () => {
    render(<TrapHarness active />);

    // First focusable inside the container receives focus on activation.
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('wraps focus from the last focusable back to the first on Tab', async () => {
    const user = userEvent.setup();
    render(<TrapHarness active />);

    screen.getByRole('button', { name: 'last' }).focus();
    await user.tab();

    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('wraps focus from the first focusable to the last on Shift+Tab', async () => {
    const user = userEvent.setup();
    render(<TrapHarness active />);

    screen.getByRole('button', { name: 'first' }).focus();
    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'last' }).matches(':focus')).toBe(true);
  });

  it('does not move focus on activation while inactive', () => {
    render(<TrapHarness active={false} />);
    expect(screen.getByRole('button', { name: 'first' })).not.toHaveFocus();
  });

  it('does not wrap focus while inactive', async () => {
    const user = userEvent.setup();
    render(<TrapHarness active={false} />);

    screen.getByRole('button', { name: 'last' }).focus();
    await user.tab();

    // No trap: focus escapes to the element after the container.
    expect(screen.getByRole('button', { name: 'outside-after' })).toHaveFocus();
  });
});

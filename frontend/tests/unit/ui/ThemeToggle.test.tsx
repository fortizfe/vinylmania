import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ThemeToggle } from '../../../src/components/ui/ThemeToggle';
import { focusRing } from '../../../src/components/ui/focusRing';

describe('ThemeToggle', () => {
  it('renders as an accessible switch reflecting the current theme', () => {
    render(<ThemeToggle theme="light" onToggle={() => {}} />);

    const toggle = screen.getByRole('switch', { name: 'Dark mode' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onToggle when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ThemeToggle theme="light" onToggle={onToggle} />);

    await user.click(screen.getByRole('switch', { name: 'Dark mode' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('meets the 44px minimum touch target height (FR-004)', () => {
    render(<ThemeToggle theme="light" onToggle={() => {}} />);

    expect(screen.getByRole('switch', { name: 'Dark mode' }).className).toMatch(
      /min-h-11/,
    );
  });

  describe('pressed-state feedback (US1)', () => {
    it('gives the track a pressed affordance that is dropped under reduced motion', () => {
      render(<ThemeToggle theme="light" onToggle={() => {}} />);

      const toggle = screen.getByRole('switch', { name: 'Dark mode' });
      expect(toggle.className).toMatch(/active:scale-\[0\.97\]/);
      expect(toggle.className).toMatch(/motion-reduce:active:scale-100/);
    });

    it('adopts the shared focusRing constant', () => {
      render(<ThemeToggle theme="light" onToggle={() => {}} />);

      for (const cls of focusRing.split(' ')) {
        expect(screen.getByRole('switch', { name: 'Dark mode' }).className).toContain(
          cls,
        );
      }
    });
  });
});

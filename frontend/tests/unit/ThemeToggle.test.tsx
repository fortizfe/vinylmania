import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ThemeToggle } from '../../src/components/ui/ThemeToggle';

describe('ThemeToggle', () => {
  it('renders the sun/blue-sky/clouds artwork in light mode', () => {
    render(<ThemeToggle theme="light" onToggle={vi.fn()} />);

    const toggle = screen.getByRole('switch', { name: /dark mode/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('theme-toggle-sun-artwork')).toBeInTheDocument();
    expect(screen.queryByTestId('theme-toggle-moon-artwork')).not.toBeInTheDocument();
  });

  it('renders the moon/night-sky/stars artwork in dark mode', () => {
    render(<ThemeToggle theme="dark" onToggle={vi.fn()} />);

    const toggle = screen.getByRole('switch', { name: /dark mode/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('theme-toggle-moon-artwork')).toBeInTheDocument();
    expect(screen.queryByTestId('theme-toggle-sun-artwork')).not.toBeInTheDocument();
  });

  it('invokes onToggle when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ThemeToggle theme="light" onToggle={onToggle} />);

    await user.click(screen.getByRole('switch', { name: /dark mode/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('is operable via the keyboard (Enter and Space)', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ThemeToggle theme="light" onToggle={onToggle} />);

    const toggle = screen.getByRole('switch', { name: /dark mode/i });
    toggle.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});

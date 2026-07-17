import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ViewModeToggle } from '../../src/components/ui/ViewModeToggle';

describe('ViewModeToggle', () => {
  it('renders a radiogroup with grid and list options', () => {
    render(<ViewModeToggle mode="grid" onChange={vi.fn()} screen="search" />);

    expect(screen.getByTestId('view-mode-toggle')).toHaveAttribute('role', 'radiogroup');
    expect(screen.getByTestId('view-mode-grid')).toHaveAttribute('role', 'radio');
    expect(screen.getByTestId('view-mode-list')).toHaveAttribute('role', 'radio');
  });

  it('reflects the active mode via aria-checked', () => {
    render(<ViewModeToggle mode="grid" onChange={vi.fn()} screen="search" />);

    expect(screen.getByTestId('view-mode-grid')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('view-mode-list')).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with the new mode exactly once when clicking the inactive option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewModeToggle mode="grid" onChange={onChange} screen="search" />);

    await user.click(screen.getByTestId('view-mode-list'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('is a no-op when clicking the already-active option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewModeToggle mode="grid" onChange={onChange} screen="search" />);

    await user.click(screen.getByTestId('view-mode-grid'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders both options at the 44px minimum touch-target size', () => {
    render(<ViewModeToggle mode="grid" onChange={vi.fn()} screen="search" />);

    expect(screen.getByTestId('view-mode-grid')).toHaveClass('min-h-11', 'min-w-11');
    expect(screen.getByTestId('view-mode-list')).toHaveClass('min-h-11', 'min-w-11');
  });

  it('only the active option is in the tab order (roving tabIndex)', () => {
    render(<ViewModeToggle mode="list" onChange={vi.fn()} screen="library" />);

    expect(screen.getByTestId('view-mode-list')).toHaveAttribute('tabIndex', '0');
    expect(screen.getByTestId('view-mode-grid')).toHaveAttribute('tabIndex', '-1');
  });

  it('pressing an arrow key while the active option is focused moves focus to and activates the other option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewModeToggle mode="grid" onChange={onChange} screen="search" />);

    const gridOption = screen.getByTestId('view-mode-grid');
    gridOption.focus();
    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('list');
  });
});

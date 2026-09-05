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

  it('gives each option a pressed affordance and the shared focusRing (US1)', () => {
    render(<ViewModeToggle mode="grid" onChange={vi.fn()} screen="search" />);

    for (const testid of ['view-mode-grid', 'view-mode-list']) {
      const option = screen.getByTestId(testid);
      expect(option.className).toMatch(/active:scale-\[0\.97\]/);
      expect(option.className).toMatch(/motion-reduce:active:scale-100/);
      expect(option.className).toContain('focus-visible:ring-primary');
    }
  });

  it('only the active option is in the tab order (roving tabIndex)', () => {
    render(<ViewModeToggle mode="list" onChange={vi.fn()} screen="library" />);

    expect(screen.getByTestId('view-mode-list')).toHaveAttribute('tabIndex', '0');
    expect(screen.getByTestId('view-mode-grid')).toHaveAttribute('tabIndex', '-1');
  });

  describe('shared-element sliding pill (US2)', () => {
    it('renders a single pill element behind the active option', () => {
      render(<ViewModeToggle mode="grid" onChange={vi.fn()} screen="search" />);

      const pills = screen.getAllByTestId('view-mode-pill');
      expect(pills).toHaveLength(1);
      expect(pills[0].className).toMatch(/bg-primary/);
      expect(pills[0]).toHaveAttribute('aria-hidden', 'true');
    });

    it('marks the pill non-animating under prefers-reduced-motion', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));

      render(<ViewModeToggle mode="list" onChange={vi.fn()} screen="library" />);

      expect(screen.getByTestId('view-mode-pill')).toHaveAttribute(
        'data-reduced-motion',
        'true',
      );
      vi.restoreAllMocks();
    });

    it('does not paint a static background on the active button (the pill owns it)', () => {
      render(<ViewModeToggle mode="grid" onChange={vi.fn()} screen="search" />);

      expect(screen.getByTestId('view-mode-grid').className).not.toMatch(/\bbg-primary\b/);
    });
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
